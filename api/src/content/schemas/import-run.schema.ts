import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * One row per execution of a `src/import/*.importer.ts` script — the part
 * per-document `SourceProvenance` (source-provenance.schema.ts) does not
 * cover: how long an import took, whether it fully succeeded, and what the
 * counts were, all of which the console log loses the moment the process
 * exits. Deliberately one flat collection rather than normalized further —
 * nothing yet needs to query a run's source/version/attribution separately
 * from its outcome.
 */
@Schema({ collection: 'importRuns', timestamps: true })
export class ImportRun {
  /** Matches an entry's `id` in `data/sources.json`, e.g. "jmdict". */
  @Prop({ required: true, trim: true })
  source: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  finishedAt: Date;

  @Prop({ required: true, enum: ['success', 'partial', 'failed'] })
  status: 'success' | 'partial' | 'failed';

  @Prop({ required: true })
  parsed: number;

  @Prop({ required: true })
  upserted: number;

  @Prop({ required: true })
  failed: number;

  @Prop({ trim: true })
  sourceVersion?: string;

  @Prop({ trim: true })
  errorSummary?: string;
}

export const ImportRunSchema = SchemaFactory.createForClass(ImportRun);
ImportRunSchema.index({ source: 1, startedAt: -1 });
