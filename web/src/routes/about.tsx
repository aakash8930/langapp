import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/about')({ component: () => (
  <InfoPage title="About GENKŌ" backTo="/">
    <h2>Our Mission</h2>
    <p>GENKŌ was built to make Japanese literacy accessible to everyone. We combine evidence-based learning methods — spaced repetition, active recall, and AI-powered conversation practice — with a beautiful, distraction-free interface designed for serious learners.</p>
    <h2>Why Japanese?</h2>
    <p>Japanese is one of the most rewarding languages to learn — and one of the hardest. The writing system alone (hiragana, katakana, and thousands of kanji) demands a different approach than European languages. GENKŌ was purpose-built for this challenge from day one.</p>
  </InfoPage>
)});
