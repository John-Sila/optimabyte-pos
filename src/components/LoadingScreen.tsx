import React, { useEffect, useRef, useState } from 'react';

type SystemLoadingBarProps = {
  active: boolean;
  className?: string;
};

export default function SystemLoadingBar({ active, className = '' }: SystemLoadingBarProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      targetRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = now - start;

      const t = Math.min(elapsed / 1800, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      const target = 8 + eased * 84;
      targetRef.current = Math.min(targetRef.current + 0.9, target);

      setProgress((prev) => {
        const next = prev + (targetRef.current - prev) * 0.18;
        return Math.min(next, 92);
      });

      if (active) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return (
    <div className={`w-full ${className}`}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-[width] duration-200 ease-out"
          style={{ width: `${active ? progress : 0}%` }}
        />
      </div>
    </div>
  );
}