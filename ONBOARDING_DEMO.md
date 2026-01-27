# ThriverHealth.AI Onboarding Process Demo

## Overview
The onboarding process consists of 4 steps that guide new users through account creation, profile setup, and policy acceptance.

---

## Step-by-Step Walkthrough

### **Step 1: Account Creation (Sign Up)**

**Location:** Landing Page → "Start Free Trial" button

**What happens:**
1. User clicks "Start Free Trial" on the landing page
2. Navigates to `/signup` page
3. User fills out the signup form:
   - **Email address** (required)
   - **Password** (required, minimum 8 characters)
   - **Confirm Password** (required, must match)
4. User clicks "Sign up" button
5. System validates:
   - Password length (minimum 8 characters)
   - Password match confirmation
   - Email format

**Next Step:** After successful signup, user is redirected to email verification

---

### **Step 2: Email Verification**

**Location:** `/confirm-signup` page

**What happens:**
1. User receives a verification code via email
2. User enters the 6-digit verification code
3. User clicks "Verify Email" button
4. Upon successful verification:
   - User sees success message
   - Automatically redirected to sign-in page after 2 seconds

**Next Step:** User signs in with their credentials

---

### **Step 3: Sign In**

**Location:** `/signin` page

**What happens:**
1. User enters:
   - **Email address**
   - **Password**
2. User clicks "Sign in" button
3. System checks if profile is completed:
   - If profile is NOT completed → Redirects to `/profile-setup`
   - If profile IS completed → Redirects to `/dashboard`

**Next Step:** Profile Setup (for new users)

---

### **Step 4: Profile Setup - Multi-Step Form**

**Location:** `/profile-setup` page

The profile setup is a 4-step wizard that collects user information:

#### **Step 4.1: Basic Information**

**Fields:**
- **Full Name** (required) - Text input
- **Date of Birth** (required) - Date picker

**Navigation:**
- "Next" button to proceed
- Validation ensures both fields are filled

**Progress Indicator:** "Step 1 of 4: Basic Information"

---

#### **Step 4.2: Health Information**

**Fields:**
- **Disease/Condition** (optional) - Text input
  - Placeholder: "e.g., Cancer, Diabetes, etc."
- **Diagnosis Details** (optional) - Textarea (3 rows)
  - Placeholder: "Provide details about your diagnosis..."
- **Current Treatments** (optional) - Textarea (3 rows)
  - Placeholder: "List any current treatments or medications..."
- **Initial Symptoms** (optional) - Textarea (3 rows)
  - Placeholder: "Describe your initial symptoms..."

**Navigation:**
- "Previous" button to go back
- "Next" button to proceed

**Progress Indicator:** "Step 2 of 4: Health Information"

---

#### **Step 4.3: Treatment Goals**

**Fields:**
- **Treatment Goals** (optional) - Textarea (4 rows)
  - Placeholder: "What are your goals for treatment? What outcomes are you hoping to achieve?"

**Navigation:**
- "Previous" button to go back
- "Next" button to proceed

**Progress Indicator:** "Step 3 of 4: Treatment Goals"

---

#### **Step 4.4: Policies & Agreements** ⭐ NEW

**What happens:**
1. User sees an informational banner explaining the importance of reviewing policies
2. Two expandable policy sections:

   **Privacy Policy:**
   - Checkbox: "I have read and accept the Privacy Policy" (required)
   - Clickable link to expand and view full Privacy Policy text
   - Scrollable text area with complete policy content
   - Includes sections on:
     - Information collection
     - Data usage
     - Data sharing
     - Security measures
     - User rights (GDPR, CCPA)
     - HIPAA notice
     - Contact information

   **Terms of Use:**
   - Checkbox: "I have read and accept the Terms of Use" (required)
   - Clickable link to expand and view full Terms of Use text
   - Scrollable text area with complete terms content
   - Includes sections on:
     - Acceptance of terms
     - Eligibility (18+)
     - Platform content disclaimers
     - Medical advice disclaimers
     - Limitation of liability
     - Governing law
     - Contact information

3. **Validation:**
   - Both checkboxes must be checked to proceed
   - Error message displays if user tries to submit without accepting both
   - "Complete Setup" button is disabled until both are accepted

**Navigation:**
- "Previous" button to go back
- "Complete Setup" button (disabled until both policies accepted)

**Progress Indicator:** "Step 4 of 4: Policies & Agreements"

---

### **Step 5: Completion**

**What happens:**
1. User clicks "Complete Setup" button
2. System saves:
   - All profile data to `localStorage` (temporary, until backend connected)
   - Policy acceptance with timestamp to `localStorage` for audit trail
   - Profile completion flag
3. User is redirected to `/dashboard`
4. User can now access all features of the application

---

## Key Features of the Onboarding Flow

### ✅ **User Experience**
- **Progress Indicator:** Shows current step (e.g., "Step 2 of 4")
- **Clear Navigation:** Previous/Next buttons for easy navigation
- **Validation:** Real-time validation with helpful error messages
- **Responsive Design:** Works on all screen sizes
- **Dark Mode Support:** Full dark/light theme support

### ✅ **Data Collection**
- **Basic Info:** Name, Date of Birth
- **Health Data:** Disease, Diagnosis, Treatments, Symptoms
- **Goals:** Treatment goals and desired outcomes
- **Policy Acceptance:** Privacy Policy and Terms of Use acceptance with timestamps

### ✅ **Security & Compliance**
- **Password Requirements:** Minimum 8 characters
- **Email Verification:** Required before profile setup
- **Policy Acceptance:** Required before account activation
- **Audit Trail:** Policy acceptance timestamps stored
- **HIPAA/GDPR Ready:** Policies include compliance information

### ✅ **Error Handling**
- Password mismatch detection
- Required field validation
- Policy acceptance validation
- Clear error messages
- Form state preservation

---

## Technical Implementation

### **Components:**
- `SignUp.tsx` - Account creation form
- `ConfirmSignUp.tsx` - Email verification
- `SignIn.tsx` - Sign in with profile check
- `ProfileSetup.tsx` - Multi-step profile wizard
- `PolicyAcceptance.tsx` - Policy display and acceptance component

### **Data Storage:**
- **localStorage keys:**
  - `userProfile` - Complete profile data
  - `policyAcceptance` - Policy acceptance with timestamp
  - `profileCompleted` - Boolean flag

### **Navigation Flow:**
```
Landing Page → Sign Up → Email Verification → Sign In → Profile Setup (4 steps) → Dashboard
```

---

## Demo Notes

To test the full onboarding flow:
1. Start from the landing page
2. Create a new account
3. Verify email (check console/email for code in development)
4. Sign in
5. Complete all 4 profile setup steps
6. Accept both policies
7. Access the dashboard

The onboarding process ensures users understand the platform's policies and provide necessary health information to personalize their AI health assistant experience.

