"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "./shared";

/**
 * A div that gains the `md-in-view` class the first time it scrolls into view and keeps it. One-shot
 * entrance animations (see motion.css) wait for that class, so a chart below the fold plays when you reach
 * it instead of finishing before you scroll there. The children can be server-rendered.
 */
export function InView({
  className,
  style,
  active = true,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  /** Set false where no entrance animation is wanted, so no observer is created. */
  active?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!active || !el || seen) return;
    // Without IntersectionObserver there is nothing to wait for: play now.
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(t);
    }
    // Trigger a little before the bottom edge so tall elements start as their top comes into view.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, seen]);

  return (
    <div ref={ref} className={cx(className, seen && "md-in-view")} style={style}>
      {children}
    </div>
  );
}
