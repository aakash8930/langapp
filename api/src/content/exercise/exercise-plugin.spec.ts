import { MultipleChoicePlugin } from './plugins/multiple-choice.plugin';
import { WordReadingPlugin } from './plugins/word-reading.plugin';
import { ListeningPlugin } from './plugins/listening.plugin';
import { SentenceBuildingPlugin } from './plugins/sentence-building.plugin';
import { FillInTheBlankPlugin } from './plugins/fill-in-the-blank.plugin';
import { FlashcardPlugin } from './plugins/flashcard.plugin';
import { SpeechPlugin } from './plugins/speech.plugin';
import { ExercisePluginRegistry } from './plugins/exercise-plugin.registry';

describe('Exercise Plugin Architecture & Strategy Pattern (Phase 2)', () => {
  let registry: ExercisePluginRegistry;
  let mcPlugin: MultipleChoicePlugin;
  let wrPlugin: WordReadingPlugin;
  let listeningPlugin: ListeningPlugin;
  let sbPlugin: SentenceBuildingPlugin;
  let fitbPlugin: FillInTheBlankPlugin;
  let fcPlugin: FlashcardPlugin;
  let speechPlugin: SpeechPlugin;

  beforeEach(() => {
    mcPlugin = new MultipleChoicePlugin();
    wrPlugin = new WordReadingPlugin();
    listeningPlugin = new ListeningPlugin();
    sbPlugin = new SentenceBuildingPlugin();
    fitbPlugin = new FillInTheBlankPlugin();
    fcPlugin = new FlashcardPlugin();
    speechPlugin = new SpeechPlugin();

    registry = new ExercisePluginRegistry(
      mcPlugin,
      wrPlugin,
      listeningPlugin,
      sbPlugin,
      fitbPlugin,
      fcPlugin,
      speechPlugin,
    );
  });

  it('registers and retrieves supported plugins', () => {
    expect(registry.hasPlugin('multipleChoice')).toBe(true);
    expect(registry.hasPlugin('wordReading')).toBe(true);
    expect(registry.hasPlugin('listening')).toBe(true);
    expect(registry.hasPlugin('sentenceBuilding')).toBe(true);
    expect(registry.hasPlugin('fillInTheBlank')).toBe(true);
    expect(registry.hasPlugin('flashcard')).toBe(true);
    expect(registry.hasPlugin('speech')).toBe(true);

    expect(registry.getPlugin('listening')).toBe(listeningPlugin);
    // Every constructor argument must land in the map. The count is what
    // catches a plugin added to the registry and forgotten here — which is
    // exactly how `speech` arrived undetected.
    expect(registry.listSupportedTypes()).toHaveLength(7);
  });

  describe('ListeningPlugin', () => {
    it('generates listening questions and grades option selection', () => {
      const choice = { id: 'c1', prompt: 'ねこ', answer: 'cat' };
      const pool = [choice, { id: 'c2', prompt: 'いぬ', answer: 'dog' }, { id: 'c3', prompt: 'とり', answer: 'bird' }, { id: 'c4', prompt: 'うま', answer: 'horse' }];
      const context = { lessonId: 'l1', userId: 'u1', attempt: 0, index: 0, random: () => 0.5 };
      const style = { promptKind: 'vocab' as const, question: () => 'Listen and match:', pool: async () => pool };

      const question = listeningPlugin.generateQuestion(choice, pool, pool, style, context);

      expect(question.type).toBe('listening');
      expect(question.correctOptionId).toBeDefined();

      const result = listeningPlugin.gradeAnswer(question, { optionId: question.correctOptionId });
      expect(result.correct).toBe(true);
      expect(result.correctValue).toBe('ねこ');
    });
  });

  describe('SentenceBuildingPlugin', () => {
    it('generates token arrangement questions and grades token sequences', () => {
      const choice = { id: 's1', prompt: 'わたし は がくせい です', answer: 'I am a student', tokens: ['わたし', 'は', 'がくせい', 'です'] };
      const context = { lessonId: 'l1', userId: 'u1', attempt: 0, index: 0, random: () => 0.1 };
      const style = { promptKind: 'grammar' as const, question: () => 'Arrange:', pool: async () => [] };

      const question = sbPlugin.generateQuestion(choice, [], [], style, context);

      expect(question.type).toBe('sentenceBuilding');
      expect(question.options).toHaveLength(4);

      const result = sbPlugin.gradeAnswer(question, { selectedTokens: ['わたし', 'は', 'がくせい', 'です'] });
      expect(result.correct).toBe(true);
      expect(result.selectedValue).toBe('わたし は がくせい です');
    });
  });

  describe('FillInTheBlankPlugin', () => {
    it('generates cloze questions and grades correctly', () => {
      const choice = { id: 'f1', prompt: 'わたし ( ＿ ) がくせい です', answer: 'は' };
      const pool = [choice, { id: 'f2', prompt: 'か', answer: 'か' }, { id: 'f3', prompt: 'が', answer: 'が' }, { id: 'f4', prompt: 'も', answer: 'も' }];
      const context = { lessonId: 'l1', userId: 'u1', attempt: 0, index: 0, random: () => 0.2 };
      const style = { promptKind: 'grammar' as const, question: () => 'Fill gap:', pool: async () => pool };

      const question = fitbPlugin.generateQuestion(choice, pool, pool, style, context);

      expect(question.type).toBe('fillInTheBlank');
      expect(question.correctOptionId).toBeDefined();

      const result = fitbPlugin.gradeAnswer(question, { optionId: question.correctOptionId });
      expect(result.correct).toBe(true);
    });
  });

  describe('FlashcardPlugin', () => {
    it('generates flashcards and grades self-pass', () => {
      const choice = { id: 'fc1', prompt: '山', answer: 'mountain' };
      const context = { lessonId: 'l1', userId: 'u1', attempt: 0, index: 0, random: () => 0.1 };
      const style = { promptKind: 'kanji' as const, question: () => 'Kanji:', pool: async () => [] };

      const question = fcPlugin.generateQuestion(choice, [], [], style, context);

      expect(question.type).toBe('flashcard');

      const passResult = fcPlugin.gradeAnswer(question, { text: 'pass' });
      expect(passResult.correct).toBe(true);

      const failResult = fcPlugin.gradeAnswer(question, { text: 'fail' });
      expect(failResult.correct).toBe(false);
    });
  });
});
