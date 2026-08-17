import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';

export function GrammarTabs({ active }: { active: 'list' | 'exercises' | 'quiz' }) {
  return <nav className="grammar-tabs glass" aria-label="Grammar sections"><Link className={active === 'list' ? 'is-active' : ''} to="/grammar" aria-current={active === 'list' ? 'page' : undefined}><Icon name="grid" size={16} /> Grammar list</Link><Link className={active === 'exercises' ? 'is-active' : ''} to="/grammar-exercises" aria-current={active === 'exercises' ? 'page' : undefined}><Icon name="pen-square" size={16} /> Exercises</Link><Link className={active === 'quiz' ? 'is-active' : ''} to="/grammar-quiz" aria-current={active === 'quiz' ? 'page' : undefined}><Icon name="sparkles" size={16} /> Quiz</Link><Link to="/practice-hub"><Icon name="refresh-cw" size={16} /> Practice</Link></nav>;
}
