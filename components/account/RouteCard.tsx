"use client";

import { useState, useTransition } from "react";
import { deleteRoute, updateRouteNotes, updateRouteStatus } from "@/app/(site)/(account)/routes/actions";
import { Button, SegmentedControl } from "@/components/ds";
import type { RouteStatus, SavedRouteRow } from "@/lib/chat/types";
import { ROUTE_STATUSES, ROUTE_STATUS_LABELS } from "@/lib/routes";

const OPTIONS = ROUTE_STATUSES.map((id) => ({ id, label: ROUTE_STATUS_LABELS[id] }));

/** One saved route: origin to destination, a status control, notes, and removal. */
export function RouteCard({ route }: { route: SavedRouteRow }) {
  const [status, setStatus] = useState<RouteStatus>(route.status);
  const [notes, setNotes] = useState(route.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(route.notes ?? "");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changeStatus = (next: string) => {
    const previous = status;
    setStatus(next as RouteStatus);
    setError(null);
    startTransition(async () => {
      const result = await updateRouteStatus(route.id, next);
      if (result.error) {
        setStatus(previous);
        setError(result.error);
      }
    });
  };

  const saveNotes = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateRouteNotes(route.id, notes);
      if (result.error) setError(result.error);
      else setSavedNotes(notes.trim());
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoute(route.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  };

  const titleId = `route-${route.id}`;
  const notesChanged = notes.trim() !== savedNotes;

  return (
    <li className="route-card" aria-labelledby={titleId} aria-busy={pending}>
      <div className="route-card-head">
        <h2 id={titleId} className="type-card-title" style={{ color: "var(--ink)" }}>
          {route.origin.title} to {route.destination.title}
        </h2>
      </div>

      <SegmentedControl label={`Status of the route to ${route.destination.title}`} options={OPTIONS} value={status} onChange={changeStatus} />

      <div className="field">
        <label htmlFor={`notes-${route.id}`}>Notes</label>
        <textarea
          id={`notes-${route.id}`}
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Courses to look at, people to talk to, dates."
        />
      </div>

      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}

      <div className="route-card-actions">
        <Button variant="secondary" onClick={saveNotes} disabled={pending || !notesChanged}>
          Save notes
        </Button>
        {confirming ? (
          <>
            <Button variant="secondary" onClick={remove} disabled={pending}>
              Confirm removal
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Keep route
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={pending}>
            Remove route
          </Button>
        )}
      </div>
    </li>
  );
}
