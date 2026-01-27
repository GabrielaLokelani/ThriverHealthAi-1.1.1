# Next Steps Checklist

Use this checklist to track your progress through the deployment and setup process.

## ✅ Completed (MVP Implementation)

- [x] Project setup (React + TypeScript + Vite)
- [x] Amplify Gen2 backend configuration files
- [x] Authentication components (SignUp, SignIn, ProfileSetup)
- [x] Landing page with banner
- [x] Dashboard components
- [x] Document upload components
- [x] AI Agent chat interface
- [x] Theme system (dark/light mode)
- [x] All UI components and styling

## 🔄 To Do

### Step 1: Deploy Amplify Backend

- [ ] Configure AWS credentials (`aws configure` or `aws sso login`)
- [ ] Verify AWS access: `aws sts get-caller-identity`
- [ ] Run `npm run amplify:sandbox`
- [ ] Wait for deployment to complete (~5-10 minutes)
- [ ] Verify `amplify_outputs.json` was generated
- [ ] Update `src/lib/amplify.ts` to import and use the outputs
- [ ] Test that the app can connect to AWS services

### Step 2: Configure Grok API

- [ ] Obtain Grok API credentials
- [ ] Create `.env.local` file from `.env.local.example`
- [ ] Add your Grok API URL and key
- [ ] Restart dev server to load environment variables
- [ ] Test API connection (will need backend deployed first)

### Step 3: Connect Data Components

- [ ] Run `npm run amplify:generate` to generate data client
- [ ] Update `src/lib/data-client.ts` with generated client
- [ ] Update dashboard components to use data client:
  - [ ] GoalsTracker - CRUD operations
  - [ ] GratitudeJournal - Create/Read entries
  - [ ] TasksManager - CRUD operations
  - [ ] MetricsWidget - Create/Read metrics
  - [ ] HealthSummary - Read/Generate summaries
- [ ] Update document components to use S3 storage
- [ ] Update auth components to save user profile data
- [ ] Test all CRUD operations

### Step 4: Add Logo

- [ ] Obtain logo file (SVG, PNG, or JPG)
- [ ] Place logo in `public/` directory
- [ ] Update `src/components/landing/LandingPage.tsx`
- [ ] Update `src/components/layout/Header.tsx`
- [ ] Test logo displays correctly in both themes
- [ ] Verify logo looks good on mobile

### Step 5: Testing

- [ ] Test sign-up flow:
  - [ ] Create new account
  - [ ] Verify email
  - [ ] Complete profile setup
- [ ] Test sign-in:
  - [ ] Sign in with credentials
  - [ ] Test 2FA/MFA (if enabled)
- [ ] Test dashboard:
  - [ ] View all widgets
  - [ ] Create a goal
  - [ ] Add gratitude entry
  - [ ] Create a task
  - [ ] View metrics (if any)
- [ ] Test document upload:
  - [ ] Upload a PDF
  - [ ] Upload an image
  - [ ] View document list
  - [ ] Download a document
  - [ ] Delete a document
- [ ] Test AI agent:
  - [ ] Send a message
  - [ ] Verify response (requires Grok API)
  - [ ] Check conversation history
- [ ] Test theme toggle:
  - [ ] Switch to dark mode
  - [ ] Switch to light mode
  - [ ] Verify persistence on refresh
- [ ] Test responsive design:
  - [ ] Test on mobile (narrow viewport)
  - [ ] Test on tablet
  - [ ] Test on desktop
- [ ] Test navigation:
  - [ ] Navigate between all pages
  - [ ] Test protected routes
  - [ ] Test sign out

### Step 6: Production Deployment (Later)

- [ ] Set up production AWS account
- [ ] Configure production environment variables
- [ ] Run `npx ampx pipeline-deploy` for production
- [ ] Set up custom domain (if applicable)
- [ ] Configure SSL certificates
- [ ] Set up monitoring and logging
- [ ] Security audit
- [ ] HIPAA/GDPR compliance review
- [ ] Performance testing
- [ ] Load testing

## Notes

- **Step 1 is required** before Steps 3 and 5 can be completed
- **Step 2** can be done anytime but needs Step 1 for full testing
- **Step 4** can be done at any time
- Start with **Step 1** - deploying the Amplify backend is the critical path

## Quick Commands Reference

```bash
# Deploy Amplify backend (sandbox)
npm run amplify:sandbox

# Generate Amplify data client
npm run amplify:generate

# Start development server
npm run dev

# Build for production
npm run build

# Check AWS credentials
aws sts get-caller-identity

# View Amplify outputs (after deployment)
cat amplify_outputs.json
```

