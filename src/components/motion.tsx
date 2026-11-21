import { useEffect, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

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
