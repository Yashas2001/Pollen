import { getJob } from "@/lib/jobs";
import { getMarks, setMark, type MarkChannel } from "@/lib/marks";

const CHANNELS: MarkChannel[] = ["reddit", "hn", "x", "linkedin", "creator", "partner"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await getMarks(id), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getJob(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.key !== "string" || typeof b.label !== "string" || !CHANNELS.includes(b.channel as MarkChannel))
    return Response.json({ error: "Bad mark" }, { status: 400 });
  const replied = b.replied === true;
  return Response.json(
    await setMark(id, { key: b.key, label: b.label.slice(0, 200), channel: b.channel as MarkChannel, sent: b.sent === true || replied, replied }),
  );
}
