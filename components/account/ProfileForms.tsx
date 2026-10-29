"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addSkill, removeSkill, searchRoles, setCurrentRole, updateDisplayName } from "@/app/(site)/(account)/profile/actions";
import { Button } from "@/components/ds";
import type { OccupationRef } from "@/lib/chat/types";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return { error, setError, pending, startTransition };
}

export function DisplayNameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const { error, setError, pending, startTransition } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateDisplayName(name);
      if (result.error) setError(result.error);
      else setSaved(name.trim());
    });
  };

  return (
    <form onSubmit={submit} className="account-section" noValidate>
      <div className="field">
        <label htmlFor="display-name">Name</label>
        <input
          id="display-name"
          type="text"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "display-name-error" : undefined}
        />
      </div>
      {error ? (
        <p id="display-name-error" role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending || name.trim() === saved}>
          Save name
        </Button>
      </div>
    </form>
  );
}

export function CurrentRoleForm({ current }: { current: OccupationRef | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OccupationRef[] | null>(null);
  const { error, setError, pending, startTransition } = useAction();

  const search = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await searchRoles(query);
      if (result.error) setError(result.error);
      setResults(result.error ? null : result.results);
    });
  };

  const choose = (soc: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await setCurrentRole(soc);
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
        <span className="type-label">Current role</span>
        <strong>{current ? current.title : "Not set"}</strong>
      </p>

      <form onSubmit={search} className="account-inline" noValidate>
        <div className="field">
          <label htmlFor="role-search">Search for your role</label>
          <input
            id="role-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-describedby="role-search-hint"
          />
          <span id="role-search-hint" className="hint">
            Titles follow O*NET wording, such as Secondary School Teachers.
          </span>
        </div>
        <Button type="submit" variant="secondary" disabled={pending || query.trim().length < 2}>
          Find roles
        </Button>
      </form>

      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}

      {results ? (
        results.length > 0 ? (
          <ul className="account-results" aria-label="Matching roles">
            {results.map((r) => (
              <li key={r.soc}>
                <Button variant="secondary" onClick={() => choose(r.soc)} disabled={pending}>
                  Use {r.title}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">No roles matched. Try other words from the job title.</p>
        )
      ) : null}

      {current ? (
        <div>
          <Button variant="secondary" onClick={() => choose(null)} disabled={pending}>
            Clear current role
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface SkillItem {
  id: string;
  name: string;
}

export function SkillsEditor({ skills }: { skills: SkillItem[] }) {
  const [name, setName] = useState("");
  const { error, setError, pending, startTransition } = useAction();

  const add = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addSkill(name);
      if (result.error) setError(result.error);
      else setName("");
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeSkill(id);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="account-section">
      {skills.length > 0 ? (
        <ul className="account-skills" aria-label="Your skills">
          {skills.map((s) => (
            <li key={s.id} className="account-skill">
              <span>{s.name}</span>
              <button type="button" onClick={() => remove(s.id)} disabled={pending} aria-label={`Remove ${s.name}`}>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>You have not added any skills yet.</p>
      )}

      <form onSubmit={add} className="account-inline" noValidate>
        <div className="field">
          <label htmlFor="skill-name">Add a skill</label>
          <input
            id="skill-name"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "skill-error" : undefined}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || name.trim() === ""}>
          Add skill
        </Button>
      </form>
      {error ? (
        <p id="skill-error" role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
