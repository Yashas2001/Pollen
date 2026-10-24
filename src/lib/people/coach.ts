import type { Person } from "./types";

// Reply Coach: our AgenticOrg agent (Pine Labs hackathon instance). It checks each draft
// against the community's self-promotion rules and says post, rewrite or skip.
// Its runs usually come back "hitl_triggered" (queued for review in AgenticOrg) with the
// answer already in `output`; the founder is the reviewer here, so we use it either way.

type Verdict = { verdict: "post" | "rewrite" | "skip"; reason: string; reply: string };

async function ask(p: Person, product: string): Promise<Verdict | null> {
  const { AGENTICORG_BASE_URL: base, AGENTICORG_API_KEY: key, AGENTICORG_REPLY_COACH_ID: id } = process.env;
  if (!base || !key || !id) return null;
  const res = await fetch(`${base}/api/v1/agents/${id}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "process",
      inputs: {
        platform: p.platform,
        community: p.url.match(/reddit\.com\/r\/(\w+)/)?.[1] ?? (p.platform === "hn" ? "Hacker News" : ""),
        post: p.text,
        draft: p.reply,
        product,
        // Drafts often wrap the link: "Cubix (https://cubix.design)." -> stop before ) , . etc.
        link: p.reply.match(/https?:\/\/[^\s)\]>,"']+/)?.[0]?.replace(/[.!?;:]+$/, "") ?? "",
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`agenticorg ${res.status}`);
  const out = ((await res.json()) as { output?: Partial<Verdict> }).output;
  if (out?.verdict !== "post" && out?.verdict !== "rewrite" && out?.verdict !== "skip") return null;
  return { verdict: out.verdict, reason: out.reason ?? "", reply: out.reply ?? "" };
}

// Checks every person at once. Skipped people are dropped; a failed or missing check keeps the draft.
export async function coach(people: Person[], product: string): Promise<Person[]> {
  const checked = await Promise.allSettled(people.map((p) => ask(p, product)));
  return people.flatMap((p, i) => {
    const r = checked[i];
    if (r.status === "rejected") console.warn(`[people] reply coach ${p.url}:`, r.reason?.message ?? r.reason);
    const v = r.status === "fulfilled" ? r.value : null;
    if (!v) return [p];
    if (v.verdict === "skip") return [];
    const reply = v.verdict === "rewrite" && v.reply.trim() ? v.reply.trim() : p.reply;
    const tweetId = p.platform === "x" ? p.url.split("/status/")[1] : undefined;
    return [
      {
        ...p,
        reply,
        replyUrl: tweetId ? `https://x.com/intent/post?in_reply_to=${tweetId}&text=${encodeURIComponent(reply)}` : p.replyUrl,
        coach: { verdict: v.verdict, reason: v.reason },
      },
    ];
  });
}
