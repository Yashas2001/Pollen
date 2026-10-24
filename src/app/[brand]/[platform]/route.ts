import { followLink } from "@/lib/links";

// Readable tracked link: /cubix/tiktok. Unknown ones go to the home page.
export async function GET(request: Request, { params }: { params: Promise<{ brand: string; platform: string }> }) {
  const { brand, platform } = await params;
  return followLink(request, `${brand.toLowerCase()}/${platform.toLowerCase()}`);
}
