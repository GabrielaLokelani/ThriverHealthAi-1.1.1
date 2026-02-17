# HIPAA Production Checklist

This checklist separates technical controls in code/infrastructure from operational controls required for HIPAA readiness.

## Implemented technical controls

- API auth enforced with Cognito JWT on `GET /chat` and `POST /chat`.
- Strict CORS allowlist for local development and production domains only.
- Redis transport uses TLS and cached chat payloads are encrypted before storage (AES-256-GCM).
- Redis cache fails closed for encryption key issues and fails open for runtime outages (chat still works via DynamoDB path).
- Chat data at rest in DynamoDB is encrypted with a customer-managed KMS key (CMK) with key rotation enabled.
- DynamoDB point-in-time recovery is enabled.
- Lambda log retention policy is set to 90 days.
- Upstream AI calls are constrained with explicit timeouts and bounded context payload sizes.

## Must-complete operational controls before PHI production

- Confirm active AWS BAA covers all services used by the app.
- Confirm xAI/LLM vendor contractual terms and PHI policy meet your compliance requirements.
- Define and document minimum necessary PHI policy for prompts and outputs.
- Enable centralized audit log review workflow and alerting for auth/data anomalies.
- Establish incident response and breach notification runbook with named owners.
- Enforce least-privilege IAM review for all Amplify-generated and custom roles.
- Enforce secret rotation cadence and ownership (XAI key, Redis credentials, encryption keys).
- Run penetration test and dependency vulnerability scan before launch.

## Recommended next technical steps

- Add AWS WAF in front of chat API with rate limits and bot protections.
- Add CloudWatch alarms for Lambda errors/timeouts and API 4xx/5xx spikes.
- Add structured audit event logging for sensitive operations (message send, profile updates, exports).
- Add data retention/lifecycle policy for chat records aligned with your legal policy.
- Add periodic key-rotation verification checks to CI for required secrets.

## Automated guardrail check

- Run `npm run security:guardrails` to validate encryption, log retention, Redis encryption key presence, and CORS allowlist.
- For one-command sandbox deploy plus verification, run `npm run amplify:sandbox:secure`.
- Set `AMPLIFY_AI_CHAT_FUNCTION_NAME` if automatic Lambda discovery does not find the correct function.

## GitHub automation

- Workflow file: `.github/workflows/security-guardrails.yml`
- Runs guardrails automatically on pull requests to `main` and pushes to `main`.
- Optional manual secure deploy is available through workflow dispatch.
- Required repository secret: `AWS_GUARDRAILS_ROLE_ARN` (IAM role ARN trusted for GitHub OIDC).
- Optional deploy repository secret: `AWS_DEPLOY_ROLE_ARN` (separate higher-privilege deploy role for `ampx sandbox --once`).
- Optional repository variable: `AWS_REGION` (defaults to `us-east-1`).
