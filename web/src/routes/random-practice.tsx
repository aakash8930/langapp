import { createFileRoute } from '@tanstack/react-router';
import { RandomPracticePage } from '../components/practice/PracticeModes';
import type { PracticeSkill } from '../components/practice/practiceTypes';

const SKILLS: PracticeSkill[] = ['vocabulary', 'kanji', 'grammar', 'reading'];

export const Route = createFileRoute('/random-practice')({
  validateSearch: (search: Record<string, unknown>): { skill?: PracticeSkill } => ({
    skill: typeof search.skill === 'string' && SKILLS.includes(search.skill as PracticeSkill)
      ? search.skill as PracticeSkill
      : undefined,
  }),
  component: RandomPracticeRoute,
});

function RandomPracticeRoute() {
  const { skill } = Route.useSearch();
  return <RandomPracticePage initialSkill={skill} />;
}
