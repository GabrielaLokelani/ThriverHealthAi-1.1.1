#!/usr/bin/env node
import { execSync } from 'node:child_process';

const region = process.env.AWS_REGION || 'us-east-1';
const expectedLogRetentionDays = Number(process.env.SECURITY_EXPECTED_LOG_RETENTION_DAYS || 90);
const expectedOrigins = (
  process.env.SECURITY_EXPECTED_CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,https://thriverhealth.ai,https://www.thriverhealth.ai'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const errors = [];
const warnings = [];
const passes = [];

function runAws(args, parseJson = true) {
  const command = `aws ${args} --region ${region}`;
  const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  if (!parseJson) return output;
  if (!output) return null;
  return JSON.parse(output);
}

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  errors.push(message);
}

function resolveAiChatLambdaName() {
  if (process.env.AMPLIFY_AI_CHAT_FUNCTION_NAME) {
    return process.env.AMPLIFY_AI_CHAT_FUNCTION_NAME;
  }

  const namesRaw = runAws(
    "lambda list-functions --query \"Functions[?contains(FunctionName, 'aichatlambda') && contains(FunctionName, 'amplify-thriverhealthai')].FunctionName\" --output json"
  );
  const names = Array.isArray(namesRaw) ? namesRaw : [];
  if (!names.length) {
    throw new Error(
      'Could not find ai-chat Lambda automatically. Set AMPLIFY_AI_CHAT_FUNCTION_NAME and rerun.'
    );
  }
  return names[0];
}

function getSsmPath(ssmConfigJson, keyName) {
  try {
    const parsed = JSON.parse(ssmConfigJson || '{}');
    return parsed?.[keyName]?.path || parsed?.[keyName]?.sharedPath || null;
  } catch {
    return null;
  }
}

function check() {
  const functionName = resolveAiChatLambdaName();
  pass(`Resolved ai-chat Lambda: ${functionName}`);

  const lambdaConfig = runAws(
    `lambda get-function-configuration --function-name "${functionName}" --output json`
  );
  const variables = lambdaConfig?.Environment?.Variables || {};

  if ((lambdaConfig?.Timeout || 0) >= 30) {
    pass(`Lambda timeout is ${lambdaConfig.Timeout}s`);
  } else {
    fail(`Lambda timeout is ${lambdaConfig?.Timeout || 0}s (expected >= 30s)`);
  }

  if ((lambdaConfig?.MemorySize || 0) >= 1024) {
    pass(`Lambda memory is ${lambdaConfig.MemorySize} MB`);
  } else {
    fail(`Lambda memory is ${lambdaConfig?.MemorySize || 0} MB (expected >= 1024 MB)`);
  }

  const logGroupName = lambdaConfig?.LoggingConfig?.LogGroup || `/aws/lambda/${functionName}`;
  const logGroup = runAws(
    `logs describe-log-groups --log-group-name-prefix "${logGroupName}" --query "logGroups[0]" --output json`
  );
  const retentionDays = logGroup?.retentionInDays || 0;
  if (retentionDays >= expectedLogRetentionDays) {
    pass(`CloudWatch log retention is ${retentionDays} days`);
  } else {
    fail(
      `CloudWatch log retention is ${retentionDays || 'not set'} (expected >= ${expectedLogRetentionDays})`
    );
  }

  const tableName = variables.CHAT_TABLE_NAME;
  if (!tableName) {
    fail('CHAT_TABLE_NAME is missing from Lambda environment');
  } else {
    const table = runAws(`dynamodb describe-table --table-name "${tableName}" --output json`);
    const sse = table?.Table?.SSEDescription || {};
    if (sse.Status === 'ENABLED' && sse.SSEType === 'KMS' && sse.KMSMasterKeyArn) {
      pass('DynamoDB chat table uses KMS encryption');
      const rotation = runAws(
        `kms get-key-rotation-status --key-id "${sse.KMSMasterKeyArn}" --output json`
      );
      if (rotation?.KeyRotationEnabled) {
        pass('KMS key rotation is enabled');
      } else {
        fail('KMS key rotation is disabled');
      }
    } else {
      fail('DynamoDB chat table is not using customer-managed KMS encryption');
    }

    const backups = runAws(
      `dynamodb describe-continuous-backups --table-name "${tableName}" --output json`
    );
    const pitr =
      backups?.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus;
    if (pitr === 'ENABLED') {
      pass('DynamoDB point-in-time recovery is enabled');
    } else {
      fail(`DynamoDB point-in-time recovery is ${pitr || 'unknown'} (expected ENABLED)`);
    }
  }

  const redisEnabled = variables.REDIS_ENABLED !== 'false';
  if (redisEnabled) {
    const ssmConfig = variables.AMPLIFY_SSM_ENV_CONFIG || '{}';
    const redisKeyPath = getSsmPath(ssmConfig, 'REDIS_ENCRYPTION_KEY');
    if (!redisKeyPath) {
      fail('REDIS_ENCRYPTION_KEY is not configured in Amplify SSM config');
    } else {
      try {
        runAws(`ssm get-parameter --name "${redisKeyPath}" --output json`);
        pass('REDIS_ENCRYPTION_KEY exists in SSM');
      } catch {
        fail('REDIS_ENCRYPTION_KEY parameter is missing in SSM');
      }
    }
  } else {
    warn('Redis is disabled (safe fallback mode active).');
  }

  if ((variables.XAI_API_URL || '').startsWith('<value will be resolved')) {
    pass('XAI_API_URL is sourced from secure parameter store');
  } else if ((variables.XAI_API_URL || '').startsWith('https://')) {
    pass('XAI_API_URL is HTTPS');
  } else {
    fail('XAI_API_URL is not HTTPS');
  }

  const apis = runAws('apigatewayv2 get-apis --output json');
  const aiApi = (apis?.Items || []).find((item) => item?.Name === 'ai-chat-api');
  if (!aiApi) {
    fail('Could not find API Gateway API named ai-chat-api');
  } else {
    const cors = aiApi.CorsConfiguration || {};
    const allowOrigins = cors.AllowOrigins || [];
    if (allowOrigins.includes('*')) {
      fail('API Gateway CORS allowOrigins includes wildcard (*)');
    } else {
      const missing = expectedOrigins.filter((origin) => !allowOrigins.includes(origin));
      if (missing.length) {
        warn(`API Gateway CORS missing expected origins: ${missing.join(', ')}`);
      } else {
        pass('API Gateway CORS uses strict allowlist');
      }
    }
  }
}

try {
  check();
} catch (error) {
  fail(`Guardrail check failed to run: ${String(error.message || error)}`);
}

for (const message of passes) {
  console.log(`[PASS] ${message}`);
}
for (const message of warnings) {
  console.log(`[WARN] ${message}`);
}
for (const message of errors) {
  console.error(`[FAIL] ${message}`);
}

if (errors.length > 0) {
  process.exit(1);
}

console.log(`Security guardrails passed (${passes.length} checks${warnings.length ? `, ${warnings.length} warnings` : ''}).`);
