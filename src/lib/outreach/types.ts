// Real people and businesses to reach out to, each with why and a message.
// Contacts are only ever what they publish themselves. Never guessed.

export type Creator = {
  name: string;
  url: string; // their YouTube channel
  thumbnail: string;
  subscribers: number | null;
  video: { title: string; url: string; views: number }; // their video that shows the fit
  email: string | null; // from their own channel description
  why: string;
  subject: string;
  dm: string; // no link: cold messages ask for a reply, not a click
};

export type Partner = {
  name: string;
  website: string;
  kind: string; // "agency", "studio", "newsletter", "community", ...
  why: string;
  contactRole: string; // who to ask for, e.g. "founder" or "head of partnerships"
  email: string | null; // found on their own site
  contactPage: string | null;
  linkedin: string | null;
  subject: string;
  body: string; // no link: cold messages ask for a reply, not a click
};

export type Outreach = { creators: Creator[]; partners: Partner[]; notes?: string[] }; // notes: what went wrong, for logs
