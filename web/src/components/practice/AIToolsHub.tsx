import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import './ai-tools.css';

type Tool = 'tutor' | 'grammar' | 'explain' | 'translate' | 'conversation' | 'writing' | 'pronunciation';
const tools: { id: Tool; icon: string; name: string; text: string; available: boolean }[] = [
  { id: 'tutor', icon: '✦', name: 'AI Tutor', text: 'Personalized explanations and guided practice.', available: true },
  { id: 'grammar', icon: '✓', name: 'Grammar Checker', text: 'Spot issues and learn why they matter.', available: true },
  { id: 'explain', icon: '分', name: 'Sentence Explainer', text: 'Break down Japanese one piece at a time.', available: true },
  { id: 'translate', icon: 'あ', name: 'Translation', text: 'Literal, natural, and learning-focused translations.', available: true },
  { id: 'conversation', icon: '◌', name: 'Conversation', text: 'Practice real scenarios in Japanese.', available: true },
  { id: 'writing', icon: '✎', name: 'Writing Feedback', text: 'Improve grammar, naturalness, and structure.', available: true },
  { id: 'pronunciation', icon: '◔', name: 'Pronunciation', text: 'Record and compare your Japanese.', available: true },
];

const prompts: Record<Exclude<Tool, 'conversation' | 'writing' | 'pronunciation'>, { label: string; placeholder: string; example: string }> = {
  tutor: { label: 'What would you like to learn?', placeholder: 'For example: What is the difference between は and が?', example: 'You have been reviewing particles. Let’s start with に vs. で.' },
  grammar: { label: 'Enter a Japanese sentence', placeholder: '私は昨日映画を見ます。', example: 'Suggestion: 私は昨日映画を見ました。\n昨日 refers to a completed past event, so 見ました is appropriate.' },
  explain: { label: 'Enter a Japanese sentence', placeholder: '昨日、友達と映画を見ました。', example: '昨日 — yesterday (time expression)\n友達と — with a friend\n映画を — movie + object particle\n見ました — watched; polite past form of 見る' },
  translate: { label: 'Enter Japanese or English text', placeholder: '昨日、学校に行きました。', example: 'Literal: Yesterday, to school went.\nNatural: I went to school yesterday.\nLearning note: に marks the destination; 行きました is the polite past form of 行く.' },
};

export function AIToolsHub() {
  const [tool, setTool] = useState<Tool>('tutor');
  const [value, setValue] = useState('');
  const [response, setResponse] = useState('');
  const chosen = tools.find((item) => item.id === tool)!;
  const run = () => { const config = prompts[tool as keyof typeof prompts]; if (config) setResponse(config.example); };

  return <div className="page ai-page">
    <header className="page-head ai-head"><div><p className="ai-kicker">AI LEARNING ENGINE</p><h1 className="page-title">One learning context. Every AI tool.</h1><p className="page-sub">Personalized help connects your language knowledge, activity, and learner profile—then sends insights back to practice and review.</p></div><div className="ai-status"><span /> Learning context ready</div></header>
    <section className="ai-context glass"><div><p className="ai-kicker">YOUR LEARNER CONTEXT</p><h2>Prepared for N4 · Unit 7</h2><div className="ai-context-tags"><span>JLPT target: N4</span><span>Weak area: Particles</span><span>Recently learned: ～ながら</span><span>Review retention: 82%</span></div></div><div className="ai-context-cta"><p>Start where your learning needs you most.</p><button className="btn btn-primary" onClick={() => { setTool('tutor'); setResponse(prompts.tutor.example); }}>Ask your tutor</button></div></section>
    <section className="ai-workspace"><aside className="glass ai-tools-nav"><p>AI CAPABILITIES</p>{tools.map((item) => <button key={item.id} onClick={() => { setTool(item.id); setResponse(''); }} className={tool === item.id ? 'active' : ''}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.text}</small></span></button>)}</aside><main className="glass ai-tool-panel"><div className="ai-tool-heading"><div><span className="ai-tool-icon">{chosen.icon}</span><div><p className="ai-kicker">AI LEARNING ENGINE</p><h2>{chosen.name}</h2></div></div><span className="ai-guardrail">Structured, reviewable output</span></div>
      {tool === 'conversation' && <ConversationPanel />}
      {tool === 'writing' && <WritingPanel />}
      {tool === 'pronunciation' && <PronunciationPanel />}
      {prompts[tool as keyof typeof prompts] && <div className="ai-prompt"><label>{prompts[tool as keyof typeof prompts].label}</label><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={prompts[tool as keyof typeof prompts].placeholder} /><div><button className="btn btn-primary" onClick={run}>Get learning help</button><button className="text-button" onClick={() => { setValue(prompts[tool as keyof typeof prompts].placeholder); setResponse(prompts[tool as keyof typeof prompts].example); }}>Try an example</button></div>{response && <article className="ai-response"><p className="ai-kicker">LEARNING RESPONSE</p>{response.split('\n').map((line) => <p key={line}>{line}</p>)}{tool === 'tutor' && <div className="ai-response-actions"><Link to="/grammar-exercises">Practice 5 questions</Link><Link to="/practice-hub">Add to review plan</Link></div>}</article>}</div>}
    </main></section>
    <section className="ai-engine-note glass"><div><p className="ai-kicker">HOW AI FITS THE PLATFORM</p><h2>AI suggests. Your learning system decides.</h2><p>AI produces structured drafts and feedback. The application validates the result before it becomes a recommendation, practice activity, or saved learning record.</p></div><div className="ai-flow"><b>Learner context</b><i>→</i><b>AI response</b><i>→</i><b>Validation</b><i>→</i><b>Practice · Review · Progress</b></div></section>
  </div>;
}

function ConversationPanel() { return <div className="ai-special"><p>Choose a scenario, then practise a guided Japanese conversation. Corrections appear after the exchange—not while you are speaking.</p><div className="ai-scenario"><span>🍜</span><div><b>Ordering at a restaurant</b><small>Beginner-friendly · everyday vocabulary</small></div></div><p className="ai-chat-line"><b>AI</b> いらっしゃいませ。何名様ですか？</p><Link className="btn btn-primary" to="/speaking-conversation" search={{ session: undefined }}>Start conversation</Link></div> }
function WritingPanel() { return <div className="ai-special"><p>Writing Feedback uses the same analysis pipeline as your writing workspace: grammar, vocabulary, naturalness, spelling, particles, and structure.</p><div className="ai-analysis-list"><span>Grammar</span><span>Vocabulary</span><span>Naturalness</span><span>Particles</span><span>Structure</span></div><Link className="btn btn-primary" to="/writing-feedback">Open writing feedback</Link></div> }
function PronunciationPanel() { return <div className="ai-special"><p>Record a course phrase and compare its transcript to the target. We show the evidence we can verify rather than inventing an accent score.</p><div className="ai-scenario"><span>🎤</span><div><b>Target phrase: ありがとうございます</b><small>Listen, record, compare, and practise again.</small></div></div><Link className="btn btn-primary" to="/speaking-pronunciation">Open pronunciation practice</Link></div> }
