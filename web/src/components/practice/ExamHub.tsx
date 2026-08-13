import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import './exam.css';

type Screen = 'library' | 'instructions' | 'exam' | 'results' | 'review';
type Exam = { id: string; title: string; course: string; questions: number; minutes: number; attempts: string; pass: number; sections: string[]; description: string };
type Question = { prompt: string; options: string[]; answer: number; skill: string; explanation: string };

const EXAMS: Exam[] = [
  { id: 'n5-final', title: 'Japanese N5 Final Assessment', course: 'Japanese N5', questions: 5, minutes: 10, attempts: '2 remaining', pass: 70, sections: ['Vocabulary', 'Grammar', 'Reading'], description: 'A formal end-of-course assessment covering essential N5 foundations.' },
  { id: 'n4-grammar', title: 'N4 Grammar Assessment', course: 'Japanese N4', questions: 5, minutes: 10, attempts: '1 remaining', pass: 70, sections: ['Grammar', 'Sentence patterns'], description: 'Check your understanding of high-frequency N4 grammar patterns.' },
  { id: 'hiragana', title: 'Hiragana Mastery Test', course: 'Hiragana', questions: 5, minutes: 8, attempts: 'Unlimited', pass: 80, sections: ['Reading', 'Writing'], description: 'Demonstrate reliable recognition of the hiragana chart.' },
  { id: 'kanji-5', title: 'Kanji Unit 5 Assessment', course: 'N4 Kanji', questions: 5, minutes: 8, attempts: '3 remaining', pass: 70, sections: ['Kanji', 'Vocabulary'], description: 'An assessment for the kanji and vocabulary in Unit 5.' },
];

const QUESTIONS: Question[] = [
  { prompt: 'この本は _______ 読みやすいです。', options: ['とても', 'とてもに', 'とてもな', 'とてもで'], answer: 0, skill: 'Grammar', explanation: 'とても is an adverb that directly modifies an adjective such as 読みやすい.' },
  { prompt: '「駅」の読み方として正しいものを選んでください。', options: ['えき', 'いき', 'えん', 'せき'], answer: 0, skill: 'Kanji', explanation: '駅 is read えき and means station.' },
  { prompt: '毎朝、コーヒーを _______。', options: ['飲みます', '飲みる', '飲んです', '飲むます'], answer: 0, skill: 'Grammar', explanation: '飲みます is the polite present form of 飲む.' },
  { prompt: '「静か」の反対に近い言葉はどれですか。', options: ['にぎやか', '便利', '元気', '有名'], answer: 0, skill: 'Vocabulary', explanation: 'にぎやか means lively or busy, the opposite of quiet in this context.' },
  { prompt: '図書館で本を借りました。明日 _______。', options: ['返します', '返りません', '返したいですか', '返してです'], answer: 0, skill: 'Grammar', explanation: '返します is the natural polite form: “I will return it tomorrow.”' },
];

export function ExamHubPage() {
  const [screen, setScreen] = useState<Screen>('library');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(QUESTIONS.length).fill(null));
  const [marked, setMarked] = useState<boolean[]>(Array(QUESTIONS.length).fill(false));
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (screen !== 'exam' || time <= 0) return;
    const interval = window.setInterval(() => setTime((value) => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, [screen, time]);

  useEffect(() => { if (screen === 'exam' && time === 0) setScreen('results'); }, [screen, time]);

  const score = useMemo(() => Math.round((answers.filter((answer, i) => answer === QUESTIONS[i].answer).length / QUESTIONS.length) * 100), [answers]);
  const correct = answers.filter((answer, i) => answer === QUESTIONS[i].answer).length;
  const unanswered = answers.filter((answer) => answer === null).length;
  const mins = Math.floor(time / 60); const secs = time % 60;
  const begin = () => { setAnswers(Array(QUESTIONS.length).fill(null)); setMarked(Array(QUESTIONS.length).fill(false)); setIndex(0); setTime((selectedExam?.minutes ?? 25) * 60); setScreen('exam'); };
  const openExam = (exam: Exam) => { setSelectedExam(exam); setScreen('instructions'); };

  if (screen === 'library') return <div className="page exam-page"><header className="page-head"><p className="exam-kicker">FORMAL ASSESSMENTS</p><h1 className="page-title">Exam Library</h1><p className="page-sub">Demonstrate your knowledge under assessment conditions. Feedback is available after submission.</p></header><div className="exam-library">{EXAMS.map((exam) => <article className="glass exam-card" key={exam.id}><div className="exam-card-top"><span>{exam.course}</span><span className="exam-pass">{exam.pass}% to pass</span></div><h2>{exam.title}</h2><p>{exam.description}</p><dl><div><dt>Questions</dt><dd>{exam.questions}</dd></div><div><dt>Time</dt><dd>{exam.minutes} min</dd></div><div><dt>Attempts</dt><dd>{exam.attempts}</dd></div></dl><button className="btn btn-primary" onClick={() => openExam(exam)}>View exam</button></article>)}</div><section className="exam-separation glass"><div><p className="exam-kicker">ASSESSMENT, NOT PRACTICE</p><h2>Looking for immediate feedback?</h2><p>Practice is flexible and learning-oriented. Exams use a fixed question set and only reveal answers once submitted.</p></div><Link className="btn btn-secondary" to="/practice">Go to practice</Link></section></div>;

  if (!selectedExam) return null;
  if (screen === 'instructions') return <div className="page exam-page"><button className="exam-back" onClick={() => setScreen('library')}>← Exam Library</button><main className="glass exam-start"><span className="exam-course">{selectedExam.course}</span><h1>{selectedExam.title}</h1><p>{selectedExam.description}</p><div className="exam-summary"><div><b>{selectedExam.questions}</b><span>Questions</span></div><div><b>{selectedExam.minutes} min</b><span>Time limit</span></div><div><b>{selectedExam.attempts}</b><span>Attempts</span></div><div><b>{selectedExam.pass}%</b><span>Passing score</span></div></div><div className="exam-instructions"><h2>Instructions</h2><ul><li>Select one answer for every question.</li><li>You may skip, mark, and change answers before submission.</li><li>Unanswered questions receive zero points.</li><li>Answers and explanations are hidden until you submit.</li><li>Do not close the exam while it is running.</li></ul></div><button className="btn btn-primary" onClick={begin}>Begin assessment</button></main></div>;

  if (screen === 'exam') { const question = QUESTIONS[index]; return <div className="page exam-page exam-running"><header className="exam-running-head"><div><span>{selectedExam.title}</span><small>{answers.filter((answer) => answer !== null).length} of {QUESTIONS.length} answered</small></div><strong className={time < 60 ? 'urgent' : ''}>{mins}:{secs.toString().padStart(2, '0')}</strong><button className="btn btn-secondary" onClick={() => setScreen('results')}>Submit exam</button></header><div className="exam-layout"><aside className="glass exam-navigator"><p>QUESTION NAVIGATOR</p><div>{QUESTIONS.map((_, i) => <button key={i} className={`${i === index ? 'current ' : ''}${answers[i] !== null ? 'answered ' : ''}${marked[i] ? 'marked' : ''}`} onClick={() => setIndex(i)}>{i + 1}</button>)}</div><small><i className="answered-dot" /> Answered <i className="marked-dot" /> Marked <i className="empty-dot" /> Unanswered</small></aside><main className="glass exam-question"><div className="exam-question-top"><span>Question {index + 1} / {QUESTIONS.length}</span><button onClick={() => setMarked((items) => items.map((item, i) => i === index ? !item : item))}>{marked[index] ? '★ Marked for review' : '☆ Mark for review'}</button></div><p className="ja" lang="ja">{question.prompt}</p><div className="exam-options">{question.options.map((option, i) => <button key={option} onClick={() => setAnswers((items) => items.map((item, answerIndex) => answerIndex === index ? i : item))} className={answers[index] === i ? 'selected' : ''}><b>{'ABCD'[i]}</b>{option}</button>)}</div><footer><button className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>{index === QUESTIONS.length - 1 ? <button className="btn btn-primary" onClick={() => setScreen('results')}>Submit exam</button> : <button className="btn btn-primary" onClick={() => setIndex(index + 1)}>Next</button>}</footer></main></div></div> }

  if (screen === 'results') { const passed = score >= selectedExam.pass; return <div className="page exam-page"><main className="glass exam-results"><p className="exam-kicker">EXAM COMPLETE</p><h1>{selectedExam.title}</h1><div className={passed ? 'exam-score pass' : 'exam-score'}><strong>{score}%</strong><span>{passed ? 'Passed ✓' : 'Not passed yet'}</span></div><div className="exam-result-stats"><div><b>{correct}</b><span>Correct</span></div><div><b>{QUESTIONS.length - correct - unanswered}</b><span>Incorrect</span></div><div><b>{unanswered}</b><span>Unanswered</span></div><div><b>{selectedExam.pass}%</b><span>Pass mark</span></div></div><p className="exam-result-note">Your answers have been submitted. Review explanations and turn missed concepts into targeted practice.</p><div className="exam-result-actions"><button className="btn btn-primary" onClick={() => setScreen('review')}>Review answers</button><Link className="btn btn-secondary" to="/review">Open review queue</Link><button className="text-button" onClick={() => setScreen('library')}>Back to Exam Library</button></div></main></div> }

  return <div className="page exam-page"><button className="exam-back" onClick={() => setScreen('results')}>← Results</button><header className="page-head"><p className="exam-kicker">ANSWER REVIEW</p><h1 className="page-title">Understand every answer</h1><p className="page-sub">Use missed questions to guide your next study session.</p></header><div className="exam-review-list">{QUESTIONS.map((question, i) => { const isCorrect = answers[i] === question.answer; return <article className={`glass exam-review ${isCorrect ? 'correct' : 'incorrect'}`} key={question.prompt}><div className="exam-review-heading"><span>Question {i + 1} · {question.skill}</span><b>{isCorrect ? 'Correct ✓' : answers[i] === null ? 'Unanswered' : 'Incorrect ✕'}</b></div><p className="ja" lang="ja">{question.prompt}</p><p>Your answer: <strong>{answers[i] === null ? 'No answer' : `${'ABCD'[answers[i]!]} · ${question.options[answers[i]!]}`}</strong></p>{!isCorrect && <p>Correct answer: <strong>{'ABCD'[question.answer]} · {question.options[question.answer]}</strong></p>}<div className="exam-explanation"><b>Explanation</b><span>{question.explanation}</span></div>{!isCorrect && <div className="exam-review-actions"><Link to="/review">Add to review</Link><Link to="/practice">Practice similar questions</Link></div>}</article>})}</div></div>;
}
