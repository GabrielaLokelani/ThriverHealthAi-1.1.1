# Deployment Guide

## Step 1: Deploy Amplify Backend

Before deploying, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI configured** with credentials:
   ```bash
   aws configure
   ```
   Or if using AWS SSO:
   ```bash
   aws sso login
   ```

3. **Deploy the backend**:
   ```bash
   npm run amplify:sandbox
   ```

   This will:
   - Create Cognito User Pool with MFA
   - Create DynamoDB tables for all data models
   - Create S3 bucket for document storage
   - Generate `amplify_outputs.json` file

4. **After deployment**, update `src/lib/amplify.ts` to import and use the generated outputs:
   ```typescript
   import { Amplify } from 'aws-amplify';
   import outputs from '../amplify_outputs.json';
   
   Amplify.configure(outputs);
   ```

**Note**: The sandbox deployment can take 5-10 minutes the first time.

## Step 2: Configure Grok API

1. Create a `.env.local` file in the root directory:
   ```env
   VITE_GROK_API_URL=https://api.x.ai/v1
   VITE_GROK_API_KEY=your_api_key_here
   VITE_AWS_REGION=us-east-1
   ```

2. Replace `your_api_key_here` with your actual Grok API key

3. **Important**: Never commit `.env.local` to git (it's already in `.gitignore`)

4. For production, use AWS Secrets Manager or Amplify environment variables

## Step 3: Connect Data Components

After the backend is deployed, update components to use Amplify Data client:

1. Generate the data client types:
   ```bash
   npm run amplify:generate
   ```

2. Update components to use the generated client (see examples in the code comments)

## Step 4: Add Logo

Replace the logo placeholder in:
- `src/components/landing/LandingPage.tsx` (around line with "TH" placeholder)
- `src/components/layout/Header.tsx` (around line with "TH" placeholder)

## Step 5: Testing

1. Test sign-up flow
2. Test sign-in with 2FA
3. Test dashboard components
4. Test document upload
5. Test AI agent chat
6. Test theme toggle
7. Test responsive design on mobile

## Troubleshooting

### Amplify deployment fails
- Check AWS credentials: `aws sts get-caller-identity`
- Ensure you have permissions for: Cognito, DynamoDB, S3, IAM, CloudFormation
- Check AWS region configuration

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Clear node_modules and reinstall if needed: `rm -rf node_modules package-lock.json && npm install`

### Runtime errors
- Check browser console for error messages
- Verify `amplify_outputs.json` exists after deployment
- Check that environment variables are set correctly

