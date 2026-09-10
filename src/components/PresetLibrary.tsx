import { useId, useState } from 'react';
import { ArrowUpRight, Download, Search } from 'lucide-react';
import './PresetLibrary.css';

/** Presentation metadata only. Graph validation and reconstruction live in src/presets. */
export interface PresetLibraryEntry {
  id: string;
  title: string;
  description?: string;
  family: string;
  category: string;
  origin: 'audiobrain' | 'morphazoid';
  status: 'ready' | 'blocked';
  requirements: string[];
  source?: { page: string; url: string; revision: string };
}

export interface PresetLibraryProps {
  entries: readonly PresetLibraryEntry[];
  onLoad: (id: string) => void;
  onAdd: (id: string) => void;
  onExport: (id: string) => void;
  busyId?: string | null;
  error?: string | null;
}

const PAGE_SIZE = 48;

export function PresetLibrary({ entries, onLoad, onAdd, onExport, busyId, error }: PresetLibraryProps) {
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const inputId = useId();
  const families = [...new Set(entries.map(entry => entry.family))].sort();
  const categories = [...new Set(entries.map(entry => entry.category))].sort();
  const searchTerms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = entries.filter(entry => {
    const text = `${entry.title} ${entry.description ?? ''} ${entry.family} ${entry.category} ${entry.id} ${entry.source?.page ?? ''}`.toLocaleLowerCase();
    return (!family || entry.family === family) && (!category || entry.category === category)
      && (!availability || entry.status === availability) && searchTerms.every(term => text.includes(term));
  });
  const visible = filtered.slice(0, visibleCount);
  const hasFilters = Boolean(search || family || category || availability);

  return <div className="preset-library">
    <p className="preset-library-intro">Load replaces the current project. Add keeps it and creates another independent instrument. Both can be undone.</p>
    {error && <p className="preset-library-error" role="alert">{error}</p>}
    {busyId && <p className="preset-library-pending" role="status">Preparing {entries.find(entry => entry.id === busyId)?.title ?? 'preset'}…</p>}
    <div className="preset-library-filters">
      <label className="preset-library-search" htmlFor={`${inputId}-search`}><Search size={15} /><span className="sr-only">Search presets</span><input id={`${inputId}-search`} type="search" placeholder="Find a preset, page or sound…" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} /></label>
      <label>Family<select aria-label="Preset family" value={family} onChange={event => { setFamily(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="">All families</option>{families.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Type<select aria-label="Preset type" value={category} onChange={event => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="">All types</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Availability<select aria-label="Preset availability" value={availability} onChange={event => { setAvailability(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="">All presets</option><option value="ready">Graph ready</option><option value="blocked">Needs features</option></select></label>
    </div>
    <div className="preset-library-results"><span role="status" aria-live="polite">{filtered.length} of {entries.length} presets{visible.length < filtered.length ? ` · showing ${visible.length}` : ''}</span>{hasFilters && <button type="button" className="subtle-button" onClick={() => { setSearch(''); setFamily(''); setCategory(''); setAvailability(''); setVisibleCount(PAGE_SIZE); }}>Clear filters</button>}</div>
    {(['audiobrain', 'morphazoid'] as const).map(origin => {
      const group = visible.filter(entry => entry.origin === origin);
      if (!group.length) return null;
      return <section key={origin} className="preset-library-section" aria-labelledby={`${inputId}-${origin}`}>
        <header><h3 id={`${inputId}-${origin}`}>{origin === 'audiobrain' ? 'AudioBrain examples' : 'Original Morphazoid presets'}</h3><span className="count-badge">{filtered.filter(entry => entry.origin === origin).length}</span></header>
        {origin === 'morphazoid' && <p className="preset-library-explanation">Original names and settings are preserved separately from their pages. Some are reusable parts, such as a grammar or envelope. Each card describes what can be rebuilt in the graph and what still needs features.</p>}
        <div className="preset-library-cards">{group.map(entry => <article key={entry.id} className="preset-card" data-preset-id={entry.id} data-preset-status={entry.status}>
          <div className="preset-card-heading"><h4>{entry.title}</h4><span className={`preset-availability ${entry.status}`}>{entry.status === 'ready' ? 'Graph ready' : 'Needs features'}</span></div>
          <div className="preset-card-kind"><span>{entry.family}</span><span>{entry.category}</span></div>
          {entry.description && <p>{entry.description}</p>}
          {entry.requirements.length > 0 && <div className="preset-requirements"><strong>{entry.status === 'blocked' ? 'Needed to rebuild this preset' : 'Rebuild scope'}</strong><ul>{entry.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul></div>}
          {entry.source && <details className="preset-source"><summary>Original source and identity</summary><code>{entry.id}</code><a href={entry.source.url} target="_blank" rel="noreferrer">{entry.source.page}<ArrowUpRight size={12} /></a><span>Source revision <code>{entry.source.revision.slice(0, 12)}</code></span></details>}
          <div className="preset-card-actions">{entry.status === 'ready' && <><button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => onLoad(entry.id)}>Load {entry.title}</button><button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => onAdd(entry.id)}>Add {entry.title}</button></>}
            <button type="button" className="preset-export" disabled={Boolean(busyId)} aria-label={`Export ${entry.origin === 'morphazoid' ? 'source preset' : 'preset'} ${entry.title}`} title="Export portable preset JSON" onClick={() => onExport(entry.id)}><Download size={13} />{entry.origin === 'morphazoid' ? 'Export source preset' : 'Export preset'}</button>
          </div>
        </article>)}</div>
      </section>;
    })}
    {visible.length < filtered.length && <button type="button" className="secondary-button preset-library-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more presets</button>}
    {!filtered.length && <p className="preset-library-empty">No presets match these filters. Clear them to see the complete library.</p>}
  </div>;
}
