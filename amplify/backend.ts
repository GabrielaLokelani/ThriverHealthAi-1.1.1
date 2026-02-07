import { defineBackend, secret } from '@aws-amplify/backend';
import { Table, AttributeType, BillingMode, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
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

const chatStack = backend.createStack('chat');

const chatMessagesTable = new Table(chatStack, 'ChatMessages', {
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
  timeToLiveAttribute: 'ttl',
});

chatMessagesTable.grantReadWriteData(backend.aiChat.resources.lambda);
backend.aiChat.addEnvironment('CHAT_TABLE_NAME', chatMessagesTable.tableName);
backend.aiChat.addEnvironment('COGNITO_USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
backend.aiChat.addEnvironment('XAI_API_URL', secret('XAI_API_URL'));
backend.aiChat.addEnvironment('XAI_API_KEY', secret('XAI_API_KEY'));
backend.aiChat.addEnvironment('XAI_MODEL', 'grok-4');
backend.aiChat.addEnvironment('REDIS_HOST', secret('REDIS_HOST'));
backend.aiChat.addEnvironment('REDIS_PORT', secret('REDIS_PORT'));
backend.aiChat.addEnvironment('REDIS_USERNAME', secret('REDIS_USERNAME'));
backend.aiChat.addEnvironment('REDIS_PASSWORD', secret('REDIS_PASSWORD'));
backend.aiChat.addEnvironment('REDIS_TLS', 'true');
backend.aiChat.addEnvironment('REDIS_TTL_SECONDS', '604800');
backend.aiChat.addEnvironment('REDIS_MESSAGE_LIMIT', '20');
backend.aiChat.addEnvironment('CORS_ORIGIN', secret('CORS_ORIGIN'));
backend.aiChat.addEnvironment('AI_SYSTEM_PROMPT', secret('AI_SYSTEM_PROMPT'));

const aiChatUrl = backend.aiChat.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    aiChatUrl: aiChatUrl.url,
  },
});

