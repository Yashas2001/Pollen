# Hackathon: marketing videos for your product

Paste a website link, get three short vertical videos (TikTok / Reels / Shorts) in proven formats, made from the real product. Preview in the browser, download the MP4, copy the post caption.

## Run it

```bash
npm install
npx playwright install chromium
cp .env.example .env.local   # then fill in the keys
npm run dev                   # builds the Remotion bundle, then starts Next on :3000
```

Other scripts:
- `npm run studio`: Remotion Studio, to design the video with live props
- `npm run bundle`: rebuild the Remotion bundle (do this after changing anything in `src/remotion/` if you need MP4 renders to pick it up; the browser preview updates on its own)
- `npm run tunnel`: public link via cloudflared. Then set `APP_URL` in `.env.local` to the tunnel URL and restart.

## Stack

| Part | Tool |
|---|---|
| App + landing page | Next.js 16 (App Router, Tailwind 4) |
| Reading the site | Playwright: phone-sized screenshots, text, colours, logo |
| Research | Gemini 3.8 Flash (Google Search, watches YouTube), YouTube Data API v3 |
| Writing the videos | Luna (gpt-5.6-luna, Azure) or Claude Opus 5.5, structured output against `src/remotion/schema.ts` |
| Voice + word timings | ElevenLabs `convertWithTimestamps` |
| Video | Remotion 4: `@remotion/player` for instant preview, `@remotion/renderer` for MP4 |

## How a job flows

`POST /api/jobs {url}` → `src/lib/pipeline.ts`:
1. `site.ts` opens the site as a phone, screenshots it (full page + first screen), grabs text/colours/logo
2. `research/` finds what's winning in the niche:
   - Gemini + Google Search: niche, search phrases, competitors with their real YouTube handles
   - YouTube Data API: competitors' recent Shorts + top Shorts for the niche phrases; an outlier is a Short that beat its own channel's median views (3x, competitors 2x); Gemini drops off-topic hits
   - Gemini watches the top 3 from their YouTube URL and writes down each recipe (hook pattern, beats, pacing, ending)
3. `writer.ts` (Luna on Azure, or Claude with `WRITER=anthropic`) writes brand colours + 3 scripts, each following a different recipe (`basedOn`)
4. `voice.ts` voices each script once; character timings give shot start times + captions
5. Job is `ready`: `/v/[id]` shows the proof ("what's working") + 3 Remotion Players. Download → `POST /api/jobs/[id]/render` → `render.ts` makes the MP4

Why YouTube and not TikTok: TikTok is blocked in India, so this laptop can't download TikTok videos for Gemini to watch, and judges here can't open TikTok links. Bright Data works for TikTok numbers (profile = last ~19 videos with views in one call) and is the next source to add. YouTube search costs 100 quota units of 10,000/day, so about 40 runs a day.

Jobs live on disk in `data/jobs/<id>/` (job.json + every file). One render at a time.

## Where to work

- Video look: `src/remotion/` (`SocialVideo.tsx`, `components/ShotView.tsx`, `Headline.tsx`, `Captions.tsx`)
- What the AI writes: the system prompt in `src/lib/writer.ts`; the shape in `src/remotion/schema.ts`
- Pages: `src/app/page.tsx` (landing + link box), `src/app/v/[id]/JobView.tsx` (results)
