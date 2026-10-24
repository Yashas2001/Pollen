// People finder: real posts from people asking for what this product does.
// Owner: Teammate A. Everything in src/lib/people/ + src/app/v/[id]/People.tsx.

// What the finder knows about the business (from the site read + research).
export type PeopleBrief = {
  url: string; // the product's site
  name?: string; // the product's name, as its site writes it
  what: string; // what it is
  who: string; // who it's for
  pain: string; // the problem it solves
  niche: string | null; // e.g. "AI video editing tools for creators"
  audience: string | null;
  competitors: string[]; // names, e.g. ["CapCut", "Descript"]
};

export type Platform = "x" | "reddit" | "hn" | "linkedin";

export type Person = {
  platform: Platform;
  url: string; // the post itself
  author: string;
  text: string; // what they wrote (trimmed)
  postedAt: string; // ISO date
  score: number; // 0-10: how clearly they are asking for this product
  why: string; // one line: why this person fits
  reply: string; // helpful human reply draft, says "I'm building X", no link (communities remove them)
  replyUrl?: string; // one-click reply (X intent link); else the founder opens url and pastes
  linkCode?: string; // older runs only: replies used to carry a tracked link
  coach?: { verdict: "post" | "rewrite"; reason: string }; // AgenticOrg Reply Coach's check of the reply
  // asking: wants this kind of product. talking: a live thread where its buyers discuss the topic
  // (only shown when too few are asking). Missing on older runs = asking.
  kind?: "asking" | "talking";
};
