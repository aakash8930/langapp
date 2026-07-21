import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { GeminiProvider } from './gemini.provider';

/**
 * §4 AIOrchestrator: prompt assembly, provider calls, pipeline. Owns no
 * collections — persistence belongs to Chat. Consumers inject
 * AiOrchestratorService; GeminiProvider is an internal detail so a Stage B
 * provider swap never touches another module.
 */
@Module({
  providers: [AiOrchestratorService, GeminiProvider],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule {}
