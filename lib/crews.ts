import "server-only";

type Db = any;

export interface CrewRef {
  id: string;
  name: string;
}

/**
 * Turns whatever a form or older code sends (a crew id, or a crew name) into a
 * real crew of this org. A name with no matching crew creates that crew, so
 * nothing ever saves a crew that the schedule doesn't know about.
 */
export async function resolveCrew(
  db: Db,
  orgId: string,
  input: { crewId?: string | null; crewName?: string | null },
): Promise<CrewRef | null> {
  const id = (input.crewId ?? "").trim();
  if (id) {
    const { data } = await db.from("crews").select("id, name").eq("id", id).eq("org_id", orgId).maybeSingle();
    return data ? { id: data.id, name: data.name } : null;
  }
  const name = (input.crewName ?? "").trim().slice(0, 40);
  if (!name) return null;
  const { data: crews } = await db.from("crews").select("id, name").eq("org_id", orgId);
  const match = (crews ?? []).find((c: CrewRef) => c.name.trim().toLowerCase() === name.toLowerCase());
  if (match) return { id: match.id, name: match.name };
  const { data: created } = await db.from("crews").insert({ org_id: orgId, name }).select("id, name").single();
  return created ? { id: created.id, name: created.name } : null;
}

/** The crew to put on a job from the people assigned to it (only when they all share one crew). */
export async function crewForEmployees(db: Db, orgId: string, employeeIds: string[]): Promise<CrewRef | null> {
  if (!employeeIds.length) return null;
  const { data } = await db.from("employees").select("crew_id").eq("org_id", orgId).in("id", employeeIds);
  const ids = [...new Set((data ?? []).map((e: { crew_id: string | null }) => e.crew_id).filter(Boolean))] as string[];
  if (ids.length !== 1) return null;
  return resolveCrew(db, orgId, { crewId: ids[0] });
}
