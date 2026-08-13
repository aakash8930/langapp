import { Link } from '@tanstack/react-router';

import './exam.css';

const QUIZZES = [
  { title: 'Kana Quiz', detail: 'Recognize and read hiragana and katakana from the course corpus.', to: '/hiragana-reading' as const, tag: 'Kana' },
  { title: 'Kanji Quiz', detail: 'Test readings, meanings, and vocabulary connections.', to: '/kanji-quiz' as const, tag: 'Kanji' },
  { title: 'Grammar Quiz', detail: 'Practice grammar patterns with course-backed exercises.', to: '/grammar-quiz' as const, tag: 'Grammar' },
  { title: 'Listening Quiz', detail: 'Understand short course audio and select the best response.', to: '/listening-quiz' as const, tag: 'Listening' },
  { title: 'Mixed Practice', detail: 'Build a flexible session across available skills.', to: '/mixed-practice' as const, tag: 'Mixed' },
  { title: 'Timed Practice', detail: 'Work against the clock with server-graded exercises.', to: '/timed-practice' as const, tag: 'Timed' },
];

export function QuizLibrary() {
  return <div className="page exam-page"><header className="page-head"><p className="exam-kicker">COURSE-BACKED ASSESSMENT</p><h1 className="page-title">Quizzes</h1><p className="page-sub">Choose a skill quiz for focused feedback, or use Exams for formal timed assessments.</p></header><div className="exam-library">{QUIZZES.map(quiz => <article className="glass exam-card" key={quiz.title}><div className="exam-card-top"><span>{quiz.tag}</span><span className="exam-pass">Practice mode</span></div><h2>{quiz.title}</h2><p>{quiz.detail}</p><Link className="btn btn-primary" to={quiz.to}>Start quiz</Link></article>)}</div><section className="exam-separation glass"><div><p className="exam-kicker">FORMAL ASSESSMENT</p><h2>Need a fixed question set and no immediate feedback?</h2><p>Use the Exam Library for controlled attempts, timed sections, results, and answer review.</p></div><Link className="btn btn-secondary" to="/exams">Open Exams</Link></section></div>;
}
