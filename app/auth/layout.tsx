import { Logo } from "@/components/Logo";
import "./auth.css";

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="auth-page">
      <header className="container auth-header">
        <Logo />
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}
