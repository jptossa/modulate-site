"use client";

import { useState, useTransition, type FormEvent } from "react";
import "@/app/auth/auth.css";
import "@/app/(site)/(account)/account.css";
import { Button } from "@/components/ds";
import type { MilitaryMatch } from "@/lib/chat/types";
import { findMilitaryCodes, militaryLandingOrigin } from "@/lib/landing/military-actions";
import type { LandingOrigin } from "@/lib/landing/types";
import { militaryName } from "@/lib/military/labels";

/**
 * Collapsed picker in the hero: a military code finds the civilian roles O*NET links it to, and choosing one adds
 * it as an origin chip. Reference data only, so it works for guests and needs no session.
 */
export function LandingMilitary({ onOrigin }: { onOrigin: (origin: LandingOrigin) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MilitaryMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await findMilitaryCodes(query);
      if (result.error) setError(result.error);
      setResults(result.error ? null : result.results);
    });
  };

  const choose = (match: MilitaryMatch, soc: string) => {
    setError(null);
    startTransition(async () => {
      const result = await militaryLandingOrigin(match.id, soc);
      if (result.error || !result.origin) {
        setError(result.error ?? "Could not build routes from that code.");
        return;
      }
      onOrigin(result.origin);
      setResults(null);
      setQuery("");
    });
  };

  return (
    <details className="lp-place">
      <summary>Start from a military code</summary>
      <div className="account-section">
        <form onSubmit={search} className="account-inline" noValidate>
          <div className="field">
            <label htmlFor="lp-military">Search by code or title</label>
            <input
              id="lp-military"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-describedby="lp-military-hint"
            />
            <span id="lp-military-hint" className="hint">
              An Army MOS, Navy rating, Air Force AFSC, Marine MOS or Coast Guard rating, such as 68W or hospital corpsman.
            </span>
          </div>
          <Button type="submit" variant="secondary" disabled={pending || query.trim().length < 1}>
            Find codes
          </Button>
        </form>

        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}

        {results ? (
          results.length > 0 ? (
            <ul className="account-results" aria-label="Matching military codes">
              {results.map((m) => (
                <li key={m.id}>
                  <p>{`${militaryName(m)}, ${m.title}${m.active ? "" : " (retired code)"}`}</p>
                  <div className="md-row">
                    {m.roles.map((r) => (
                      <Button key={r.soc} variant="secondary" onClick={() => choose(m, r.soc)} disabled={pending}>
                        {`Start from ${r.title}`}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">No civilian match found. Check the code, or ask in chat about what the work involved.</p>
          )
        ) : null}
      </div>
    </details>
  );
}
