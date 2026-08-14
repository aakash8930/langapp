import { api } from './client';

export type LegalDocId = 'privacy' | 'terms';

export type LegalDoc = {
  title: string;
  effectiveDate: string;
  /** Markdown — headers, bullet lists and **bold** only. See `app/legal/[doc].tsx`'s renderer. */
  content: string;
};

export function fetchLegalDoc(doc: LegalDocId): Promise<LegalDoc> {
  return api.get(`/legal/${doc}`);
}
