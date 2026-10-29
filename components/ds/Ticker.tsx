"use client";

import { useState } from "react";
import { cx, type Trend } from "./shared";
import { usePrefersReducedMotion } from "./motion";
import { TrendPill } from "./indicators";

/**
 * Scroll time per item, so the speed stays about the same however many items there are (each is roughly
 * 350px wide, so 5s is about 70px per second). A fixed duration made long lists race.
 */
const SECONDS_PER_ITEM = 5;

export interface TickerItem {
  role: string;
  trend: Trend;
}

export interface TickerProps {
  items: TickerItem[];
  label?: string;
}

/** Scrolling strip of role trends. Animation stops with the Pause button and for reduced-motion users. */
export function Ticker({ items, label }: TickerProps) {
  const reduced = usePrefersReducedMotion();
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduced;

  const set = (hidden: boolean) => (
    <div className="md-ticker-set" aria-hidden={hidden ? "true" : undefined}>
      {items.map((it, i) => (
        <span key={i} className="md-ticker-item">
          {it.role}
          <TrendPill trend={it.trend} />
        </span>
      ))}
    </div>
  );

  return (
    <div role="region" aria-label={label ?? "Job market trends"} className={cx("md-ticker", paused && "md-ticker-paused")}>
      <button type="button" className="md-ticker-pause" onClick={() => setUserPaused(!paused)}>
        <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
          <path
            d={paused ? "M5 3 L13 8 L5 13 Z" : "M5 3 V13 M11 3 V13"}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {paused ? "Play animations" : "Pause animations"}
      </button>
      <div className="md-ticker-window">
        <div className="md-ticker-track" style={{ animationDuration: `${Math.max(items.length, 1) * SECONDS_PER_ITEM}s` }}>
          {set(false)}
          {set(true)}
        </div>
      </div>
    </div>
  );
}
