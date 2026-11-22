import DotSpinner from './DotSpinner';

export function BusyGlyph() {
  return <DotSpinner compact />;
}

export default function BusyIndicator({ title, detail, kind = 'save' }: {
  title: string; detail?: string; kind?: 'photo' | 'ai' | 'save';
}) {
  return <div className={`busy-indicator busy-${kind}`} role="status" aria-live="polite" aria-atomic="true">
    <DotSpinner />
    <div className="busy-copy"><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
  </div>;
}
