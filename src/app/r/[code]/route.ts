import { followLink } from "@/lib/links";

// Tracked link with a random code (replies, older runs).
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return followLink(request, code);
}
