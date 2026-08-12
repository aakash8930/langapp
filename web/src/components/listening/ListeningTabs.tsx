import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';

export function ListeningTabs({ active }: { active: 'lessons' | 'shadowing' | 'quiz' }) {
  return <nav className="listening-tabs glass" aria-label="Listening sections"><Link className={active === 'lessons' ? 'is-active' : ''} to="/listening" aria-current={active === 'lessons' ? 'page' : undefined}><Icon name="headphones" size={16} /> Listening lessons</Link><Link className={active === 'shadowing' ? 'is-active' : ''} to="/listening-shadowing" aria-current={active === 'shadowing' ? 'page' : undefined}><Icon name="mic" size={16} /> Shadowing</Link><Link className={active === 'quiz' ? 'is-active' : ''} to="/listening-quiz" aria-current={active === 'quiz' ? 'page' : undefined}><Icon name="sparkles" size={16} /> Listening quiz</Link><Link to="/review"><Icon name="refresh-cw" size={16} /> Review</Link></nav>;
}
