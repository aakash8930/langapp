import { Link } from '@tanstack/react-router';

import { Icon, type IconName } from '../ui/Icon';
import { ReadingTabs } from './ReadingTabs';

import './reading.css';

type Format = {
  title: string;
  eyebrow: string;
  icon: IconName;
  description: string;
  requirements: string[];
};

const UNAVAILABLE_FORMATS: Format[] = [
  {
    title: 'Articles',
    eyebrow: 'LONG-FORM READING',
    icon: 'newspaper',
    description: 'Authored articles with sections, publication data, and comprehension material.',
    requirements: ['Article records', 'topic and difficulty metadata', 'authored questions'],
  },
  {
    title: 'Stories',
    eyebrow: 'GRADED NARRATIVE',
    icon: 'book-open',
    description: 'Multi-part graded stories with durable reading progress and chapter structure.',
    requirements: ['Story and chapter records', 'authored translations', 'progress persistence'],
  },
  {
    title: 'Manga Reader',
    eyebrow: 'PANEL-BY-PANEL',
    icon: 'panels-top-left',
    description: 'A specialized image-and-dialogue reader with panel order and accessible transcripts.',
    requirements: ['Licensed artwork', 'panel coordinates and order', 'dialogue transcripts'],
  },
  {
    title: 'News',
    eyebrow: 'CURRENT JAPANESE',
    icon: 'radio',
    description: 'Dated news content with source attribution, topics, and a reliable ingestion pipeline.',
    requirements: ['News provider', 'publication dates and sources', 'content refresh pipeline'],
  },
];

export function ReadingFormats() {
  return <div className="page reading-reference"><ReadingTabs active="formats" /><header className="reading-page-header"><div><p className="reading-kicker">CONTENT FORMATS</p><h1>Reading Formats</h1><p>A clear inventory of what can be read now and what requires real authored content before launch.</p></div></header><section className="reading-available-format glass"><div className="reading-format-icon is-live"><Icon name="scroll-text" size={27} /></div><div><div className="reading-live-label"><span /> AVAILABLE NOW</div><h2>Course Sentence Reader</h2><p>Read vocabulary headwords, stored vocabulary examples, and completed grammar examples with configurable aids, corpus dictionary lookup, bookmarks, practice links, and observed local statistics.</p><ul><li><Icon name="check" size={15} /> Study, Assisted, and Immersion modes</li><li><Icon name="check" size={15} /> Translation hidden until revealed</li><li><Icon name="check" size={15} /> Real course-word lookup</li></ul></div><Link className="btn btn-primary" to="/reading-library">Browse readable entries <Icon name="arrow-right" size={15} /></Link></section><div className="reading-formats-intro"><div><p className="reading-kicker">FUTURE CONTENT SURFACES</p><h2>Unavailable until the content model supports them</h2></div><p>Ordinary course sentences are not relabelled as articles, stories, manga, or news.</p></div><section className="reading-format-grid">{UNAVAILABLE_FORMATS.map((format) => <article className="reading-format-card glass" key={format.title}><div className="reading-format-icon"><Icon name={format.icon} size={24} /></div><p className="reading-kicker">{format.eyebrow}</p><h2>{format.title}</h2><p>{format.description}</p><div className="reading-format-status"><Icon name="lock" size={15} /> Not in the current API</div><details><summary>What is needed</summary><ul>{format.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></details></article>)}</section><section className="reading-system-note glass"><Icon name="shield-check" size={19} /><div><h2>Why the boundary matters</h2><p>A trustworthy reading system separates an interactive sentence corpus from authored editorial formats. Manga also needs a genuine panel model—not a speech bubble wrapped around an ordinary sentence.</p></div><Link className="btn btn-secondary btn-sm" to="/read">Back to overview</Link></section></div>;
}
