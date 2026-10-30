"use client";

import { useState, useTransition } from "react";

/** Error + pending state shared by the account forms. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return { error, setError, pending, startTransition };
}
