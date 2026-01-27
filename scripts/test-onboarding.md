# Testing Onboarding Flow

## Steps to Test:

1. **Clear Everything:**
   ```javascript
   // In browser console (F12):
   localStorage.clear();
   ```

2. **Delete the test account:**
   ```bash
   npm run delete-user gabrielakadzielawa@gmail.com
   ```

3. **Test the flow:**
   - Go to http://localhost:5173
   - Click "Start Free Trial"
   - Create account with email: gabrielakadzielawa@gmail.com
   - Verify email (check console for code or use AWS Cognito console)
   - Sign in with the new account
   - **Check browser console** - you should see:
     - ✅ Sign-in successful!
     - 📋 Profile completed status: null (or undefined)
     - 🔍 Checking if onboarding is needed...
     - ➡️ Redirecting to profile-setup for onboarding
   - You should be redirected to `/profile-setup`
   - **Check console again** - you should see:
     - ProfileSetup component mounted. Step: 1

4. **If you're NOT seeing the onboarding:**
   - Check browser console for any errors
   - Check the Network tab to see if there are any failed requests
   - Check if you're being redirected to `/dashboard` instead
   - Verify that `localStorage.getItem('profileCompleted')` is null/undefined

## Common Issues:

1. **Old localStorage data:** Make sure to clear localStorage before testing
2. **User already signed in:** The SignIn component should handle this, but if you see "already signed in" error, refresh the page
3. **ProtectedRoute blocking:** If ProfileSetup doesn't load, check if user is authenticated (check console for auth errors)

