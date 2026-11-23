import { useEffect, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

export function SegmentHighlight({ id }: { id: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <span className="segment-highlight" aria-hidden="true" />;
  return <motion.span className="segment-highlight" aria-hidden="true"
    layoutId={id} initial={false} style={{ borderRadius: 9 }}
    transition={{ type: 'spring', stiffness: 520, damping: 38, mass: .8 }}
  />;
}

export function SlidingContent({ children, activeKey, direction }: { children: ReactNode; activeKey: string; direction: number }) {
  const reduce = useReducedMotion();
  return <div className="sliding-content">
    <motion.div key={activeKey}
      initial={reduce ? false : { opacity: 0, x: direction * 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduce ? 0 : .24, ease: [.22, 1, .36, 1] }}
    >{children}</motion.div>
  </div>;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return <motion.div
    className="page-transition"
    initial={reduce ? false : { opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? 0 : .24, ease: [.22, 1, .36, 1] }}
  >{children}</motion.div>;
}

export function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const current = useMotionValue(value);
  const formatted = useTransform(current, n => Math.round(n).toLocaleString());
  useEffect(() => {
    if (reduce) { current.set(value); return; }
    const controls = animate(current, value, { duration: .55, ease: [.22, 1, .36, 1] });
    return () => controls.stop();
  }, [value, reduce, current]);
  return <><span className="sr-only">{Math.round(value).toLocaleString()}</span><motion.span aria-hidden="true">{formatted}</motion.span></>;
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className}
    initial={reduce ? false : { opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: .08 }}
    transition={{ duration: reduce ? 0 : .3, delay: reduce ? 0 : delay, ease: [.22, 1, .36, 1] }}
  >{children}</motion.div>;
}
