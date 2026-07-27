import { Controller, Get, Header } from '@nestjs/common';

const PRIVACY_POLICY = `# Privacy Policy

**Effective Date:** July 27, 2026

## 1. Information We Collect
- **Account Information:** Email address, display name, date of birth, time zone, and native language.
- **Learning & Progress Data:** Exercise attempts, lesson completions, SRS memory model cards (stability, difficulty, due dates), XP, streak data, and gem counts.
- **Social & Messaging Data:** Direct messages sent to accepted friends, block lists, and friendship connections. Content of direct messages is stored solely for delivery and is never logged in server telemetry.
- **AI Chat Interactions:** Text input provided during scenario-based AI tutor sessions to generate responses and Japanese grammar/vocabulary feedback.
- **Safety Reports:** Reports submitted regarding user behavior or content errors.

## 2. How We Use Information
- To provide personalized adaptive learning schedules using Spaced Repetition Algorithms (FSRS).
- To enable peer-to-peer social interaction and leaderboards.
- To enforce age-appropriate safety controls (messaging restricted to users who meet the minimum age requirement).
- To maintain security and prevent abusive behavior.

## 3. Data Ownership & Deletion (GDPR / DPDP Compliance)
- You own your learning data.
- You can permanently delete your account and all associated data at any time via the \`DELETE /me\` endpoint or within account settings.
- Account deletion immediately and permanently erases your account profile, SRS cards, exercise history, chat sessions, direct messages, and social connections.

## 4. Contact & Inquiries
For privacy inquiries or data requests, contact support@langapp.example.com.
`;

const TERMS_OF_SERVICE = `# Terms of Service

**Effective Date:** July 27, 2026

## 1. Acceptable Use & Age Requirement
- You must be at least 13 years of age to register an account and use the service.
- Messaging and social features require an accurate date of birth meeting minimum age requirements.
- You agree not to send spam, abusive, harassing, or harmful content to other learners.

## 2. Learning Mechanics & Open Platform
- The platform operates on genuine learning principles — no hearts paywalls or artificial waiting periods.
- Free access to learning tools and content is guaranteed for all registered learners.

## 3. Account Security & Conduct
- You are responsible for maintaining the confidentiality of your account credentials.
- Accounts found violating community guidelines or engaging in harassment will be suspended or terminated.

## 4. Limitation of Liability
- Educational content and AI tutor explanations are provided "as is" for learning purposes.
`;

@Controller()
export class LegalController {
  @Get('privacy')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  getPrivacy(): string {
    return PRIVACY_POLICY;
  }

  @Get('terms')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  getTerms(): string {
    return TERMS_OF_SERVICE;
  }

  @Get('legal/privacy')
  getPrivacyJson(): { title: string; effectiveDate: string; content: string } {
    return {
      title: 'Privacy Policy',
      effectiveDate: '2026-07-27',
      content: PRIVACY_POLICY,
    };
  }

  @Get('legal/terms')
  getTermsJson(): { title: string; effectiveDate: string; content: string } {
    return {
      title: 'Terms of Service',
      effectiveDate: '2026-07-27',
      content: TERMS_OF_SERVICE,
    };
  }
}
