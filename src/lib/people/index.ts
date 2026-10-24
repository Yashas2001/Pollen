import type { Person, PeopleBrief } from "./types";

// Finds real, recent posts (last 7 days) from people asking for what this product does,
// scores them, and drafts a reply for each. Never posts anything.
// STUB: Teammate A replaces this. Must never throw for "nothing found": return [].
export async function findPeople(jobId: string, brief: PeopleBrief): Promise<Person[]> {
  void jobId;
  void brief;
  return [];
}
