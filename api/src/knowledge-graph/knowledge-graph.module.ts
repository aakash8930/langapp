import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeEdge, KnowledgeEdgeSchema } from './schemas/knowledge-edge.schema';
import { KnowledgeNode, KnowledgeNodeSchema } from './schemas/knowledge-node.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeNode.name, schema: KnowledgeNodeSchema },
      { name: KnowledgeEdge.name, schema: KnowledgeEdgeSchema },
    ]),
  ],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
