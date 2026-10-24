import { chromium, type Page } from "playwright";
import { writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

export type SiteRead = {
  url: string;
  title: string;
  description: string;
  text: string; // visible text, trimmed
  themeColor: string | null;
  buttonColor: string | null;
  backgroundColor: string | null;
  logoFile: string | null; // file name inside the job dir
  heroFile: string; // phone-sized first screen
  fullFile: string; // phone-sized full page (capped height)
  fullHeight: number;
  heroHeight: number;
  // Real parts of the page (buttons, headings, cards) in full-screenshot pixels,
  // so a video can zoom into them like a walkthrough.
  elements: SiteElement[];
  // Product / marketing images from the page, downloaded into the job dir.
  images: { file: string; width: number; height: number; label: string }[];
  // Product videos already on the page (demo loops, hero videos), biggest first.
  videoUrls: string[];
};

export type SiteElement = { label: string; kind: "button" | "heading" | "card" | "image"; x: number; y: number; w: number; h: number };

const execFileP = promisify(execFile);
const PHONE = { width: 390, height: 844 };
const SCALE = 1080 / 390; // screenshots come out 1080 px wide, same as the video
const MAX_FULL_HEIGHT = 5200; // css px, keeps the image a sane size

// Cookie / consent popups ruin the screenshots: click "accept" if there is one,
// then hide anything floating that still talks about cookies.
async function clearCookieBanners(page: Page) {
  const accept = page
    .getByRole("button", { name: /^(accept( all)?|allow( all)?|agree|i agree|got it|ok(ay)?|yes)$/i })
    .first();
  await accept.click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const pos = getComputedStyle(el).position;
      const text = el.innerText ?? "";
      if ((pos === "fixed" || pos === "sticky") && text.length < 800 && /cookie|consent|gdpr/i.test(text)) {
        el.style.setProperty("display", "none", "important");
      }
    }
  });
  await page.waitForTimeout(300);
}

// Opens the site like a phone would and grabs what a marketer would: the words,
// the brand colours, the logo, and screenshots that become the "product footage".
export async function readSite(rawUrl: string, jobDir: string): Promise<SiteRead> {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: SCALE,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    // Scroll through once so lazy images and scroll animations load.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight && y < 6000; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    await clearCookieBanners(page);

    const info = await page.evaluate(() => {
      const meta = (sel: string) => document.querySelector<HTMLMetaElement>(sel)?.content ?? "";
      const icons = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']"))
        .map((l) => ({ href: l.href, size: parseInt((l.sizes?.value ?? "0").split("x")[0]) || 0, apple: l.rel.includes("apple") }))
        .sort((a, b) => Number(b.apple) - Number(a.apple) || b.size - a.size);
      const btn = Array.from(document.querySelectorAll<HTMLElement>("a, button")).find((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        return bg && !bg.includes("rgba(0, 0, 0, 0)") && bg !== "transparent" && el.offsetWidth > 60;
      });
      return {
        title: document.title,
        description: meta("meta[name='description']") || meta("meta[property='og:description']"),
        themeColor: meta("meta[name='theme-color']") || null,
        buttonColor: btn ? getComputedStyle(btn).backgroundColor : null,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        logoHref: icons[0]?.href ?? meta("meta[property='og:image']") ?? null,
        text: document.body.innerText.replace(/\n{3,}/g, "\n\n").slice(0, 20_000),
        height: document.body.scrollHeight,
        ogImage: meta("meta[property='og:image']") || null,
      };
    });

    const found = await page.evaluate((maxH: number) => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 40 && r.height > 16 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.1;
      };
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
      };
      const text = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 70);
      const out: { label: string; kind: "button" | "heading" | "card" | "image"; x: number; y: number; w: number; h: number }[] = [];
      document.querySelectorAll("h1, h2, h3").forEach((el) => visible(el) && text(el) && out.push({ label: text(el), kind: "heading", ...box(el) }));
      document.querySelectorAll("a, button").forEach((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const filled = bg && !bg.includes("rgba(0, 0, 0, 0)") && bg !== "transparent";
        if (filled && visible(el) && text(el) && text(el).length < 40) out.push({ label: text(el), kind: "button", ...box(el) });
      });
      // cards: smallish blocks that hold a heading and some text
      document.querySelectorAll("li, article, section > div, [class*='card'], [class*='feature']").forEach((el) => {
        const b = box(el);
        const head = el.querySelector("h2, h3, h4, strong");
        if (head && visible(el) && b.h > 80 && b.h < 600 && b.w > 200) out.push({ label: text(head), kind: "card", ...b });
      });
      const imgs = Array.from(document.images)
        .filter((im) => visible(im) && im.naturalWidth >= 400 && im.getBoundingClientRect().width >= 150 && !/logo|icon|avatar/i.test(im.currentSrc + im.alt))
        .map((im) => ({ src: im.currentSrc || im.src, alt: im.alt || "", ...box(im) }));
      imgs.forEach((im) => out.push({ label: im.alt || "image", kind: "image", x: im.x, y: im.y, w: im.w, h: im.h }));
      const seen = new Set<string>();
      const elements = out
        .filter((e) => e.y + e.h <= maxH && e.label)
        .filter((e) => {
          const k = `${e.kind}:${e.label}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => a.y - b.y)
        .slice(0, 16);
      return { elements };
    }, MAX_FULL_HEIGHT);

    // Videos on the page: the closest thing to real product footage a site has.
    const videoUrls = await page.evaluate(() => {
      const found: { url: string; area: number }[] = [];
      document.querySelectorAll("video").forEach((v) => {
        const r = v.getBoundingClientRect();
        const srcs = [v.currentSrc, v.src, v.getAttribute("data-src") ?? "", ...Array.from(v.querySelectorAll("source")).map((s) => s.src || s.getAttribute("data-src") || "")];
        const url = srcs.find((u) => u && !u.startsWith("blob:") && !/\.m3u8|youtube|vimeo/i.test(u));
        if (url) found.push({ url: new URL(url, location.href).href, area: r.width * r.height });
      });
      const seen = new Set<string>();
      return found
        .sort((a, b) => b.area - a.area)
        .map((f) => f.url)
        .filter((u) => !seen.has(u) && seen.add(u));
    });

    const heroFile = "site-hero.jpg";
    await page.screenshot({ path: path.join(jobDir, heroFile), type: "jpeg", quality: 85 });

    const fullFile = "site-full.jpg";
    const fullHeight = Math.min(info.height, MAX_FULL_HEIGHT);
    await page.screenshot({
      path: path.join(jobDir, fullFile),
      type: "jpeg",
      quality: 80,
      clip: { x: 0, y: 0, width: PHONE.width, height: fullHeight },
      fullPage: true,
    });

    let logoFile: string | null = null;
    if (info.logoHref) {
      try {
        const res = await context.request.get(info.logoHref, { timeout: 10_000 });
        const type = res.headers()["content-type"] ?? "";
        if (res.ok() && /image\/(png|jpeg|webp|svg\+xml)/.test(type)) {
          const ext = type.includes("svg") ? "svg" : type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
          logoFile = `logo.${ext}`;
          await writeFile(path.join(jobDir, logoFile), await res.body());
        }
      } catch {
        logoFile = null;
      }
    }

    // Product images: screenshot the visual areas themselves (img, picture, video,
    // CSS backgrounds, inside shadow DOM too), so it works whatever the site is built with.
    const images: SiteRead["images"] = [];
    const visuals = await page.evaluate((maxH: number) => {
      const all: Element[] = [];
      const walk = (root: Document | ShadowRoot) =>
        root.querySelectorAll("*").forEach((el) => {
          all.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        });
      walk(document);
      const picked: { i: number; area: number; label: string; x: number; y: number; w: number; h: number }[] = [];
      all.forEach((el) => {
        const r = el.getBoundingClientRect();
        const y = r.top + window.scrollY;
        if (r.width < 150 || r.height < 120 || y + r.height > maxH) return;
        // on screen horizontally (carousels park their other slides off to the sides)
        if (r.left < -20 || r.right > window.innerWidth + 20) return;
        // photo-shaped only: no page-long wrappers or full-screen backgrounds
        if (r.height > window.innerHeight * 1.05 || r.width > window.innerWidth * 1.02 || r.height / r.width > 2.2 || r.width / r.height > 3) return;
        const tag = el.tagName.toLowerCase();
        const bg = getComputedStyle(el).backgroundImage;
        const visual = tag === "img" || tag === "video" || tag === "canvas" || (bg && bg.startsWith("url("));
        if (!visual) return;
        const alt = (el as HTMLImageElement).alt || "";
        if (/logo|icon|avatar/i.test(alt)) return;
        const card = el.closest("li, article, section, a, div[class]");
        const head = card?.querySelector("h1, h2, h3, h4, strong");
        const goodAlt = alt && alt.length < 80 && !/attribute|image|photo|^img/i.test(alt) ? alt : "";
        const label = ((head as HTMLElement | null)?.innerText || goodAlt || "").replace(/\s+/g, " ").trim().slice(0, 60);
        el.setAttribute("data-hx-visual", String(picked.length));
        picked.push({ i: picked.length, area: r.width * r.height, label, x: r.left, y, w: r.width, h: r.height });
      });
      // biggest first, skip ones mostly inside a bigger pick, skip full-width page backgrounds
      const keep: typeof picked = [];
      for (const v of picked.sort((a, b) => b.area - a.area)) {
        // inside a bigger pick, or the same box (carousel slides stack in one spot)
        const inside = keep.some((k) => v.x >= k.x - 4 && v.y >= k.y - 4 && v.x + v.w <= k.x + k.w + 4 && v.y + v.h <= k.y + k.h + 4);
        if (!inside) keep.push(v);
        if (keep.length >= 6) break;
      }
      return keep;
    }, MAX_FULL_HEIGHT);
    await writeFile(path.join(jobDir, "visuals.json"), JSON.stringify(visuals, null, 1));
    // Crop each photo out of the full-page screenshot we already took (same layout,
    // exact pixels; element screenshots came out wrong on some sites).
    for (const v of visuals) {
      const file = `img-${v.i}.jpg`;
      // clamp to the screenshot: photos often overhang the screen edge by a few pixels
      const x0 = Math.max(0, v.x);
      const x1 = Math.min(PHONE.width, v.x + v.w);
      const y1 = Math.min(fullHeight, v.y + v.h);
      if (x1 - x0 < 100 || y1 - v.y < 100) continue;
      const crop = [x1 - x0, y1 - v.y, x0, v.y].map((n) => Math.floor(n * SCALE));
      try {
        await execFileP("ffmpeg", ["-v", "error", "-y", "-i", path.join(jobDir, fullFile), "-vf", `crop=${crop.join(":")}`, "-q:v", "3", path.join(jobDir, file)]);
        images.push({ file, width: crop[0], height: crop[1], label: v.label ? `product image: ${v.label}` : "product image from the site" });
      } catch (e) {
        console.warn("[site] crop failed", file, crop, (e as Error).message.slice(0, 200));
      }
    }
    if (info.ogImage) {
      try {
        const res = await context.request.get(info.ogImage, { timeout: 10_000 });
        const type = res.headers()["content-type"] ?? "";
        if (res.ok() && /image\/(png|jpeg|webp)/.test(type)) {
          const body = await res.body();
          const file = `og.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
          await writeFile(path.join(jobDir, file), body);
          const dims = await page.evaluate(async (dataUrl: string) => {
            const im = new Image();
            im.src = dataUrl;
            await im.decode();
            return { w: im.naturalWidth, h: im.naturalHeight };
          }, `data:${type.split(";")[0]};base64,${body.toString("base64")}`);
          if (dims.w >= 300) images.push({ file, width: dims.w, height: dims.h, label: "the site's share image (marketing graphic)" });
        }
      } catch {
        // no share image
      }
    }

    return {
      url,
      title: info.title,
      description: info.description,
      text: info.text,
      themeColor: info.themeColor,
      buttonColor: info.buttonColor,
      backgroundColor: info.backgroundColor,
      logoFile,
      heroFile,
      fullFile,
      fullHeight: Math.round(fullHeight * SCALE),
      heroHeight: Math.floor(PHONE.height * SCALE),
      elements: found.elements.map((e) => ({ ...e, x: e.x * SCALE, y: e.y * SCALE, w: e.w * SCALE, h: e.h * SCALE })),
      images,
      videoUrls,
    };
  } finally {
    await browser.close();
  }
}
