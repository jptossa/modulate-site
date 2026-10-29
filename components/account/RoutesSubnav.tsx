import Link from "next/link";

const VIEWS = [
  { id: "list", href: "/routes", label: "List" },
  { id: "visualize", href: "/routes/visualize", label: "Visualize" },
] as const;

/** Switches between the editing list and the visual comparison. Server component: the page says which is current. */
export function RoutesSubnav({ current }: { current: (typeof VIEWS)[number]["id"] }) {
  return (
    <nav aria-label="Routes views" className="routes-subnav">
      {VIEWS.map((v) => (
        <Link key={v.id} href={v.href} aria-current={v.id === current ? "page" : undefined}>
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
