import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UserModule } from '../user/user.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';

/** Owns `chatSessions` and `chatMessages`, and nothing else (§4). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    AiOrchestratorModule,
    AnalyticsModule,
    UserModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
