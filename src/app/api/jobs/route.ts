import { after } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createJob, jobDir } from "@/lib/jobs";
import { getUser, recordUser } from "@/lib/auth";
import { runJob } from "@/lib/pipeline";

export const maxDuration = 300;

const MAX_UPLOAD = 300_000_000; // phone clips get big

// JSON ({url, goal}) or a form with optional "files": photos, screen recordings, past
// videos (up to 10). The pipeline sorts out what each one is.
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: "Sign in with Google first." }, { status: 401 });
  void recordUser(user).catch(() => {});

  let url: string | undefined;
  let goal: string | undefined;
  const clips: { name: string; file: File }[] = [];
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "That upload didn't come through. Try again." }, { status: 400 });
    url = String(form.get("url") ?? "");
    goal = String(form.get("goal") ?? "");
    form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, 10)
      .forEach((file, i) => clips.push({ name: String(i), file }));
  } else {
    const body = (await request.json().catch(() => null)) as { url?: string; goal?: string } | null;
    url = body?.url;
    goal = body?.goal;
  }
  url = url?.trim();
  if (!url || !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(url)) {
    return Response.json({ error: "Paste your product's website link." }, { status: 400 });
  }
  if (clips.some((c) => c.file.size > MAX_UPLOAD)) return Response.json({ error: "Keep each file under 300 MB." }, { status: 400 });
  if (clips.some((c) => !/^(video|image)\//.test(c.file.type) && !/\.(mp4|mov|m4v|webm|jpe?g|png|webp|heic|heif)$/i.test(c.file.name))) {
    return Response.json({ error: "Add photos or videos only." }, { status: 400 });
  }

  const job = await createJob(url, goal?.trim().slice(0, 200) || "I need my first 50 users", {
    uid: user.uid,
    email: user.email,
    name: user.name,
  });
  for (const c of clips) {
    const ext = (path.extname(c.file.name) || ".mp4").toLowerCase().replace(/[^.a-z0-9]/g, "");
    await writeFile(path.join(jobDir(job.id), `upload-${c.name}${ext}`), Buffer.from(await c.file.arrayBuffer()));
  }
  after(() => runJob(job.id, url));
  return Response.json({ id: job.id });
}
