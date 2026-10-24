// Public contact details a business or creator published themselves.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const NOT_EMAIL = /\.(png|jpe?g|gif|webp|svg|avif|css|js)$/i;
const JUNK_DOMAIN = /(^your|^name@|^email@|^user@|^(jane|john|jdoe|johndoe|janedoe|first|firstname)[.@]|example\.|domain\.com|email\.com|website\.com|yourcompany|sentry|wixpress|godaddy|cloudflare|schema\.org|w3\.org)/i;

export function findEmails(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(EMAIL) ?? []) {
    const e = m.toLowerCase().replace(/^\d+[.)]?/, "");
    if (NOT_EMAIL.test(e) || JUNK_DOMAIN.test(e)) continue;
    out.add(e);
  }
  return [...out];
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function get(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return { url: res.url, html: (await res.text()).slice(0, 600_000) };
  } catch {
    return null;
  }
}

function links(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      out.push(new URL(m[1], base).toString());
    } catch {
      // Not a link.
    }
  }
  return out;
}

// What a person reads on the page: title, description and body text, no code.
function visibleText(html: string): string {
  const title = html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "";
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
  return `${title}. ${meta}. ${body}`.replace(/\s+/g, " ").trim();
}

// Opens their site (proves it is real), then the contact or about page, and keeps the
// emails, contact page and LinkedIn they list, plus what the pages say about them
// (so a message can name real details of their work). Null when the site doesn't load.
export async function siteContacts(website: string): Promise<{
  website: string;
  emails: string[];
  contactPage: string | null;
  linkedin: string | null;
  text: string;
} | null> {
  const home = await get(website);
  if (!home) return null;
  const site = host(home.url);
  const all = links(home.html, home.url);
  const mailto = all.filter((l) => l.startsWith("mailto:")).map((l) => decodeURIComponent(l.slice(7).split("?")[0]));
  const linkedin = all.find((l) => /linkedin\.com\/company\//i.test(l)) ?? null;
  const page = (l: string) => host(l) === site && !/\/wp-(content|includes)\/|\.(css|js|png|jpe?g|svg|webp|pdf|xml)$/i.test(new URL(l).pathname);
  const contactPage =
    all.find((l) => page(l) && /contact|get-in-touch|work-with-us|enquir|inquir/i.test(new URL(l).pathname)) ??
    all.find((l) => page(l) && /\/about/i.test(new URL(l).pathname)) ??
    null;

  let emails = [...mailto, ...findEmails(home.html)];
  let text = visibleText(home.html).slice(0, 1800);
  if (contactPage) {
    const page = await get(contactPage);
    if (page) {
      text += ` | ${new URL(page.url).pathname}: ${visibleText(page.html).slice(0, 700)}`;
      const more = links(page.html, page.url).filter((l) => l.startsWith("mailto:")).map((l) => decodeURIComponent(l.slice(7).split("?")[0]));
      emails.push(...more, ...findEmails(page.html));
    }
  }
  // Their own domain first: a hello@ on their site beats a vendor's address in a script.
  emails = [...new Set(emails.map((e) => e.toLowerCase().trim()))].filter((e) => findEmails(e).length);
  const root = site.split(".").slice(-2).join(".");
  emails.sort((a, b) => Number(b.endsWith(root)) - Number(a.endsWith(root)));
  return { website: home.url, emails: emails.slice(0, 3), contactPage, linkedin, text };
}
