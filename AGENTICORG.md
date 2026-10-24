# AgenticOrg agent for Pollen: Reply Coach

For Suhas and Rakshith. Proposal from Yashas (People finder).

## The idea

The hackathon needs an agent from AgenticOrg (https://agenticorg.hackathon.pinelabs.com). Proposal: a custom agent, **Reply Coach**, that checks every reply the People finder drafts before the founder sees it.

For each person it returns:

- `verdict`: `post`, `rewrite` or `skip`
- `reason`: one line, e.g. "r/VideoEditing bans tool links in top-level comments"
- `reply`: the final reply text

The People card shows a badge: **Safe to post**, **Edited**, or **Don't post**, with the reason.

## Why this agent

- **It removes Pollen's biggest risk for users.** A founder who posts a tool link in the wrong subreddit gets banned or downvoted. Our drafts don't know any subreddit's rules today.
- **It needs no connectors.** Our tenant has none ("No active connectors configured"). Most built-in marketing agents expect Twitter, Brandwatch or HubSpot data; without it they hand the task to a human and return nothing.
- **It shows AgenticOrg working inside the product.** Every run is logged in AgenticOrg, risky output goes to human approval, and the agent gets its own identity for outside calls. Judges can see the agent's runs in the AgenticOrg dashboard.
- **It stays inside the People finder.** Only `src/lib/people/` and `People.tsx` change. No shared files.

## Setup in AgenticOrg (Create Agent > Skip to manual setup)

| Step | Setting |
|---|---|
| 1. Persona | Name `Reply Coach`, Designation `Community reply reviewer`, Domain **Marketing** |
| 2. Role | **Create custom agent type**: `reply_coach`. Not Content Factory: its default tools are Ahrefs and HubSpot, which we don't have. Reports To: none. |
| 3. Prompt | The prompt below |
| 4. Behavior | Model `gpt-5.6-luna`, LLM Routing **Disabled - Use selected model**, Confidence floor **60%** (at the default 88% most runs would wait for human approval), no connectors, no tools |
| 5. Review | **Create as Shadow**, test a few runs, then promote to **Active** |

Prompt:

```
You review a draft reply before a founder posts it under their own name on Reddit, Hacker News or LinkedIn.
Input: platform, community (e.g. subreddit), the original post, the draft reply, the product name and link.
1. Check the community's known self-promotion rules. If links to tools are not allowed there, remove the link and say why.
2. The reply must answer the person's actual question first, sound like a real person, mention the product at most once, and be 2 to 4 sentences. No hype, no "Great question", no emojis.
3. If the post is not really asking for something this product does, or replying would look like spam, the verdict is skip.
Return JSON only: {"verdict": "post" | "rewrite" | "skip", "reason": "one line", "reply": "final reply text"}
Never post anything yourself.
```

## How Pollen calls it

After `findPeople` scores and writes the replies, it sends one request per person, all in parallel:

```
POST https://agenticorg.hackathon.pinelabs.com/api/v1/agents/<agent-id>/run
Authorization: Bearer <api key>

{ "inputs": { "platform": "reddit", "community": "NewTubers", "post": "...", "draft": "...", "product": "Cubix", "link": "https://cubix.design" } }
```

The answer is in `output`, and `status` is `completed`, `failed`, `hitl_triggered` or `budget_exceeded`. Each call gets a 15 s timeout. If a call fails or is held for human approval, the card keeps the current draft with no badge, so the People section is never blocked or slowed past its limit.

New env vars, to go in `.env.example`:

```
AGENTICORG_URL=https://agenticorg.hackathon.pinelabs.com
AGENTICORG_API_KEY=
AGENTICORG_REPLY_COACH_ID=
```

## What we need first

1. **An API key.** Our accounts have the developer role, and creating API keys needs admin (Settings shows 403 for us). Ask the organisers for a key with permission to run agents. Also check the agent's page after creating it: AgenticOrg says each agent gets its own access token for outside calls, and that may be enough.
2. **Someone creates the agent** with the settings above, and shares its ID.
3. **Not verified yet:** whether an agent still in Shadow mode accepts API runs. It may need to be promoted to Active first.

Once 1 and 2 are done, wiring it into the People finder is about 30 minutes.

## Other options considered

- **Launch Planner** (a custom Social Media agent): a 7-day posting schedule with captions per platform for the 3 videos. Useful, but it changes Suhas's files (`writer.ts`, `JobView.tsx`).
- **Pine Labs commerce agents** (Ecommerce Seller, with Plural payments): only worth it if Pollen charges for something. That's Rakshith's Early Access area, and it needs the most setup.

## Also for Suhas: a bug in `jobs.ts`

`updateJob` isn't safe when two updates overlap, and the People finder runs beside the videos:

1. Every write uses the same `job.json.tmp`. When two overlap, one rename fails with ENOENT and **the whole job fails**. This happened on a real cubix.design run.
2. Updates can overwrite each other. On another run, `peopleStatus: "finding"` was lost, so the results page stopped polling and the People cards only appeared after a manual refresh.

Fix: in `saveJob`, give each write its own temp name (e.g. `job.json.<uuid>.tmp`), and run `updateJob` calls for the same job one at a time by chaining each on the previous one's promise.
