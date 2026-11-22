import { Camera, Save, Sparkles } from 'lucide-react';

export function BusyGlyph() {
  return <span className="busy-glyph" aria-hidden="true" />;
}

export default function BusyIndicator({ title, detail, kind = 'save' }: {
  title: string; detail?: string; kind?: 'photo' | 'ai' | 'save';
}) {
  const Icon = kind === 'ai' ? Sparkles : kind === 'photo' ? Camera : Save;
  return <div className={`busy-indicator busy-${kind}`} role="status" aria-live="polite" aria-atomic="true">
    <span className="busy-orbit" aria-hidden="true"><Icon size={22} /></span>
    <div className="busy-copy"><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
    <span className="busy-dots" aria-hidden="true"><i /><i /><i /></span>
  </div>;
}
