// Tracked links: every caption and reply carries its own /r/<code> link, so the
// scoreboard can show which post brought clicks.
// Owner: Teammate B. Also src/app/r/[code]/ and src/app/v/[id]/Scoreboard.tsx + EarlyAccess.tsx.

export type LinkChannel = "tiktok" | "reels" | "shorts" | "x" | "reddit" | "hn" | "linkedin" | "other";

export type TrackedLink = {
  code: string;
  jobId: string;
  channel: LinkChannel;
  label: string; // human name for the scoreboard, e.g. "Video 1: before/after" or "Reply to @sam on X"
  target: string; // where the click goes (the product's site)
  createdAt: string;
};

export type LinkStats = {
  totalClicks: number;
  links: (TrackedLink & { clicks: number; lastClickAt: string | null })[];
  byChannel: Record<string, number>;
};

// STUB: Teammate B replaces this. Until then it hands back the plain target,
// so callers (people finder, captions) already work.
export async function makeLink(
  jobId: string,
  link: { channel: LinkChannel; label: string; target: string },
): Promise<{ code: string; url: string }> {
  void jobId;
  return { code: "", url: link.target };
}

// STUB: Teammate B replaces this.
export async function getStats(jobId: string): Promise<LinkStats> {
  void jobId;
  return { totalClicks: 0, links: [], byChannel: {} };
}
