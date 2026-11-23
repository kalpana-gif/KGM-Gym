/*
From Uiverse.io by zebra76966 - https://uiverse.io/zebra76966/brown-emu-91
MIT License, Copyright (c) zebra76966 (Rohit Sharma)
*/
import type { ButtonHTMLAttributes } from 'react';
import { Plus } from 'lucide-react';
import './LogMealButton.css';

export default function LogMealButton({ full = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean }) {
  return <button type="button" {...props} className={`kgm-log-meal${full ? ' kgm-log-meal--full' : ''} ${className}`}>
    <span className="kgm-log-meal__main">
      <span className="kgm-log-meal__icon" aria-hidden="true">
        <Plus size={18} strokeWidth={2.5} />
      </span>
      <span>Log a meal</span>
    </span>
  </button>;
}
