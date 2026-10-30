import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CurrentRoleForm, DisplayNameForm, SkillsEditor } from "@/components/account/ProfileForms";
import { AreaPicker } from "@/components/area/AreaPicker";
import { requireUser } from "@/lib/auth";
import type { AreaKind } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <div className="account-narrow">
      <header className="account-head">
        <h1 className="type-heading" style={{ color: "var(--ink)" }}>
          Your profile
        </h1>
        <p className="type-lead">What you tell us here shapes the routes the assistant suggests.</p>
      </header>
      <Suspense fallback={<p role="status">Loading your profile…</p>}>
        <ProfileSections />
      </Suspense>
    </div>
  );
}

async function ProfileSections() {
  // See the note in routes/page.tsx.
  await connection();
  const user = await requireUser("/profile");
  const supabase = await createClient();
  const [profile, skills] = await Promise.all([
    supabase.from("profiles").select("display_name, current:occupations!current_soc(soc_code, title), area:areas!area_code(area_code, name, kind)").eq("id", user.id).maybeSingle(),
    supabase.from("user_skills").select("id, free_text, skill:skills(name)").eq("user_id", user.id).order("created_at"),
  ]);

  if (profile.error || skills.error) {
    return (
      <p role="alert" className="auth-error">
        We could not load your profile. Refresh the page to try again.
      </p>
    );
  }

  const current = profile.data?.current as unknown as { soc_code: string; title: string } | null | undefined;
  const area = profile.data?.area as unknown as { area_code: string; name: string; kind: AreaKind } | null | undefined;
  const skillItems =(skills.data ?? []).map((s) => ({
    id: s.id as string,
    name: ((s.skill as unknown as { name: string } | null)?.name ?? s.free_text ?? "") as string,
  }));

  return (
    <div className="account-sections">
      <section aria-labelledby="about-title">
        <h2 id="about-title" className="type-card-title" style={{ color: "var(--ink)" }}>
          About you
        </h2>
        <p className="hint">Signed in as {user.email ?? "your account"}.</p>
        <DisplayNameForm initial={profile.data?.display_name ?? ""} />
      </section>

      <section aria-labelledby="role-title">
        <h2 id="role-title" className="type-card-title" style={{ color: "var(--ink)" }}>
          Where you are today
        </h2>
        <CurrentRoleForm current={current ? { soc: current.soc_code, title: current.title } : null} />
      </section>

      <section aria-labelledby="place-title">
        <h2 id="place-title" className="type-card-title" style={{ color: "var(--ink)" }}>
          Where you work
        </h2>
        <p className="hint">Shows local pay and job counts next to the national figures.</p>
        <AreaPicker current={area ? { code: area.area_code, name: area.name, kind: area.kind } : null} />
      </section>

      <section aria-labelledby="skills-title">
        <h2 id="skills-title" className="type-card-title" style={{ color: "var(--ink)" }}>
          Your skills
        </h2>
        <SkillsEditor skills={skillItems} />
      </section>
    </div>
  );
}
