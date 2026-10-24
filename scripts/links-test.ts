import { makeLink } from "@/lib/links";

async function main() {
  const jobId = process.argv[2];
  for (const [channel, label] of [["tiktok", "Video 1: before/after"], ["reddit", "Reply to u/sam on Reddit"], ["x", "Reply to @maya on X"]] as const)
    console.log(label, await makeLink(jobId, { channel, label, target: "https://cubix.design/?ref=test" }));
}
void main();
