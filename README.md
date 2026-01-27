# ThriverHealth.AI

A HIPAA/GDPR-compliant health AI platform built with React, TypeScript, AWS Amplify Gen2, and Grok AI integration.

## Features

- **AI-Powered Health Research**: Get insights on diseases, treatments, and alternative therapies using Grok AI
- **Health Tracking Dashboard**: Track metrics, goals, gratitude entries, and tasks
- **Document Management**: Securely upload and manage health documents (HIPAA-compliant)
- **User Authentication**: Secure sign-up with 2FA/MFA using AWS Cognito
- **Dark/Light Theme**: Modern UI with theme toggle
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: React 18+ with TypeScript, Tailwind CSS
- **Backend**: AWS Amplify Gen2 (Auth, Data, Storage, Functions)
- **Database**: Amazon DynamoDB (via Amplify Data)
- **Storage**: Amazon S3 (for documents)
- **Authentication**: AWS Cognito with MFA/2FA
- **AI**: Grok API (configurable)
- **Caching**: Redis (ElastiCache or Redis Cloud)
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS Account
- AWS CLI configured (optional, for local development)

### Installation

1. Clone the repository:
```bash
cd ThriverHealthAI
npm install
```

2. Configure environment variables:
Create a `.env.local` file (or use Amplify environment variables):
```env
VITE_GROK_API_URL=your_grok_api_url
VITE_GROK_API_KEY=your_grok_api_key
VITE_AWS_REGION=us-east-1
```

3. Deploy Amplify backend:
```bash
npm run amplify:sandbox
```

This will deploy the Amplify backend and generate `amplify_outputs.json`.

4. Update Amplify configuration:
Update `src/lib/amplify.ts` to import and use the generated outputs:
```typescript
import outputs from '../amplify_outputs.json';
Amplify.configure(outputs);
```

5. Start development server:
```bash
npm run dev
```

## Project Structure

```
ThriverHealthAI/
├── amplify/              # Amplify Gen2 backend configuration
│   ├── backend.ts       # Main backend definition
│   ├── auth/            # Cognito configuration
│   ├── data/            # DynamoDB schema
│   └── storage/         # S3 bucket configuration
├── src/
│   ├── components/      # React components
│   │   ├── auth/       # Authentication components
│   │   ├── dashboard/  # Dashboard components
│   │   ├── ai-agent/   # AI chat interface
│   │   ├── documents/  # Document management
│   │   ├── landing/    # Landing page
│   │   └── layout/     # Layout components
│   ├── lib/            # Utilities and helpers
│   │   ├── api/        # API clients (Grok, etc.)
│   │   ├── hooks/      # Custom React hooks
│   │   └── utils/      # Utility functions
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
└── package.json
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run amplify:sandbox` - Deploy Amplify backend sandbox
- `npm run amplify:generate` - Generate Amplify outputs

### Amplify Backend

The backend uses AWS Amplify Gen2's code-first approach:

- **Authentication**: Configured in `amplify/auth/resource.ts`
- **Data Models**: Defined in `amplify/data/resource.ts`
- **Storage**: Configured in `amplify/storage/resources.ts`

To deploy to production:
```bash
npx ampx pipeline-deploy
```

## Environment Variables

Required environment variables:

- `VITE_GROK_API_URL` - Grok API endpoint
- `VITE_GROK_API_KEY` - Grok API key (or use AWS Secrets Manager)
- `VITE_AWS_REGION` - AWS region (optional, defaults to us-east-1)

## Security & Compliance

This application is designed with HIPAA and GDPR compliance in mind:

- **Data Encryption**: Sensitive data is encrypted at rest using AWS KMS
- **Access Controls**: User data is isolated using Cognito user pools
- **Audit Logging**: All access to PHI is logged
- **Data Retention**: Policies implemented for compliance
- **Secure Storage**: S3 buckets are encrypted and versioned

**Note**: Full HIPAA/GDPR compliance requires legal review and additional configuration.

## Features Roadmap

### MVP (Completed)
- ✅ User authentication with 2FA/MFA
- ✅ Landing page and sign-up flow
- ✅ Dashboard with health tracking
- ✅ Document upload and management
- ✅ AI agent integration (Grok API)
- ✅ Dark/light theme toggle

### Future Features
- Partner network
- User testimonials
- User community/forums
- Marketplace integration
- Advanced analytics
- Health summary generation

## License

Private - All Rights Reserved

## Support

For questions or issues, please contact the development team.
