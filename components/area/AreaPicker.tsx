"use client";

// The field, hint and account-* styles live with the account pages; the picker brings them wherever it is used.
import "@/app/auth/auth.css";
import "@/app/(site)/(account)/account.css";
import { useState, type FormEvent } from "react";
import { useAction } from "@/components/account/useAction";
import { Button } from "@/components/ds";
import type { AreaRef } from "@/lib/chat/types";
import { searchAreaOptions, setArea } from "@/lib/area-actions";

const KIND_LABEL: Record<AreaRef["kind"], string> = {
  national: "National",
  state: "State",
  metro: "Metro area",
  nonmetro: "Nonmetropolitan area",
};

/** Search-and-pick for the place local market data is shown for. Works for guests (cookie) and signed-in users (profile). */
export function AreaPicker({ current, id = "area" }: { current: AreaRef | null; id?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AreaRef[] | null>(null);
  const { error, setError, pending, startTransition } = useAction();

  const search = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await searchAreaOptions(query);
      if (result.error) setError(result.error);
      setResults(result.error ? null : result.results);
    });
  };

  const choose = (code: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await setArea(code);
      if (result.error) {
        setError(result.error);
        return;
      }
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

      <form onSubmit={search} className="account-inline" noValidate>
        <div className="field">
          <label htmlFor={`${id}-search`}>Search for a state or metro area</label>
          <input
            id={`${id}-search`}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
