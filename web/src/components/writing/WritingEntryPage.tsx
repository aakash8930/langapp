import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';
import { WritingTabs } from './WritingTabs';
import { useWritingStore } from './useWritingStore';
import { WritingWorkspace } from './WritingWorkspace';

import './writing.css';

export function WritingEntryPage({ id }: { id: string }) {
  const { records } = useWritingStore();
  const record = records.find((candidate) => candidate.id === id);
  if (!record) return <div className="page writing-reference"><WritingTabs active="history" /><section className="writing-empty glass"><Icon name="pen-tool" size={40} /><h1>Writing entry not found</h1><p>This browser does not have a local record with that identifier.</p><Link className="btn btn-primary" to="/writing-history">Back to history</Link></section></div>;
  return <WritingWorkspace kind={record.kind} recordId={record.id} />;
}
