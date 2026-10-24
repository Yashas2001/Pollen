import { getLink, logClick } from "@/lib/links";

// Tracked link: log the click, then send them to the product with UTM tags.

// Link previews (X, WhatsApp, Slack, LinkedIn...) and crawlers still get redirected, just not counted.
const BOTS = /bot|crawl|spider|preview|facebookexternalhit|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|SkypeUriPreview|Googlebot|bingbot/i;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await getLink(code).catch(() => null);
  if (!link) return Response.redirect(new URL("/", request.url), 302);

  const ua = request.headers.get("user-agent");
  if (!ua || !BOTS.test(ua)) {
    try {
      const country = request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? undefined;
      await logClick({ code, jobId: link.jobId, at: new Date().toISOString(), referrer: request.headers.get("referer"), ua, country });
    } catch (err) {
      // Never break the redirect over a lost click.
      console.error("[links] click log failed", err);
    }
  }

  let target: URL;
  try {
    target = new URL(link.target);
  } catch {
    return Response.redirect(new URL("/", request.url), 302);
  }
  target.searchParams.set("utm_source", "vibe");
  target.searchParams.set("utm_medium", link.channel);
  target.searchParams.set("utm_campaign", code);
  return new Response(null, { status: 302, headers: { Location: target.toString(), "Cache-Control": "no-store" } });
}
