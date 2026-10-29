import type { ReactNode } from "react";
import "../../auth/auth.css";
import "./account.css";

/**
 * Container for the signed-in pages. It never reads the session: the proxy redirects guests away from
 * these paths and each page calls requireUser(). The header comes from the (site) layout.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <main className="container account-main">{children}</main>;
}
