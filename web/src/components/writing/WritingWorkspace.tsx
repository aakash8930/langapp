import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useSession } from '../../useSession';
import { tokenizeWithCourseVocab } from '../reading/readingData';
import { useCorpus, type GrammarItem, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { JapaneseComposer } from './JapaneseComposer';
import { countJapaneseCharacters } from './romajiToKana';
import { promptById, WRITING_PROMPTS, type WritingPromptKind } from './writingData';
import { WritingTabs } from './WritingTabs';
import { useWritingStore } from './useWritingStore';

import './writing.css';

export function WritingWorkspace({ kind, recordId }: { kind: WritingPromptKind; recordId?: string }) {
  const navigate = useNavigate();
  const corpus = useCorpus();
  const { session } = useSession();
  const store = useWritingStore();
  const existing = recordId ? store.records.find((record) => record.id === recordId) : undefined;
  const prompts = WRITING_PROMPTS.filter((prompt) => prompt.kind === kind);
  const initialPrompt = promptById(existing?.promptId) ?? prompts[0];
  const [promptId, setPromptId] = useState(initialPrompt?.id ?? '');
  const [text, setText] = useState(existing?.text ?? '');
  const [currentId, setCurrentId] = useState(existing?.id);
  const [notice, setNotice] = useState<string | null>(existing ? `Reopened ${existing.status} from ${new Date(existing.updatedAt).toLocaleDateString()}.` : null);
  const prompt = promptById(promptId) ?? prompts[0];
  const corpusItems = corpus.data?.items;
  const vocab = useMemo(() => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [], [corpusItems]);
  const grammar = useMemo(() => corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? [], [corpusItems]);
  const suggestedVocab = prompt ? vocab.filter((item) => prompt.suggestedLemmas.includes(item.lemma) || prompt.suggestedLemmas.includes(item.reading)).slice(0, 8) : [];
  const suggestedGrammar = prompt ? grammar.filter((item) => prompt.grammarForms.some((form) => item.title.startsWith(`${form} `) || item.title.startsWith(`${form}—`) || item.title.startsWith(`${form} —`))).slice(0, 6) : [];
  const matchedCourseWords = useMemo(() => new Set(tokenizeWithCourseVocab(text, vocab).filter((token) => token.kind === 'vocab').map((token) => token.item.id)).size, [text, vocab]);
  const japaneseCharacters = countJapaneseCharacters(text);
  const hasLatin = /[A-Za-z]/.test(text);
  const recent = store.records.filter((record) => record.kind === kind).slice(0, 3);
  const recommendation = prompt?.recommendedCharacters;
  const targetPercent = recommendation ? Math.min(100, japaneseCharacters / recommendation.min * 100) : 0;

  if (!prompt) return <div className="page writing-reference"><WritingTabs active={kind === 'essay' ? 'essay' : 'practice'} /><section className="writing-empty glass"><Icon name="pen-tool" size={40} /><h1>No authored prompt is available</h1><p>The editor does not generate an unreviewed fallback prompt.</p></section></div>;

  function recordInput() {
    return { id: currentId, kind, promptId: prompt.id, title: prompt.title, promptJapanese: prompt.japanese, topic: prompt.topic, level: prompt.level, text };
  }

  function saveDraft() {
    const id = store.saveDraft(recordInput());
    setCurrentId(id);
    setNotice('Draft saved in this browser. It is not synced to your account.');
  }

  function submit() {
    const id = store.submit(recordInput());
    setCurrentId(id);
    setNotice('Writing submitted to local history. No score is invented before a real review.');
    return id;
  }

  function requestFeedback() {
    const id = submit();
    void navigate({ to: '/writing-feedback/$id', params: { id } });
  }

  function changePrompt(nextId: string) {
    setPromptId(nextId);
    setCurrentId(undefined);
    setNotice(text ? 'Prompt changed. Saving now will create a new writing record with the current text.' : null);
  }

  return <div className="page writing-reference"><WritingTabs active={kind === 'essay' ? 'essay' : 'practice'} /><header className="writing-page-header"><div><p className="writing-kicker">{kind === 'essay' ? 'LONG-FORM COMPOSITION' : 'GUIDED JAPANESE COMPOSITION'}</p><h1>{kind === 'essay' ? 'Essay Workspace' : 'Writing Practice'}</h1><p>{kind === 'essay' ? 'Choose an authored topic, compose a longer response, save locally, and request teaching-focused feedback.' : 'Choose a levelled prompt, type with automatic romaji-to-kana conversion, and connect corrections to review.'}</p></div>{existing && currentId === existing.id ? <span className={`writing-status is-${existing.status}`}>{existing.status}</span> : null}</header><section className="writing-stat-grid">{kind === 'practice' ? <><article className="glass"><Icon name="pen-tool" size={18} /><span>Submitted writing</span><strong className="tabular">{store.summary.submitted}</strong><small>Explicit local submissions</small></article><article className="glass"><Icon name="scroll-text" size={18} /><span>Saved drafts</span><strong className="tabular">{store.summary.drafts}</strong><small>Stored in this browser</small></article><article className="glass"><Icon name="check-circle-2" size={18} /><span>AI corrections</span><strong className="tabular">{store.summary.corrections}</strong><small>Returned by the review API</small></article><article className="glass"><Icon name="languages" size={18} /><span>Characters submitted</span><strong className="tabular">{store.summary.japaneseCharacters.toLocaleString()}</strong><small>Japanese script only</small></article></> : <article className="glass writing-essay-stat"><Icon name="scroll-text" size={18} /><span>Essay drafts and submissions</span><strong className="tabular">{store.records.filter((record) => record.kind === 'essay').length}</strong><small>No synthetic score or rubric</small></article>}</section><div className="writing-workspace-layout"><main className="writing-editor-card glass"><section className="writing-prompt-panel"><div className="writing-editor-section-head"><div><p className="writing-kicker">1 · CHOOSE A PROMPT</p><h2>{prompt.title}</h2></div><label><span>Prompt</span><select value={prompt.id} onChange={(event) => changePrompt(event.target.value)}>{prompts.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.level} · {candidate.topic} · {candidate.title}</option>)}</select></label></div><div className="writing-prompt-copy"><span className="writing-level-badge">{prompt.level}</span><span>{prompt.topic}</span><p className="ja" lang="ja">{prompt.japanese}</p><small>{prompt.guidance}</small></div>{recommendation ? <div className="writing-target"><div><span>Recommended range from this authored prompt</span><strong className="tabular">{recommendation.min}–{recommendation.max} Japanese characters</strong></div><div><i style={{ width: `${targetPercent}%` }} /></div></div> : <p className="writing-no-target"><Icon name="info" size={14} /> This prompt has no authored length target. Character count is shown without inventing one.</p>}</section><section className="writing-editor-section"><div className="writing-editor-section-head"><div><p className="writing-kicker">2 · WRITE</p><h2>Your response</h2></div><span>{matchedCourseWords} matched course word{matchedCourseWords === 1 ? '' : 's'}</span></div><JapaneseComposer id={`${kind}-composer`} label="Japanese writing editor" value={text} onChange={(next) => { setText(next); setNotice(null); }} placeholder={kind === 'essay' ? 'Write your essay in Japanese…' : 'Type Japanese or valid romaji…'} maxLength={kind === 'essay' ? 1000 : 500} rows={kind === 'essay' ? 14 : 9} /><p className="writing-word-count-note">Japanese does not use spaces consistently, and this app has no morphological word-count service. The course-word figure counts only spans confidently matched to the loaded vocabulary corpus.</p>{notice ? <p className="writing-save-notice" role="status"><Icon name="check" size={14} /> {notice}</p> : null}<div className="writing-editor-actions"><button type="button" className="btn btn-secondary" onClick={() => { setText(''); setNotice('Editor cleared. A previously saved draft remains in History.'); }} disabled={!text}>Clear editor</button><button type="button" className="btn btn-secondary" onClick={saveDraft} disabled={!text.trim()}><Icon name="book-marked" size={15} /> Save draft</button><button type="button" className="btn btn-primary" onClick={submit} disabled={japaneseCharacters === 0 || hasLatin}><Icon name="check" size={15} /> Submit</button><button type="button" className="btn btn-primary" onClick={requestFeedback} disabled={session.state !== 'signedIn' || japaneseCharacters === 0 || hasLatin || text.length > 500}><Icon name="bot" size={15} /> Submit for AI feedback</button></div>{hasLatin ? <p className="writing-action-warning"><Icon name="circle-alert" size={14} /> Finish or remove unrecognised Latin text before submitting. Drafts can still be saved.</p> : text.length > 500 ? <p className="writing-action-warning"><Icon name="circle-alert" size={14} /> The AI endpoint accepts at most 500 characters. Save the full essay, then shorten it before requesting review.</p> : session.state === 'signedOut' ? <p className="writing-action-warning"><Icon name="lock" size={14} /> Local drafts work without an account. <Link to="/signin">Sign in</Link> to request AI feedback.</p> : null}</section></main><aside className="writing-workspace-rail"><section className="writing-rail-card glass"><p className="writing-kicker">COURSE CONNECTIONS</p><h2>Suggested vocabulary</h2>{corpus.isPending ? <p>Loading current course words…</p> : corpus.isError ? <p>The course corpus is unavailable. No replacement suggestions are generated.</p> : suggestedVocab.length === 0 ? <p>No prompt-matched vocabulary was found in the loaded corpus.</p> : <ul className="writing-vocab-suggestions">{suggestedVocab.map((item) => <li key={item.id}><span><strong className="ja" lang="ja">{item.lemma}</strong><small>{item.reading}</small></span><span>{item.gloss}</span></li>)}</ul>}<Link to="/vocabulary">Open vocabulary library <Icon name="chevron-right" size={13} /></Link></section><section className="writing-rail-card glass"><p className="writing-kicker">GRAMMAR HINTS</p><h2>Patterns in the course</h2>{corpus.isPending ? <p>Loading grammar…</p> : corpus.isError ? <p>Grammar hints require the course corpus.</p> : suggestedGrammar.length === 0 ? <p>No authored grammar hint matches this prompt.</p> : <ul className="writing-grammar-suggestions">{suggestedGrammar.map((item) => <li key={item.id}><Link to="/grammar/$id" params={{ id: item.id }}><span className="ja">{item.title}</span><Icon name="chevron-right" size={13} /></Link></li>)}</ul>}<p>Hints are existing course records. Their course level may differ from the selected prompt.</p></section><section className="writing-rail-card glass"><p className="writing-kicker">RECENT {kind === 'essay' ? 'ESSAYS' : 'WRITING'}</p><h2>Continue a draft</h2>{recent.length === 0 ? <p>No local records yet.</p> : <ul className="writing-recent-list">{recent.map((record) => <li key={record.id}><Link to="/writing-entry/$id" params={{ id: record.id }}><span><strong>{record.title}</strong><small>{record.status} · {new Date(record.updatedAt).toLocaleDateString()}</small></span><Icon name="chevron-right" size={13} /></Link></li>)}</ul>}<Link to="/writing-history">View writing history <Icon name="chevron-right" size={13} /></Link></section><section className="writing-rail-card glass"><p className="writing-kicker">HANDWRITING</p><h2>Practise the scripts</h2><ul className="writing-connected-links"><li><Link to="/hiragana-writing"><span className="ja">あ</span> Hiragana writing</Link></li><li><Link to="/katakana-writing"><span className="ja">ア</span> Katakana writing</Link></li><li><Link to="/kanji-writing"><span className="ja">漢</span> Kanji writing</Link></li></ul></section></aside></div><section className="writing-boundary-note glass"><Icon name="shield-check" size={19} /><div><h2>What the current system can—and cannot—claim</h2><p>Drafts, submissions, characters, builder answers, API corrections, and review requests are observable. There is no writing score, teacher feedback, server-synced draft model, handwriting recognition, or structured weak-area endpoint, so this screen does not fabricate them.</p></div><Link className="btn btn-secondary btn-sm" to="/progress">Account progress</Link></section></div>;
}
