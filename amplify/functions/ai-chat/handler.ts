import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import Redis from 'ioredis';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequest = {
  conversationId?: string;
  messages: ChatMessage[];
};

type ChatResponse = {
  message: string;
  conversationId: string;
};

const {
  AWS_REGION,
  COGNITO_USER_POOL_ID,
  XAI_API_URL,
  XAI_API_KEY,
  XAI_MODEL,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_TLS,
  REDIS_TTL_SECONDS,
  REDIS_MESSAGE_LIMIT,
  CHAT_TABLE_NAME,
  DDB_TTL_DAYS,
  CORS_ORIGIN,
  AI_SYSTEM_PROMPT,
} = process.env;

const region = AWS_REGION || 'us-east-1';
const redisTtlSeconds = Number(REDIS_TTL_SECONDS || 604800);
const redisMessageLimit = Number(REDIS_MESSAGE_LIMIT || 20);
const ddbTtlDays = Number(DDB_TTL_DAYS || 0);

const jwks = COGNITO_USER_POOL_ID
  ? createRemoteJWKSet(
      new URL(`https://cognito-idp.${region}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`)
    )
  : null;

let redisClient: Redis | null = null;
let ddbClient: DynamoDBDocumentClient | null = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;
  if (!REDIS_HOST || !REDIS_PORT) return null;
  redisClient = new Redis({
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    tls: REDIS_TLS === 'true' ? {} : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
  return redisClient;
};

const getDynamoClient = () => {
  if (ddbClient) return ddbClient;
  ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  return ddbClient;
};

const resolveCorsOrigin = (origin?: string) => {
  const allowed = (CORS_ORIGIN || '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.includes('*')) {
    return '*';
  }

  if (origin && allowed.includes(origin)) {
    return origin;
  }

  return allowed[0] || '*';
};

const corsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': resolveCorsOrigin(origin),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const respond = (
  statusCode: number,
  body: Record<string, unknown>,
  origin?: string
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: corsHeaders(origin),
  body: JSON.stringify(body),
});

const getBearerToken = (headers: Record<string, string | undefined>) => {
  const header = headers.authorization || headers.Authorization;
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
};

const verifyToken = async (token: string) => {
  if (!jwks || !COGNITO_USER_POOL_ID) {
    throw new Error('Missing Cognito configuration.');
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
  });
  return payload;
};

const loadRedisMessages = async (key: string) => {
  const client = getRedisClient();
  if (!client) return [];
  await client.connect();
  const items = await client.lrange(key, -redisMessageLimit, -1);
  return items
    .map((raw) => {
      try {
        return JSON.parse(raw) as ChatMessage;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ChatMessage[];
};

const appendRedisMessages = async (key: string, messages: ChatMessage[]) => {
  const client = getRedisClient();
  if (!client) return;
  await client.connect();
  const pipeline = client.pipeline();
  messages.forEach((msg) => pipeline.rpush(key, JSON.stringify(msg)));
  pipeline.expire(key, redisTtlSeconds);
  await pipeline.exec();
};

const persistMessage = async (userId: string, conversationId: string, message: ChatMessage) => {
  if (!CHAT_TABLE_NAME) return;
  const ddb = getDynamoClient();
  const createdAt = new Date().toISOString();
  const ttl = ddbTtlDays > 0 ? Math.floor(Date.now() / 1000) + ddbTtlDays * 86400 : undefined;
  await ddb.send(
    new PutCommand({
      TableName: CHAT_TABLE_NAME,
      Item: {
        userId,
        createdAt,
        conversationId,
        role: message.role,
        content: message.content,
        ttl,
      },
    })
  );
};

const callXai = async (messages: ChatMessage[]) => {
  if (!XAI_API_URL || !XAI_API_KEY) {
    throw new Error('X AI credentials are not configured.');
  }
  const response = await fetch(`${XAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL || 'grok-4',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X AI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('X AI response missing content.');
  }
  return content as string;
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers?.origin || event.headers?.Origin;

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin) };
  }

  try {
    const token = getBearerToken(event.headers || {});
    if (!token) {
      return respond(401, { error: 'Missing Authorization token.' }, origin);
    }

    const payload = await verifyToken(token);
    const userId = (payload.sub || payload['cognito:username']) as string | undefined;
    if (!userId) {
      return respond(401, { error: 'Invalid user token.' }, origin);
    }

    if (!event.body) {
      return respond(400, { error: 'Missing request body.' }, origin);
    }

    const request = JSON.parse(event.body) as ChatRequest;
    if (!request.messages || request.messages.length === 0) {
      return respond(400, { error: 'Request must include messages.' }, origin);
    }

    const conversationId =
      request.conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const redisKey = `chat:${userId}:${conversationId}`;

    const redisMessages = await loadRedisMessages(redisKey);
    const combinedMessages: ChatMessage[] = [];

    if (AI_SYSTEM_PROMPT) {
      combinedMessages.push({ role: 'system', content: AI_SYSTEM_PROMPT });
    }

    combinedMessages.push(...redisMessages, ...request.messages);

    const responseMessage = await callXai(combinedMessages);

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseMessage,
    };

    await appendRedisMessages(redisKey, [...request.messages, assistantMessage]);

    for (const msg of [...request.messages, assistantMessage]) {
      await persistMessage(userId, conversationId, msg);
    }

    const response: ChatResponse = {
      message: responseMessage,
      conversationId,
    };

    return respond(200, response, origin);
  } catch (error: any) {
    console.error('AI chat handler error:', error?.message || error);
    return respond(500, { error: 'Failed to process chat request.' }, origin);
  }
};
