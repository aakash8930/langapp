import { Injectable, NotFoundException } from '@nestjs/common';
import { ExercisePlugin } from './exercise-plugin.interface';
import { MultipleChoicePlugin } from './multiple-choice.plugin';
import { WordReadingPlugin } from './word-reading.plugin';
import { ListeningPlugin } from './listening.plugin';
import { SentenceBuildingPlugin } from './sentence-building.plugin';
import { FillInTheBlankPlugin } from './fill-in-the-blank.plugin';
import { FlashcardPlugin } from './flashcard.plugin';

/**
 * ExercisePluginRegistry maintains the map of supported exercise strategy plugins (Phase 2 architecture).
 * Decouples exercise generation and grading from hardcoded types in ExerciseService.
 */
@Injectable()
export class ExercisePluginRegistry {
  private readonly plugins = new Map<string, ExercisePlugin>();

  constructor(
    multipleChoice: MultipleChoicePlugin,
    wordReading: WordReadingPlugin,
    listening: ListeningPlugin,
    sentenceBuilding: SentenceBuildingPlugin,
    fillInTheBlank: FillInTheBlankPlugin,
    flashcard: FlashcardPlugin,
  ) {
    this.register(multipleChoice);
    this.register(wordReading);
    this.register(listening);
    this.register(sentenceBuilding);
    this.register(fillInTheBlank);
    this.register(flashcard);
  }

  register(plugin: ExercisePlugin): void {
    this.plugins.set(plugin.exerciseType, plugin);
  }

  getPlugin(exerciseType: string): ExercisePlugin {
    const plugin = this.plugins.get(exerciseType);
    if (!plugin) {
      throw new NotFoundException(`Unsupported exercise type plugin: ${exerciseType}`);
    }
    return plugin;
  }

  hasPlugin(exerciseType: string): boolean {
    return this.plugins.has(exerciseType);
  }

  listSupportedTypes(): string[] {
    return Array.from(this.plugins.keys());
  }
}
