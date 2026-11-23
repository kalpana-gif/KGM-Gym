import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChartNoAxesCombined, Dumbbell, History, LayoutDashboard, Utensils } from 'lucide-react';
import { useApp } from '../context';
import './MobileNavigation.css';

const primaryPages = [
  { key: 'today', label: 'Today', icon: LayoutDashboard },
  { key: 'food', label: 'Food', icon: Utensils },
  { key: 'history', label: 'History', icon: History },
  { key: 'plan', label: 'Plan', accessibleLabel: 'Meal plan', icon: CalendarDays },
  { key: 'workouts', label: 'Move', accessibleLabel: 'Workouts', icon: Dumbbell },
  { key: 'progress', label: 'Progress', icon: ChartNoAxesCombined },
];

export default function MobileNavigation({ page }: { page: string }) {
  const { navigate } = useApp();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const maskId = `mobile-nav-${useId().replaceAll(':', '')}`;
  const [width, setWidth] = useState(() => Math.min(480, window.innerWidth - 24));
  useEffect(() => {
    const element = ref.current!;
    const observer = new ResizeObserver(([entry]) => {
      const measuredWidth = entry.borderBoxSize[0]?.inlineSize ?? element.getBoundingClientRect().width;
      if (measuredWidth > 0) setWidth(measuredWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const activeIndex = Math.max(0, primaryPages.findIndex(item => item.key === page));
  const gutter = Math.max(2, Math.min(12, (width - 44 * primaryPages.length) / 2));
  const center = gutter + (width - gutter * 2) * (activeIndex + .5) / primaryPages.length;
  const diameter = width < 340 ? 40 : 44;
  const transition = reduce ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 340, damping: 34, mass: .9 };
  return <nav ref={ref} className="bottom-nav mobile-nav" aria-label="Mobile navigation" style={{ paddingInline: gutter }}>
    <svg className="mobile-nav-surface" width="100%" height="82" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height="82">
          <rect width={width} height="82" fill="white" />
          <motion.circle initial={false} animate={{ cx: center, r: diameter / 2 + 4 }}
            cy="30" fill="black" transition={transition} />
        </mask>
      </defs>
      <rect x=".5" y="22" width={Math.max(0, width - 1)} height="59.5" rx="20"
        fill="var(--charcoal)" stroke="#FFFFFF12" mask={`url(#${maskId})`} />
    </svg>
    <motion.span className="mobile-nav-bubble" aria-hidden="true" initial={false}
      style={{ width: diameter, height: diameter }}
      animate={{ x: center - diameter / 2, y: 30 - diameter / 2 }} transition={transition} />
    {primaryPages.map(({ key, label, accessibleLabel, icon: Icon }) => <button type="button" key={key}
      aria-label={accessibleLabel ?? label} aria-current={page === key ? 'page' : undefined}
      className={page === key ? 'active' : ''} onClick={() => navigate(key)}>
      <motion.span className="mobile-nav-icon" initial={false}
        animate={{ y: page === key ? -14 : 0, scale: page === key ? 1.04 : 1 }}
        whileTap={reduce ? undefined : { scale: .9 }}
        transition={transition}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></motion.span>
      <span className="mobile-nav-label">{label}</span>
    </button>)}
  </nav>;
}
