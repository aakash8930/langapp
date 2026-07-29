import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { createLesson, createVocab, type CreateLessonPayload, type CreateVocabPayload } from '../api';
import { useNavigate } from '@tanstack/react-router';
import { useSession } from '../useSession';

export const Route = createFileRoute('/creator')({
  component: CreatorDashboard,
});

function CreatorDashboard() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [activeTab, setActiveTab] = useState<'vocab' | 'lesson'>('vocab');

  if (session.state !== 'signedIn' || !session.user?.isAdmin) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <h2>Access Denied</h2>
        <p>You do not have creator privileges.</p>
        <button onClick={() => navigate({ to: '/' })} style={{ marginTop: '16px', padding: '8px 16px' }}>Back to Home</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => navigate({ to: '/' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>
          ←
        </button>
        <h1>Creator Dashboard</h1>
        <div />
      </header>

      <div style={{ display: 'flex', gap: 'var(--s-md)', marginBottom: 'var(--s-xl)' }}>
        <button
          onClick={() => setActiveTab('vocab')}
          className={activeTab === 'vocab' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ flex: 1 }}
        >
          Add Vocabulary
        </button>
        <button
          onClick={() => setActiveTab('lesson')}
          className={activeTab === 'lesson' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ flex: 1 }}
        >
          Add Lesson
        </button>
      </div>

      <div className="glass panel signin" style={{ maxWidth: '100%', margin: '0' }}>
        {activeTab === 'vocab' ? <VocabForm /> : <LessonForm />}
      </div>
    </div>
  );
}

function VocabForm() {
  const [formData, setFormData] = useState<CreateVocabPayload>({
    lemma: '',
    reading: '',
    romaji: '',
    gloss: '',
    pos: '',
    jlpt: 'N5',
    tags: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVocab(formData);
      alert('Vocabulary added successfully!');
      setFormData({
        lemma: '',
        reading: '',
        romaji: '',
        gloss: '',
        pos: '',
        jlpt: 'N5',
        tags: [],
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-md)' }}>
      <h3 style={{ fontSize: 'var(--text-title)', color: 'var(--ink)' }}>Add New Vocabulary</h3>
      <div className="field">
        <span>Lemma (e.g. 食べる)</span>
        <input
          type="text"
          value={formData.lemma}
          onChange={(e) => setFormData({ ...formData, lemma: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <span>Reading (e.g. たべる)</span>
        <input
          type="text"
          value={formData.reading}
          onChange={(e) => setFormData({ ...formData, reading: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <span>Romaji (e.g. taberu)</span>
        <input
          type="text"
          value={formData.romaji}
          onChange={(e) => setFormData({ ...formData, romaji: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <span>Gloss (e.g. to eat)</span>
        <input
          type="text"
          value={formData.gloss}
          onChange={(e) => setFormData({ ...formData, gloss: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <span>Part of Speech (e.g. verb)</span>
        <input
          type="text"
          value={formData.pos}
          onChange={(e) => setFormData({ ...formData, pos: e.target.value })}
          required
        />
      </div>
      <button className="btn btn-primary" type="submit" style={{ marginTop: 'var(--s-lg)' }}>
        Save Vocabulary
      </button>
    </form>
  );
}

function LessonForm() {
  const [formData, setFormData] = useState<CreateLessonPayload>({
    unit: '',
    order: 1,
    title: '',
    itemRefs: [],
    exerciseTypes: ['multipleChoice', 'wordReading'],
    prerequisiteLessonIds: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLesson(formData);
      alert('Lesson added successfully!');
      setFormData({
        unit: '',
        order: 1,
        title: '',
        itemRefs: [],
        exerciseTypes: ['multipleChoice', 'wordReading'],
        prerequisiteLessonIds: [],
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-md)' }}>
      <h3 style={{ fontSize: 'var(--text-title)', color: 'var(--ink)' }}>Add New Lesson</h3>
      <div className="field">
        <span>Unit Slug (e.g. vocab-n5)</span>
        <input
          type="text"
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <span>Order (e.g. 1)</span>
        <input
          type="number"
          value={formData.order}
          onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
          required
        />
      </div>
      <div className="field">
        <span>Title (e.g. Food and Drink)</span>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <p style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>Note: This is a simplified form. In a full implementation, you would select items and prerequisite lessons from a list.</p>
      <button className="btn btn-primary" type="submit" style={{ marginTop: 'var(--s-lg)' }}>
        Save Lesson
      </button>
    </form>
  );
}
