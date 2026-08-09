import { Link } from '@tanstack/react-router';

import type { RoutePath } from '../../types/layout';
import { Icon, type IconName } from '../ui/Icon';

/**
 * Practice by skill — half-live, half-placeholder.
 *
 * ## What is live
 *
 * Vocabulary, Kanji and Grammar each have their own route today — the card
 * keeps those links working because they are part of what a learner can
 * actually do. Listening and Speaking do not (no audio is seeded for the
 * speaking drills, and the listening endpoint is not yet wired), so the
 * fourth row is labelled rather than fabricated.
 */
const SKILLS: { id: string; label: string; icon: IconName; to: RoutePath }[] = [
  { id: 'vocab', label: 'Vocabulary', icon: 'book-open', to: '/vocabulary' },
  { id: 'kanji', label: 'Kanji', icon: 'pen-tool', to: '/kanji' },
  { id: 'grammar', label: 'Grammar', icon: 'languages', to: '/grammar' },
];

export function PracticeBySkill() {
  return (
    <section className="card practice-skill-card glass" aria-labelledby="practice-skill-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="practice-skill-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="pen-square" size={18} />
          </span>
          Practice by skill
        </h2>
      </div>

      <ul className="skill-list">
        {SKILLS.map((skill) => (
          <li key={skill.id}>
            <Link className="skill-row" to={skill.to}>
              <span className="skill-row-icon" aria-hidden="true">
                <Icon name={skill.icon} size={16} />
              </span>
              <span className="skill-row-label">{skill.label}</span>
              <span className="skill-row-chevron" aria-hidden="true">
                <Icon name="chevron-right" size={14} />
              </span>
            </Link>
          </li>
        ))}
        <li className="skill-row skill-row-soon">
          <span className="skill-row-icon" aria-hidden="true">
            <Icon name="headphones" size={16} />
          </span>
          <span className="skill-row-label">Listening &amp; Speaking</span>
          <span className="placeholder-pill">More skills soon</span>
        </li>
      </ul>
    </section>
  );
}