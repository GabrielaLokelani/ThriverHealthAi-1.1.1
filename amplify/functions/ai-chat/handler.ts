import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import Redis from 'ioredis';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatAttachment = {
  type: 'image' | 'video';
  filename: string;
  mimeType: string;
  dataUrl?: string;
  s3Key?: string;
};

type ChatRequest = {
  conversationId?: string;
  messages: ChatMessage[];
  attachments?: ChatAttachment[];
  persist?: boolean;
};

type ChatResponse = {
  message: string;
  conversationId: string;
};

type ChatMessageRecord = ChatMessage & {
  conversationId: string;
  createdAt: string;
};

type ConversationSummary = {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount: number;
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
  REDIS_ENABLED,
  REDIS_ENCRYPTION_KEY,
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
const redisConnectTimeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 500);
const redisEnabled = REDIS_ENABLED !== 'false';
const redisEncryptionKey = REDIS_ENCRYPTION_KEY || '';
const redisEncryptionReady = redisEnabled && redisEncryptionKey.length >= 32;
const ddbTtlDays = Number(DDB_TTL_DAYS || 0);
const xaiRequestTimeoutMs = Number(process.env.XAI_REQUEST_TIMEOUT_MS || 20000);
const xaiFallbackTimeoutMs = Number(process.env.XAI_FALLBACK_TIMEOUT_MS || 10000);
const maxModelContextMessages = Number(process.env.XAI_MAX_CONTEXT_MESSAGES || 6);
const maxMessageContentChars = Number(process.env.XAI_MAX_MESSAGE_CHARS || 1000);
const maxImageAttachmentsPerRequest = Number(process.env.XAI_MAX_IMAGE_ATTACHMENTS || 3);
const primaryModel = XAI_MODEL || 'grok-4-0709';
const fallbackModel = process.env.XAI_FALLBACK_MODEL || 'grok-4-fast-non-reasoning';

const jwks = COGNITO_USER_POOL_ID
  ? createRemoteJWKSet(
      new URL(`https://cognito-idp.${region}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`)
    )
  : null;

let redisClient: Redis | null = null;
let ddbClient: DynamoDBDocumentClient | null = null;
let redisTemporarilyDisabled = false;
let redisEncryptionWarned = false;

const getRedisClient = () => {
  if (!redisEnabled) return null;
  if (!redisEncryptionReady) {
    if (!redisEncryptionWarned) {
      console.warn('Redis cache disabled: missing REDIS_ENCRYPTION_KEY.');
      redisEncryptionWarned = true;
    }
    return null;
  }
  if (redisTemporarilyDisabled) return null;
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
  redisClient.on('error', () => {
    // Keep chat working even if Redis is unavailable.
  });
  return redisClient;
};

const getRedisCipherKey = () => createHash('sha256').update(redisEncryptionKey).digest();

const encryptRedisPayload = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getRedisCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
};

const decryptRedisPayload = (encoded: string): string => {
  const [ivB64, tagB64, dataB64] = encoded.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload.');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getRedisCipherKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

const connectRedisSafely = async (client: Redis): Promise<boolean> => {
  if (client.status === 'ready') return true;
  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connect timed out.')), redisConnectTimeoutMs)
      ),
    ]);
    return true;
  } catch {
    redisTemporarilyDisabled = true;
    try {
      client.disconnect();
    } catch {
      // no-op
    }
    return false;
  }
};

const getDynamoClient = () => {
  if (ddbClient) return ddbClient;
  ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  return ddbClient;
};

const resolveCorsOrigin = (origin?: string): string | null => {
  const isLocalDevOrigin = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1' ||
        parsed.hostname === '[::1]'
      );
    } catch {
      return false;
    }
  };

  const allowed = (CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin) {
    return null;
  }

  // In dev/sandbox, allow local browser origins by default.
  if (isLocalDevOrigin(origin)) {
    return origin;
  }

  if (allowed.length === 0) {
    return null;
  }

  if (allowed.includes('*')) {
    return origin;
  }

  if (allowed.includes(origin)) {
    return origin;
  }

  // Treat local dev origins as equivalent (localhost vs 127.0.0.1 vs ::1)
  const normalizeLocalOrigin = (value: string): string | null => {
    try {
      const parsed = new URL(value);
      const host =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1' ||
        parsed.hostname === '[::1]'
          ? 'localdev'
          : parsed.hostname;
      const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      return `${parsed.protocol}//${host}:${port}`;
    } catch {
      return null;
    }
  };

  const normalizedOrigin = normalizeLocalOrigin(origin);
  if (
    normalizedOrigin &&
    allowed.some((candidate) => normalizeLocalOrigin(candidate) === normalizedOrigin)
  ) {
    return origin;
  }

  return null;
};

const corsHeaders = (allowedOrigin?: string) =>
  allowedOrigin
    ? {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        Vary: 'Origin',
      }
    : {};

const respond = (
  statusCode: number,
  body: Record<string, unknown>,
  allowedOrigin?: string
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: corsHeaders(allowedOrigin),
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
  try {
    const connected = await connectRedisSafely(client);
    if (!connected) return [];
    const items = await client.lrange(key, -redisMessageLimit, -1);
    return items
      .map((raw) => {
        try {
          const decrypted = decryptRedisPayload(raw);
          return JSON.parse(decrypted) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ChatMessage[];
  } catch {
    redisTemporarilyDisabled = true;
    return [];
  }
};

const appendRedisMessages = async (key: string, messages: ChatMessage[]) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    const connected = await connectRedisSafely(client);
    if (!connected) return;
    const pipeline = client.pipeline();
    messages.forEach((msg) => pipeline.rpush(key, encryptRedisPayload(JSON.stringify(msg))));
    pipeline.expire(key, redisTtlSeconds);
    await pipeline.exec();
  } catch {
    redisTemporarilyDisabled = true;
  }
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

const fetchMessages = async (
  userId: string,
  conversationId?: string,
  limit?: number
): Promise<ChatMessageRecord[]> => {
  if (!CHAT_TABLE_NAME) return [];
  const ddb = getDynamoClient();

  const params: {
    TableName: string;
    KeyConditionExpression: string;
    ExpressionAttributeValues: Record<string, string>;
    FilterExpression?: string;
    Limit?: number;
    ScanIndexForward?: boolean;
  } = {
    TableName: CHAT_TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    ScanIndexForward: true,
  };

  if (conversationId) {
    params.FilterExpression = 'conversationId = :conversationId';
    params.ExpressionAttributeValues[':conversationId'] = conversationId;
  }

  if (limit && limit > 0) {
    params.Limit = limit;
  }

  const result = await ddb.send(new QueryCommand(params));
  return (result.Items || []) as ChatMessageRecord[];
};

const deleteConversationMessages = async (
  userId: string,
  conversationId: string
): Promise<number> => {
  if (!CHAT_TABLE_NAME) return 0;
  const items = await fetchMessages(userId, conversationId);
  const ddb = getDynamoClient();
  let deleted = 0;
  for (const item of items) {
    await ddb.send(
      new DeleteCommand({
        TableName: CHAT_TABLE_NAME,
        Key: { userId, createdAt: item.createdAt },
      })
    );
    deleted++;
  }

  const redis = getRedisClient();
  if (redis) {
    const redisKey = `chat:${userId}:${conversationId}`;
    try {
      const connected = await connectRedisSafely(redis);
      if (connected) {
        await redis.del(redisKey);
      }
    } catch {
      // Non-critical; Redis TTL will clean up eventually.
    }
  }
  return deleted;
};

const summarizeConversations = (items: ChatMessageRecord[]): ConversationSummary[] => {
  const map = new Map<string, ConversationSummary>();

  items.forEach((item) => {
    const existing = map.get(item.conversationId);
    if (!existing) {
      map.set(item.conversationId, {
        conversationId: item.conversationId,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        lastMessage: item.content,
        messageCount: 1,
      });
      return;
    }

    const existingUpdatedAt = new Date(existing.updatedAt).getTime();
    const itemUpdatedAt = new Date(item.createdAt).getTime();

    existing.messageCount += 1;
    if (itemUpdatedAt > existingUpdatedAt) {
      existing.updatedAt = item.createdAt;
      existing.lastMessage = item.content;
    }
    if (new Date(item.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
      existing.createdAt = item.createdAt;
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

const compactMessagesForModel = (messages: ChatMessage[]): ChatMessage[] => {
  const recentMessages = messages.slice(-Math.max(1, maxModelContextMessages));
  return recentMessages.map((message) => ({
    role: message.role,
    content:
      message.content.length > maxMessageContentChars
        ? `${message.content.slice(0, maxMessageContentChars)}...`
        : message.content,
  }));
};

type XaiModelMessage =
  | { role: ChatRole; content: string }
  | {
      role: ChatRole;
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
    };

const toXaiMessages = (
  messages: ChatMessage[],
  attachments?: ChatAttachment[]
): XaiModelMessage[] => {
  const imageAttachments = (attachments || [])
    .filter(
      (item) =>
        item.type === 'image' &&
        typeof item.dataUrl === 'string' &&
        item.dataUrl.startsWith('data:image/')
    )
    .slice(0, Math.max(0, maxImageAttachmentsPerRequest));

  if (!imageAttachments.length) {
    return messages.map((message) => ({ role: message.role, content: message.content }));
  }

  const lastUserMessageIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((entry) => entry.message.role === 'user')?.index;

  return messages.map((message, index) => {
    if (index !== lastUserMessageIndex) {
      return { role: message.role, content: message.content };
    }

    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> =
      [{ type: 'text', text: message.content }];

    imageAttachments.forEach((attachment) => {
      if (!attachment.dataUrl) return;
      content.push({
        type: 'image_url',
        image_url: { url: attachment.dataUrl },
      });
    });

    return { role: message.role, content };
  });
};

const callXaiWithModel = async (
  model: string,
  messages: XaiModelMessage[],
  timeoutMs: number
): Promise<string> => {
  if (!XAI_API_URL || !XAI_API_KEY) {
    throw new Error('X AI credentials are not configured.');
  }
  if (!XAI_API_URL.startsWith('https://')) {
    throw new Error('X AI URL must use HTTPS.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response | undefined;
  try {
    response = await fetch(`${XAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('X AI request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

const callXai = async (messages: XaiModelMessage[]) => {
  try {
    return await callXaiWithModel(primaryModel, messages, xaiRequestTimeoutMs);
  } catch (error: any) {
    const message = String(error?.message || '');
    const isTimeout = message.includes('timed out');
    const is5xx = message.includes('X AI request failed: 5');
    const shouldFallback = fallbackModel && fallbackModel !== primaryModel && (isTimeout || is5xx);
    if (!shouldFallback) {
      throw error;
    }
    return callXaiWithModel(fallbackModel, messages, xaiFallbackTimeoutMs);
  }
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigin = origin ? resolveCorsOrigin(origin) : undefined;

  if (origin && !allowedOrigin) {
    return respond(403, { error: 'CORS origin not allowed.' });
  }

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(allowedOrigin) };
  }

  try {
    const token = getBearerToken(event.headers || {});
    if (!token) {
      return respond(401, { error: 'Missing Authorization token.' }, allowedOrigin);
    }

    const payload = await verifyToken(token);
    const userId = (payload.sub || payload['cognito:username']) as string | undefined;
    if (!userId) {
      return respond(401, { error: 'Invalid user token.' }, allowedOrigin);
    }

    if (event.requestContext.http.method === 'GET') {
      const conversationId = event.queryStringParameters?.conversationId;
      const limitParam = event.queryStringParameters?.limit;
      const limit = limitParam ? Number(limitParam) : undefined;

      if (conversationId) {
        const items = await fetchMessages(userId, conversationId, limit);
        return respond(
          200,
          {
            conversationId,
            messages: items.map((item) => ({
              role: item.role,
              content: item.content,
              createdAt: item.createdAt,
            })),
          },
          allowedOrigin
        );
      }

      const items = await fetchMessages(userId, undefined, limit);
      return respond(
        200,
        {
          conversations: summarizeConversations(items),
        },
        allowedOrigin
      );
    }

    if (event.requestContext.http.method === 'DELETE') {
      const conversationId = event.queryStringParameters?.conversationId;
      if (!conversationId) {
        return respond(400, { error: 'conversationId is required.' }, allowedOrigin);
      }
      const deleted = await deleteConversationMessages(userId, conversationId);
      return respond(200, { deleted, conversationId }, allowedOrigin);
    }

    if (!event.body) {
      return respond(400, { error: 'Missing request body.' }, allowedOrigin);
    }

    const request = JSON.parse(event.body) as ChatRequest;
    if (!request.messages || request.messages.length === 0) {
      return respond(400, { error: 'Request must include messages.' }, allowedOrigin);
    }
    const shouldPersist = request.persist !== false;

    const conversationId =
      request.conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const redisKey = `chat:${userId}:${conversationId}`;

    const redisMessages = shouldPersist ? await loadRedisMessages(redisKey) : [];
    const combinedMessages: ChatMessage[] = [];

    if (AI_SYSTEM_PROMPT) {
      combinedMessages.push({ role: 'system', content: AI_SYSTEM_PROMPT });
    }

    const modelInputMessages = compactMessagesForModel([...redisMessages, ...request.messages]);
    combinedMessages.push(...modelInputMessages);
    const xaiMessages = toXaiMessages(combinedMessages, request.attachments);
    const responseMessage = await callXai(xaiMessages);

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseMessage,
    };

    if (shouldPersist) {
      await appendRedisMessages(redisKey, [...request.messages, assistantMessage]);
    }

    if (shouldPersist) {
      for (const msg of [...request.messages, assistantMessage]) {
        await persistMessage(userId, conversationId, msg);
      }
    }

    const response: ChatResponse = {
      message: responseMessage,
      conversationId,
    };

    return respond(200, response, allowedOrigin);
  } catch (error: any) {
    console.error('AI chat handler error.');
    const message = String(error?.message || '');
    if (message.includes('timed out')) {
      return respond(504, { error: 'AI request timed out. Please try again.' }, allowedOrigin);
    }
    return respond(500, { error: 'Failed to process chat request.' }, allowedOrigin);
  }
};
