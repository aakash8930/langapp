import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { jlptLevels, loadJlptResults, n5Blueprint } from './jlptData';
import './practice.css';
import './jlpt.css';

type Tab = 'overview' | 'curriculum' | 'exam' | 'about';

const skills = [
  { name: 'Vocabulary', score: 78, detail: 'Build recognition, readings, and usage.', to: '/vocabulary' },
  { name: 'Grammar', score: 62, detail: 'Focus on particles and て-form connections.', to: '/grammar' },
  { name: 'Reading', score: 71, detail: 'Practice short notices and connected passages.', to: '/read' },
  { name: 'Listening', score: 54, detail: 'Strengthen short conversational responses.', to: '/listening' },
];

export function JLPTDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const results = useMemo(() => loadJlptResults(), []);
  const latest = results.at(-1);
  const readiness = latest ? Math.round(Math.min(95, latest.score * 0.72 + 20)) : 68;
  const estimated = latest ? `${Math.max(55, Math.round(latest.score * 1.35 - 8))}–${Math.min(180, Math.round(latest.score * 1.55 + 8))}` : '82–105';

  return (
    <div className="page jlpt-page">
      <header className="page-head jlpt-head">
        <div>
          <p className="jlpt-eyebrow">JLPT PREPARATION SYSTEM</p>
          <h1 className="page-title">Prepare with a plan, not a list.</h1>
          <p className="page-sub">A JLPT-aligned learning and assessment layer across your vocabulary, grammar, reading, listening, and review.</p>
        </div>
        <div className="jlpt-level-badge"><strong>N5</strong><span>Current target</span></div>
      </header>

      <nav className="jlpt-tabs" aria-label="JLPT sections">
        {([['overview', 'Dashboard'], ['curriculum', 'Curriculum'], ['exam', 'Mock tests'], ['about', 'Content policy']] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'jlpt-tab active' : 'jlpt-tab'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' && <>
        <section className="jlpt-hero-card glass">
          <div className="jlpt-readiness">
            <p className="jlpt-card-label">ESTIMATED N5 READINESS</p>
            <div className="jlpt-readiness-row"><strong>{readiness}%</strong><span>on track</span></div>
            <div className="jlpt-meter"><span style={{ width: `${readiness}%` }} /></div>
            <p>Estimated score range <b>{estimated} / 180</b></p>
          </div>
          <div className="jlpt-hero-divider" />
          <div className="jlpt-hero-actions">
            <p className="jlpt-card-label">YOUR NEXT BEST STEP</p>
            <h2>Practice particles</h2>
            <p>Grammar is your biggest score opportunity. Complete a focused set, then review it with spaced repetition.</p>
            <div><Link className="btn btn-primary" to="/grammar-exercises">Practice 15 questions</Link><Link className="btn btn-secondary" to="/practice-hub">Open practice hub</Link></div>
          </div>
        </section>

        <section className="jlpt-section">
          <div className="jlpt-section-heading"><div><p className="jlpt-card-label">SKILL BREAKDOWN</p><h2>Know where to focus</h2></div><span className="jlpt-muted">Based on your study and mock-test activity</span></div>
          <div className="jlpt-skill-grid">
            {skills.map((skill) => <article className="glass jlpt-skill" key={skill.name}>
              <div className="jlpt-skill-top"><h3>{skill.name}</h3><strong>{skill.score}%</strong></div>
              <div className="jlpt-meter small"><span style={{ width: `${skill.score}%` }} /></div>
              <p>{skill.detail}</p>
              <Link to={skill.to}>Practice {skill.name.toLowerCase()} <span>→</span></Link>
            </article>)}
          </div>
        </section>

        <section className="jlpt-section jlpt-two-col">
          <article className="glass jlpt-panel"><p className="jlpt-card-label">THIS WEEK'S PLAN</p><h2>Small steps. Clear progress.</h2>
            <ul className="jlpt-checklist"><li><span className="done">✓</span><div><b>Vocabulary review</b><small>24 cards due today</small></div><Link to="/practice-hub">Review</Link></li><li><span>2</span><div><b>Particles practice</b><small>15 original N5-aligned questions</small></div><Link to="/grammar-exercises">Start</Link></li><li><span>3</span><div><b>Listening set</b><small>Short responses and key details</small></div><Link to="/listening">Practice</Link></li></ul>
          </article>
          <article className="glass jlpt-panel jlpt-result-summary"><p className="jlpt-card-label">MOCK TESTS</p><h2>{latest ? `${latest.score}% on your last N5 mock` : 'Take your N5 baseline'}</h2><p>{latest ? 'Your result has been turned into targeted recommendations below.' : 'A short diagnostic identifies the skills to prioritize next.'}</p><Link className="btn btn-primary" to="/jlpt-mock-test">{latest ? 'Take another mock' : 'Start mock test'}</Link><Link className="text-link" to="/jlpt-results">View all results →</Link></article>
        </section>

        <p className="jlpt-disclaimer">Readiness and score ranges are learning estimates, not official JLPT scores or pass predictions.</p>
      </>}

      {tab === 'curriculum' && <section className="jlpt-section">
        <div className="jlpt-section-heading"><div><p className="jlpt-card-label">JLPT-ALIGNED CURRICULUM</p><h2>Build from core Japanese data</h2></div></div>
        <div className="jlpt-level-grid">{jlptLevels.map((item) => <article className="glass jlpt-level-card" key={item.level}><div><span className="jlpt-level-name">{item.level}</span><span className="jlpt-status">{item.status}</span></div><h3>{item.label}</h3><p>{item.description}</p><div className="jlpt-meter small"><span style={{ width: `${item.readiness}%` }} /></div><small>{item.readiness ? `${item.readiness}% learning readiness` : 'Choose this target when ready'}</small>{item.level === 'N5' && <Link to="/vocabulary">Explore N5 learning content →</Link>}</article>)}</div>
        <article className="glass jlpt-flow"><p className="jlpt-card-label">CONNECTED LEARNING LOOP</p><div><b>Learn</b><span>Vocabulary · Kanji · Grammar</span><i>→</i><b>Assess</b><span>Original mock questions</span><i>→</i><b>Improve</b><span>Weak areas · targeted practice</span></div></article>
      </section>}

      {tab === 'exam' && <section className="jlpt-section">
        <div className="jlpt-section-heading"><div><p className="jlpt-card-label">N5 MOCK TEST</p><h2>Practice the structure, then close the gaps.</h2></div><Link className="btn btn-primary" to="/jlpt-mock-test">Start N5 mock</Link></div>
        <div className="jlpt-blueprint">{n5Blueprint.map((section, i) => <article className="glass" key={section.section}><span className="jlpt-step">0{i + 1}</span><h3>{section.section}</h3><strong>{section.time}</strong><p>{section.items}</p><Link to={section.section === 'Vocabulary' ? '/vocabulary' : section.section === 'Listening' ? '/listening' : '/grammar-exercises'}>{section.action} →</Link></article>)}</div>
        <article className="glass jlpt-panel jlpt-exam-note"><h3>How scoring works here</h3><p>Practice scores show your percentage correct. The 180-point range is a clearly labelled estimate—real JLPT scores use scaled scoring, so a practice percentage is never an official result.</p><Link to="/jlpt-results">See mock-test results →</Link></article>
      </section>}

      {tab === 'about' && <section className="jlpt-section">
        <div className="jlpt-section-heading"><div><p className="jlpt-card-label">RESPONSIBLE CONTENT</p><h2>JLPT-aligned, independently created.</h2></div></div>
        <div className="jlpt-policy-grid"><article className="glass"><h3>What guides us</h3><p>Official JLPT level descriptions, test structure, timing, and question-type specifications guide our curriculum and question templates.</p></article><article className="glass"><h3>What we publish</h3><p>Our production bank uses original questions, curated learning content, and reviewed drafts—not copied examination questions.</p></article><article className="glass"><h3>How AI is used</h3><p>AI may draft questions for review. Validation checks grammar, answers, distractors, difficulty, naturalness, and duplicates before publishing.</p></article></div>
        <article className="glass jlpt-panel"><h3>Clear, honest alignment</h3><p>The JLPT does not publish a fixed official vocabulary, kanji, or grammar list. Labels such as “N5-aligned” describe this app’s curated curriculum; they do not claim to be an official JLPT specification.</p><a className="text-link" href="https://www.jlpt.jp/e/faq/" target="_blank" rel="noreferrer">Read the official JLPT FAQ →</a></article>
      </section>}
    </div>
  );
}
