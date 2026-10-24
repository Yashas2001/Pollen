# Pollen: who owns what (hackathon, 2026-10-24)

Ready by 14:00, live by 14:20. Merge to `main` at 13:45.

| Branch | Owner | Your files (only touch these) |
|---|---|---|
| `video` | Suhas | `src/remotion/`, `src/lib/site.ts`, `writer.ts`, `voice.ts`, `research/`, landing page |
| `people` | Teammate A | `src/lib/people/`, `src/app/v/[id]/People.tsx` |
| `links` | Teammate B | `src/lib/links.ts`, `src/app/r/[code]/`, `src/app/v/[id]/Scoreboard.tsx`, `EarlyAccess.tsx`, any new `src/app/api/...` route you add |

Shared files (`jobs.ts`, `pipeline.ts`, `JobView.tsx`) are already wired to your stubs. If you need a change there, ask Suhas instead of editing.

## How it fits
- `POST /api/jobs {url}` runs `src/lib/pipeline.ts`: read site -> research -> write 3 videos -> voice.
- Right after writing, the pipeline calls `findPeople(jobId, brief)` in the background and saves `job.people`. Results page `/v/[id]` shows: what's working, videos, `<People>`, `<Scoreboard>`, `<EarlyAccess>`.
- `makeLink(jobId, {channel, label, target})` returns `{code, url}`. Until links lands it returns the plain target, so People can call it now.
- Storage = JSON files under `data/` (gitignored, one server).

## Rules
- Nothing is ever posted or sent automatically. The founder clicks.
- Never show anything as live when it isn't.
- Keys go in `.env.local` (gitignored). Never commit keys.
- Run: `npm install && npx playwright install chromium && cp .env.example .env.local` (fill keys) `&& npm run dev`.
