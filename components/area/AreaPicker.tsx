"use client";

// The field, hint and account-* styles live with the account pages; the picker brings them wherever it is used.
import "@/app/auth/auth.css";
import "@/app/(site)/(account)/account.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAction } from "@/components/account/useAction";
import { Button, Chip } from "@/components/ds";
import type { AreaRef } from "@/lib/chat/types";
import { searchAreaOptions, setArea } from "@/lib/area-actions";

const KIND_LABEL: Record<AreaRef["kind"], string> = {
  national: "National",
  state: "State",
  metro: "Metro area",
  nonmetro: "Nonmetropolitan area",
};

/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 250;

/** "Dallas-Fort Worth-Arlington, TX" -> "Dallas": BLS names metros after several cities, which is too long for a chip. */
const shortName = (name: string) => name.split(/[-,]/)[0].trim();

/**
 * Search-and-pick for the place local market data is shown for. Works for guests (cookie) and signed-in users (profile).
 * Results appear as you type; `suggestions` are one-click shortcuts shown until a place is set.
 */
export function AreaPicker({ current, id = "area", suggestions = [] }: { current: AreaRef | null; id?: string; suggestions?: AreaRef[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AreaRef[] | null>(null);
  const { error, setError, pending, startTransition } = useAction();
  // Only the newest search may write results, so a slow early response never replaces a later one.
  const latest = useRef(0);

  const run = (q: string) => {
    const ticket = ++latest.current;
    setError(null);
    startTransition(async () => {
      const result = await searchAreaOptions(q);
      if (ticket !== latest.current) return;
      if (result.error) setError(result.error);
      setResults(result.error ? null : result.results);
    });
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => run(q), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `run` only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onType = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      latest.current++;
      setResults(null);
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) run(query.trim());
  };

  const choose = (code: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await setArea(code);
      if (result.error) {
        setError(result.error);
        return;
      }
      latest.current++;
      setResults(null);
      setQuery("");
    });
  };

  return (
    <div className="account-section">
      <p className="account-current">
        <span className="type-label">Your place</span>
        <strong>{current ? current.name : "Not set"}</strong>
      </p>

      {!current && suggestions.length > 0 ? (
        <div className="account-suggestions">
          <span id={`${id}-popular`} className="type-label">
            Popular places
          </span>
          <div className="md-row" role="group" aria-labelledby={`${id}-popular`}>
            {suggestions.map((s) => (
              <Chip key={s.code} onClick={() => choose(s.code)}>
                {shortName(s.name)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={search} className="account-inline" noValidate>
        <div className="field">
          <label htmlFor={`${id}-search`}>Search for a state or metro area</label>
          <input
            id={`${id}-search`}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => onType(e.target.value)}
            aria-describedby={`${id}-search-hint`}
          />
          <span id={`${id}-search-hint`} className="hint">
            Try a city or a state, such as Austin or Ohio. We keep only the place, never an address.
          </span>
        </div>
        <Button type="submit" variant="secondary" disabled={pending || query.trim().length < 2}>
          Find places
        </Button>
      </form>

      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}

      {results ? (
        results.length > 0 ? (
          <ul className="account-results" aria-label="Matching places">
            {results.map((r) => (
              <li key={r.code}>
                <Button variant="secondary" onClick={() => choose(r.code)} disabled={pending}>
                  Use {r.name} ({KIND_LABEL[r.kind].toLowerCase()})
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">No places matched. Try the city or state name.</p>
        )
      ) : null}

      {current ? (
        <div>
          <Button variant="secondary" onClick={() => choose(null)} disabled={pending}>
            Clear place
          </Button>
        </div>
      ) : null}
    </div>
  );
}
