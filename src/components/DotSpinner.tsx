/*
From Uiverse.io by abrahamcalsin - https://uiverse.io/abrahamcalsin/serious-turkey-52
MIT License, Copyright (c) abrahamcalsin (Abraham Calsin)
*/
import './DotSpinner.css';

export default function DotSpinner({ compact = false }: { compact?: boolean }) {
  return <span className={`kgm-dot-spinner${compact ? ' kgm-dot-spinner--compact' : ''}`} aria-hidden="true">
    {Array.from({ length: 8 }, (_, index) => <span className="kgm-dot-spinner__dot" key={index} />)}
  </span>;
}
