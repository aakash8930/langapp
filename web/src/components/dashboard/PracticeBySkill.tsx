import { Link } from '@tanstack/react-router';

import type { RoutePath } from '../../types/layout';
import { Icon, type IconName } from '../ui/Icon';

const SKILLS: {
  id: string;
  label: string;
  note: string;
  icon: IconName;
  to: RoutePath;
}[] = [
  { id: 'reading', label: 'Reading', note: 'Strengthen comprehension', icon: 'book-open', to: '/read' },
  { id: 'listening', label: 'Listening', note: 'Train your ear', icon: 'headphones', to: '/listening' },
  { id: 'speaking', label: 'Speaking', note: 'Practise confidently', icon: 'mic', to: '/speaking' },
  { id: 'writing', label: 'Writing', note: 'Build muscle memory', icon: 'pen-tool', to: '/hiragana-writing' },
];

export function PracticeBySkill() {
  return (
    <section className="dashboard-section practice-skill-card" aria-labelledby="practice-skill-heading">
      <div className="dashboard-section-head">
        <h2 id="practice-skill-heading">Practice by skill</h2>
        <Link to="/practice-hub">View all</Link>
      </div>

      <ul className="practice-skill-grid">
        {SKILLS.map((skill) => (
          <li key={skill.id}>
            <Link className="practice-skill-tile glass" to={skill.to}>
              <span className="practice-skill-icon" aria-hidden="true">
                <Icon name={skill.icon} size={24} />
              </span>
              <strong>{skill.label}</strong>
              <small>{skill.note}</small>
              <span className="practice-skill-rule" aria-hidden="true" />
              <span className="practice-skill-cta">Start practice</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
