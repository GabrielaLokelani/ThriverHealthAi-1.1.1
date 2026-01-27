import { useState } from 'react';

interface PolicyAcceptanceProps {
  onPrivacyAccept: (accepted: boolean) => void;
  onTermsAccept: (accepted: boolean) => void;
  privacyAccepted: boolean;
  termsAccepted: boolean;
}

const PRIVACY_POLICY = `ThriverHealth.Ai Privacy Policy
Effective Date: December 21, 2025

At ThriverHealth.Ai, Inc. (referred to as "we," "us," "our," or "Company"), we are deeply committed to protecting your privacy and handling your personal information responsibly, in line with our mission to empower users on their thriver journeys through ethical, transparent practices. This Privacy Policy explains how we collect, use, disclose, protect, and retain your information when you access or use our mobile application, website, and related services (collectively, the "Platform"). It applies to all users, including those sharing health anecdotes, practitioners contributing insights, and partners in our marketplace.

By using the Platform, you consent to the practices described herein. Our Terms of Use (available at [Insert Link, e.g., https://www.thriverhealth.ai/terms-of-use]) govern overall use and reference this Policy. We may update this Policy at any time; material changes will be notified via the Platform, email, or in-app alerts. Your continued use constitutes acceptance. Review periodically.

1. Information We Collect
We collect information to deliver personalized, valuable services like curated health content, community interactions, marketplace features, and individualized programs or e-books. Categories include:
• Personal Identifiers: Name, email address, username, password, age, gender, location (e.g., city, state, country), phone number, or other details provided during registration or profile creation.
• Health and Sensitive Information: Voluntarily shared details about your health conditions, diagnoses, symptoms, treatments (conventional or alternative), abilities, resources, lifestyle choices, dietary preferences, or other sensitive data (e.g., for generating individualized programs). This may include crowdsourced anecdotes or expert contributions.
• User Content and Interactions: Posts, comments, forum discussions, uploaded media (e.g., images of health progress), or shared anecdotes.
• Transaction and Financial Data: Payment details (e.g., credit card info, processed via secure third-party providers like Stripe), purchase history, shipping addresses, or billing information for marketplace transactions.
• Usage and Device Data: Automatically collected via cookies, web beacons, pixels, or similar technologies: IP address, device type/ID, browser type, operating system, access times, pages viewed, referral sources, interactions (e.g., clicks, searches), and inferred preferences.
• Location Data: Approximate location from IP or device settings (with consent) to tailor content (e.g., local practitioners).
• Inferred or Derived Data: Insights derived from your inputs (e.g., health trends from program data) or aggregated analytics.
• Third-Party Data: Information from partners, vendors, social logins (e.g., Google), or integrations (e.g., if you link fitness apps).
We minimize collection to what's necessary and anonymize/de-identify where possible (e.g., for research aggregates).

2. How We Collect Information
• Directly from You: Through registration forms, surveys, forum posts, data uploads for programs, marketplace checkouts, or support inquiries.
• Automatically: Via tracking technologies like cookies (essential for functionality, analytics for improvements, marketing for personalized ads). You can manage preferences via browser settings or our cookie banner; however, disabling may limit features. We use tools like Google Analytics (subject to their policies).
• From Third Parties: Analytics providers, payment processors, advertising networks, or partners (e.g., practitioner-verified data). If you connect external accounts, we collect authorized data.

3. How We Use Your Information
We use information ethically to support your thriver journey:
• Provide and personalize services (e.g., curating content on therapies, generating e-books based on your condition/age).
• Facilitate community interactions, marketplace transactions, and crowdsourced summaries.
• Improve the Platform (e.g., analyzing usage trends, debugging, A/B testing—using anonymized data).
• Communicate (e.g., newsletters, updates, support responses—with opt-out options).
• Conduct research (aggregated/de-identified, e.g., therapy efficacy insights).
• Comply with laws, enforce Terms, prevent fraud/abuse, or protect rights/safety.
• Marketing (with consent), such as tailored recommendations or partner promotions.

4. How We Share Your Information
We share sparingly, with safeguards:
• Service Providers: Vendors for hosting, analytics, payments, email, or moderation (bound by contracts limiting use).
• Partners and Vendors: Anonymized/aggregated data with practitioners, facilities, or retailers to enhance content/marketplace (e.g., trend insights). No identifiable health data without consent.
• Legal/Compliance: If required by law, subpoena, court order, or to prevent harm (e.g., fraud, emergencies).
• Business Transfers: In mergers, acquisitions, or sales (with notice where possible).
• With Your Consent: E.g., public forum shares or explicit opt-ins for partner communications.
• Aggregated/De-Identified: For research or benchmarking (not re-identifiable).
We do not sell personal information (as defined under CCPA).

5. Data Security and Retention
We employ industry-standard measures: encryption (in transit/rest), access controls, firewalls, regular audits, and employee training. For health data, we use enhanced protocols (e.g., pseudonymization). In breaches, we notify affected users/authorities per laws (e.g., within 72 hours under GDPR).

6. Your Privacy Rights and Choices
You control your data:
• Access/Correct/Delete: Request your information, updates, or erasure.
• Opt-Outs: Marketing emails (unsubscribe links), cookies (banner/settings), sharing (via account).
• Portability: Receive data in structured format.
• Withdraw Consent: Anytime, though it may limit services.
To exercise: Email privacy@thriverhealth.ai with verification.

7. Contact Us
Questions or concerns? Email privacy@thriverhealth.ai or mail: ThriverHealth.Ai, LLC, PO BOX 820, Honolulu, Hawaii 96808.

By using the Platform, you acknowledge understanding this Policy.`;

const TERMS_OF_USE = `ThriverHealth.Ai Terms of Use
Effective Date: December 21, 2025

Welcome to ThriverHealth.Ai (the "Platform"), operated by ThriverHealth.Ai, Inc. (referred to as "we," "us," "our," or "Company"). These Terms of Use ("Terms") govern your access to and use of our mobile application, website, and related services (collectively, the "Platform"). By accessing or using the Platform, creating an account, clicking "I Agree," or otherwise indicating acceptance, you agree to be bound by these Terms, as well as any additional guidelines, rules, or policies we may provide (e.g., Community Guidelines or Marketplace Rules, incorporated herein by reference). Our Privacy Policy (available at [Insert Link, e.g., https://www.thriverhealth.ai/privacy-policy]) governs data handling and is separate but complementary—please review it carefully.

If you do not agree to these Terms, you must not access or use the Platform. We may revise these Terms at any time by posting updates on the Platform or notifying you via email or in-app alerts. Your continued use after such changes constitutes acceptance. It is your responsibility to review periodically.

1. Acceptance of Terms
Your use of the Platform constitutes your agreement to these Terms. If you are using the Platform on behalf of an entity (e.g., a healthcare practitioner or organization), you represent that you have authority to bind that entity, and "you" refers to both you and the entity.

2. Eligibility and Account Registration
• You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Platform. The Platform is not intended for children under 18, and we do not knowingly collect personal information from them.
• To access features like community forums, individualized programs, marketplace, or data uploads, you must register an account with accurate, current information. You are responsible for safeguarding your credentials and all activities under your account, including unauthorized access.

3. Platform Content and Services
The Platform offers informational resources on health conditions, conventional treatments, alternative/adjunct therapies, lifestyle strategies, and more. All content is educational and informational only—not medical advice. Services may evolve; we will notify users of material changes.

4. User Content and Submissions
You may submit content ("User Content"), such as posts, comments, health anecdotes, images, videos, audio, or data uploads. You retain ownership but grant us a worldwide, perpetual, irrevocable, royalty-free, sublicensable license to use, reproduce, modify, distribute, display, analyze, and create derivative works from it in connection with the Platform.

5. Medical, Health, and Data Disclaimers
IMPORTANT: THE PLATFORM DOES NOT PROVIDE MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT.
• All content, including on conventional/alternative therapies, anecdotes, programs, or e-books, is for general informational/educational purposes only. It is not a substitute for professional medical advice from qualified healthcare providers.
• Alternative therapies may lack peer-reviewed evidence; we make no representations on safety, efficacy, or suitability. Always consult physicians before changes to treatment, diet, supplements, or lifestyle. Do not delay seeking care or disregard professional advice based on Platform information.
• For emergencies, contact your doctor, call 911, or seek immediate help.
• AI-generated content may contain errors, biases, or inaccuracies; no warranties on accuracy, completeness, timeliness, or fitness.
• Reliance on any information is at your sole risk. We disclaim all warranties, express or implied.

6. Limitation of Liability
TO THE FULLEST EXTENT PERMITTED BY LAW:
• The Platform is provided "AS IS" and "AS AVAILABLE" without warranties.
• We, our affiliates, officers, directors, employees, agents, partners, licensors, and vendors shall not be liable for indirect, incidental, special, consequential, punitive, or exemplary damages arising from use, content, Third-Party Materials, or interruptions.
• Our total liability is limited to the greater of $20 or amounts you paid us in the prior 2 months.

7. Governing Law and Dispute Resolution
• These Terms are governed by the laws of the State of Delaware, U.S., without conflict principles.
• Disputes shall be resolved through binding arbitration in Honolulu, Hawaii, under American Arbitration Association rules.

8. Contact
Questions to legal@thriverhealth.ai or PO BOX 820, Honolulu, Hawaii 96808.

By using the Platform, you acknowledge reading, understanding, and agreeing to these Terms.`;

export function PolicyAcceptance({ 
  onPrivacyAccept, 
  onTermsAccept, 
  privacyAccepted, 
  termsAccepted 
}: PolicyAcceptanceProps) {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);

  const handlePrivacyChange = (checked: boolean) => {
    onPrivacyAccept(checked);
  };

  const handleTermsChange = (checked: boolean) => {
    onTermsAccept(checked);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Important:</strong> Please review and accept our Privacy Policy and Terms of Use to continue. These documents outline how we protect your data and the terms governing your use of ThriverHealth.Ai.
        </p>
      </div>

      {/* Privacy Policy */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="privacy-policy"
              checked={privacyAccepted}
              onChange={(e) => handlePrivacyChange(e.target.checked)}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              required
            />
            <label
              htmlFor="privacy-policy"
              className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
            >
              I have read and accept the{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyPolicy(!showPrivacyPolicy)}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Privacy Policy
              </button>
              <span className="text-red-500">*</span>
            </label>
          </div>
        </div>

        {showPrivacyPolicy && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-96 overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300 font-sans">
                {PRIVACY_POLICY}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Terms of Use */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="terms-of-use"
              checked={termsAccepted}
              onChange={(e) => handleTermsChange(e.target.checked)}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              required
            />
            <label
              htmlFor="terms-of-use"
              className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
            >
              I have read and accept the{' '}
              <button
                type="button"
                onClick={() => setShowTermsOfUse(!showTermsOfUse)}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Terms of Use
              </button>
              <span className="text-red-500">*</span>
            </label>
          </div>
        </div>

        {showTermsOfUse && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-96 overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300 font-sans">
                {TERMS_OF_USE}
              </pre>
            </div>
          </div>
        )}
      </div>

      {(!privacyAccepted || !termsAccepted) && (
        <p className="text-sm text-red-600 dark:text-red-400">
          You must accept both the Privacy Policy and Terms of Use to continue.
        </p>
      )}
    </div>
  );
}

