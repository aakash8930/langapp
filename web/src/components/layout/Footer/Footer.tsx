import { Link } from '@tanstack/react-router';
import './Footer.css';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Courses', to: '/courses' },
      { label: 'JLPT Prep', to: '/jlpt' },
      { label: 'Practice Hub', to: '/practice-hub' },
      { label: 'AI Tutor', to: '/practice' },
      { label: 'Free MVP access', to: '/plans' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Blog', to: '/blog' },
      { label: 'Careers', to: '/careers' },
      { label: 'Press Kit', to: '/press-kit' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', to: '/documentation' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Roadmap', to: '/roadmap' },
      { label: 'Changelog', to: '/changelog' },
      { label: 'Status', to: '/status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Refund Policy', to: '/refund-policy' },
      { label: 'Cookie Policy', to: '/cookies' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-grid">
        {columns.map((col) => (
          <div key={col.title} className="footer-col">
            <h4 className="footer-title">{col.title}</h4>
            {col.links.map((link) => (
              <Link key={link.label} className="footer-link" to={link.to}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <p className="footer-copy">&copy; {new Date().getFullYear()} GENKŌ. All rights reserved.</p>
      </div>
    </footer>
  );
}
