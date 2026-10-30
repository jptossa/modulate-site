// Client-safe labels for the military_occupations columns.
export type MilitaryBranch = "army" | "navy" | "air_force" | "marine_corps" | "coast_guard" | "space_force";
export type MilitaryCategory = "enlisted" | "officer" | "warrant";

export const BRANCH_LABEL: Record<MilitaryBranch, string> = {
  army: "Army",
  navy: "Navy",
  air_force: "Air Force",
  marine_corps: "Marine Corps",
  coast_guard: "Coast Guard",
  space_force: "Space Force",
};

export const CATEGORY_LABEL: Record<MilitaryCategory, string> = {
  enlisted: "Enlisted",
  officer: "Officer",
  warrant: "Warrant officer",
};

/** "Army enlisted 68W": the short form used on chips and buttons. */
export function militaryName(m: { branch: MilitaryBranch; category: MilitaryCategory; code: string }): string {
  return `${BRANCH_LABEL[m.branch]} ${CATEGORY_LABEL[m.category].toLowerCase()} ${m.code}`;
}
