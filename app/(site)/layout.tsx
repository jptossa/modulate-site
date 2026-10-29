import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import "./site.css";

/** Shared chrome for every page except /auth/*, which has its own minimal layout. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-page">
      <SiteHeader />
      <div className="site-body">{children}</div>
    </div>
  );
}
