import { defineBackend, secret } from '@aws-amplify/backend';
import { Table, AttributeType, BillingMode, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { Key } from 'aws-cdk-lib/aws-kms';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
  CfnStage as HttpCfnStage,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { aiChat } from './functions/ai-chat/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
export const backend = defineBackend({
  auth,
  data,
  storage,
  aiChat,
});

// Ensure AI chat has enough time for external model calls.
const aiChatLambdaCfn = backend.aiChat.resources.lambda.node.defaultChild as CfnFunction;
aiChatLambdaCfn.timeout = 30;
aiChatLambdaCfn.memorySize = 1024;

const chatStack = backend.createStack('chat');
const apiStack = backend.aiChat.resources.lambda.stack;

const chatDataKey = new Key(chatStack, 'ChatDataKey', {
  description: 'CMK for AI chat table encryption',
  enableKeyRotation: true,
  removalPolicy: RemovalPolicy.RETAIN,
});

const chatMessagesTable = new Table(chatStack, 'ChatMessages', {
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: chatDataKey,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  timeToLiveAttribute: 'ttl',
});

chatMessagesTable.grantReadWriteData(backend.aiChat.resources.lambda);
backend.aiChat.addEnvironment('CHAT_TABLE_NAME', chatMessagesTable.tableName);
backend.aiChat.addEnvironment('COGNITO_USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
backend.aiChat.addEnvironment('XAI_API_URL', secret('XAI_API_URL'));
backend.aiChat.addEnvironment('XAI_API_KEY', secret('XAI_API_KEY'));
backend.aiChat.addEnvironment('XAI_MODEL', 'grok-4-0709');
backend.aiChat.addEnvironment('XAI_FALLBACK_MODEL', 'grok-4-fast-non-reasoning');
backend.aiChat.addEnvironment('XAI_REQUEST_TIMEOUT_MS', '20000');
backend.aiChat.addEnvironment('XAI_FALLBACK_TIMEOUT_MS', '10000');
backend.aiChat.addEnvironment('XAI_MAX_CONTEXT_MESSAGES', '6');
backend.aiChat.addEnvironment('XAI_MAX_MESSAGE_CHARS', '1000');
backend.aiChat.addEnvironment('XAI_MAX_IMAGE_ATTACHMENTS', '3');
backend.aiChat.addEnvironment('REDIS_ENABLED', 'true');
backend.aiChat.addEnvironment('REDIS_CONNECT_TIMEOUT_MS', '500');
backend.aiChat.addEnvironment('REDIS_HOST', secret('REDIS_HOST'));
backend.aiChat.addEnvironment('REDIS_PORT', secret('REDIS_PORT'));
backend.aiChat.addEnvironment('REDIS_USERNAME', secret('REDIS_USERNAME'));
backend.aiChat.addEnvironment('REDIS_PASSWORD', secret('REDIS_PASSWORD'));
backend.aiChat.addEnvironment('REDIS_ENCRYPTION_KEY', secret('REDIS_ENCRYPTION_KEY'));
backend.aiChat.addEnvironment('REDIS_TLS', 'true');
backend.aiChat.addEnvironment('REDIS_TTL_SECONDS', '604800');
backend.aiChat.addEnvironment('REDIS_MESSAGE_LIMIT', '20');
backend.aiChat.addEnvironment('CORS_ORIGIN', secret('CORS_ORIGIN'));
backend.aiChat.addEnvironment('AI_SYSTEM_PROMPT', secret('AI_SYSTEM_PROMPT'));

const api = new HttpApi(apiStack, 'AiChatApi', {
  apiName: 'ai-chat-api',
  createDefaultStage: true,
  corsPreflight: {
    allowOrigins: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://thriverhealth.ai',
      'https://www.thriverhealth.ai',
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
  },
});

const authorizer = new HttpJwtAuthorizer(
  'AiChatJwtAuthorizer',
  `https://cognito-idp.${backend.auth.resources.userPool.stack.region}.amazonaws.com/${backend.auth.resources.userPool.userPoolId}`,
  {
    jwtAudience: [backend.auth.resources.userPoolClient.userPoolClientId],
  }
);

const integration = new HttpLambdaIntegration(
  'AiChatLambdaIntegration',
  backend.aiChat.resources.lambda
);

api.addRoutes({
  path: '/chat',
  methods: [HttpMethod.GET, HttpMethod.POST],
  integration,
  authorizer,
});

api.addRoutes({
  path: '/chat',
  methods: [HttpMethod.OPTIONS],
  integration,
});

const defaultStage = api.defaultStage?.node.defaultChild as HttpCfnStage | undefined;
if (defaultStage) {
  defaultStage.defaultRouteSettings = {
    throttlingBurstLimit: 25,
    throttlingRateLimit: 10,
  };
}

backend.addOutput({
  custom: {
    aiChatUrl: api.apiEndpoint,
  },
});

