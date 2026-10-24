import { getStats } from "@/lib/links";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await getStats(id), { headers: { "Cache-Control": "no-store" } });
}
