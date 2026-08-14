import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SourceProvenance, SourceProvenanceSchema } from './source-provenance.schema';

/**
 * `dictionaryEntries` — imported from JMdict (`src/import/jmdict.importer.ts`).
 * This is reference-dictionary data, **not** curriculum content: it is a
 * separate collection from `VocabItem`, which stays hand-curated for lessons.
 * Nothing here is written by anything other than the JMdict importer, and the
 * importer never touches `vocabItems` — linking the two (e.g. attaching a
 * JMdict gloss to a taught word) is a deliberate future decision, not
 * something this collection does implicitly.
 */

@Schema({ _id: false })
export class DictionaryKanjiForm {
  /** The word written with kanji/mixed script, e.g. 食べる. */
  @Prop({ required: true, trim: true })
  text: string;

  /** Expanded `ke_inf` tags, e.g. "irregular kanji usage". */
  @Prop({ type: [String], default: [] })
  info: string[];

  /** `ke_pri` codes (news1, ichi1, spec1, gai1, nfNN...) — presence means "common". */
  @Prop({ type: [String], default: [] })
  priority: string[];
}
export const DictionaryKanjiFormSchema = SchemaFactory.createForClass(DictionaryKanjiForm);

@Schema({ _id: false })
export class DictionaryReading {
  /** The reading in kana, e.g. たべる. */
  @Prop({ required: true, trim: true })
  text: string;

  /** True if this reading does not apply to any of the entry's kanji forms. */
  @Prop({ default: false })
  noKanji: boolean;

  /** If non-empty, this reading only applies to these specific kanji forms. */
  @Prop({ type: [String], default: [] })
  restrictedTo: string[];

  @Prop({ type: [String], default: [] })
  info: string[];

  @Prop({ type: [String], default: [] })
  priority: string[];
}
export const DictionaryReadingSchema = SchemaFactory.createForClass(DictionaryReading);

@Schema({ _id: false })
export class DictionarySense {
  /** Expanded part-of-speech tags, e.g. "noun (common) (futsuumeishi)". */
  @Prop({ type: [String], default: [] })
  partOfSpeech: string[];

  @Prop({ type: [String], default: [] })
  fields: string[];

  @Prop({ type: [String], default: [] })
  misc: string[];

  @Prop({ type: [String], default: [] })
  dialects: string[];

  /** English glosses. JMdict_e is the English-only distribution — no other language appears. */
  @Prop({ type: [String], required: true })
  glosses: string[];

  /** Free-text sense note (`s_inf`), e.g. "usually written using kana alone". */
  @Prop({ trim: true })
  note?: string;

  /** If non-empty, this sense only applies to these specific kanji forms. */
  @Prop({ type: [String], default: [] })
  appliesToKanji: string[];

  /** If non-empty, this sense only applies to these specific readings. */
  @Prop({ type: [String], default: [] })
  appliesToReading: string[];
}
export const DictionarySenseSchema = SchemaFactory.createForClass(DictionarySense);

@Schema({ collection: 'dictionaryEntries', timestamps: true })
export class DictionaryEntry {
  /** JMdict's own `ent_seq` — the stable natural key the importer upserts on. */
  @Prop({ required: true })
  jmdictSeq: number;

  /** Empty for kana-only words (e.g. ない has no kanji form in JMdict). */
  @Prop({ type: [DictionaryKanjiFormSchema], default: [] })
  kanjiForms: DictionaryKanjiForm[];

  @Prop({ type: [DictionaryReadingSchema], required: true })
  readings: DictionaryReading[];

  @Prop({ type: [DictionarySenseSchema], required: true })
  senses: DictionarySense[];

  /** Derived: true if any kanji form or reading carries a priority tag. */
  @Prop({ required: true, default: false })
  isCommon: boolean;

  @Prop({ type: SourceProvenanceSchema, required: true })
  source: SourceProvenance;
}

export type DictionaryEntryDocument = HydratedDocument<DictionaryEntry>;
export const DictionaryEntrySchema = SchemaFactory.createForClass(DictionaryEntry);

DictionaryEntrySchema.index({ jmdictSeq: 1 }, { unique: true });
DictionaryEntrySchema.index({ 'kanjiForms.text': 1 });
DictionaryEntrySchema.index({ 'readings.text': 1 });
DictionaryEntrySchema.index({ isCommon: 1 });
