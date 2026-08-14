import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Embedded on every document written by an offline importer (`src/import/`).
 * Nothing here is inferred at read time — an importer sets it explicitly from
 * `data/sources.json`, so a document always carries where it came from and
 * under what licence, independent of that file changing later.
 */
@Schema({ _id: false })
export class SourceProvenance {
  /** Matches an entry's `name` in `data/sources.json`, e.g. "JMdict". */
  @Prop({ required: true, trim: true })
  name: string;

  /** The source's own stable ID for this record — never this app's `_id`. */
  @Prop({ required: true, trim: true })
  sourceId: string;

  @Prop({ required: true, trim: true })
  license: string;

  @Prop({ required: true })
  importedAt: Date;

  @Prop({ trim: true })
  sourceVersion?: string;
}

export const SourceProvenanceSchema = SchemaFactory.createForClass(SourceProvenance);
