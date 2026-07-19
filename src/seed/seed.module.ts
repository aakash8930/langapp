import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { SeedService } from './seed.service';

@Module({
  imports: [ContentModule, KnowledgeGraphModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
