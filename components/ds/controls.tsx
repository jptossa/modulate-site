"use client";

import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx, type Tone } from "./shared";

/* Button */

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /** primary: blue, the one main action. secondary: outlined. inverse: navy, for use on coral. */
  variant?: "primary" | "secondary" | "inverse";
  size?: "md" | "lg";
  /** Renders a link instead of a button. Paths starting with "/" use next/link. */
  href?: string;
  className?: string;
  children?: ReactNode;
}

export function Button({ variant = "primary", size = "md", href, className, children, ...rest }: ButtonProps) {
  const cls = cx("md-btn", `md-btn-${variant}`, size === "lg" && "md-btn-lg", className);
  if (href) {
    return href.startsWith("/") ? (
      <Link href={href} className={cls}>
        {children}
      </Link>
    ) : (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" {...rest} className={cls}>
      {children}
    </button>
  );
}

/* Chip */

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export function Chip({ selected, onClick, className, children }: ChipProps) {
  return (
    <button type="button" className={cx("md-chip", className)} aria-pressed={selected ? "true" : "false"} onClick={onClick}>
      {children}
    </button>
  );
}

/* SegmentedControl */

export interface SegmentedOption {
  id: string;
  label: string;
  /** CSS colour for a small dot before the label. */
  swatch?: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Accessible name of the group. */
  label: string;
  tone?: Tone;
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  label,
  tone = "light",
}: SegmentedControlProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.id);
  const current = value !== undefined ? value : inner;
  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };
  return (
    <div role="group" aria-label={label} className={cx("md-seg", `md-seg-${tone}`)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="md-seg-opt"
          aria-pressed={current === o.id ? "true" : "false"}
          onClick={() => select(o.id)}
        >
          {o.swatch ? <span className="md-swatch" aria-hidden="true" style={{ background: o.swatch }} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}
