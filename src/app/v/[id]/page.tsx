import { Suspense } from "react";
import { JobView } from "./JobView";

export default function JobPage({ params }: PageProps<"/v/[id]">) {
  return (
    <main className="flex flex-1 flex-col items-center bg-[#F6F4EF] px-4 py-10 text-black">
      <Suspense fallback={<p className="text-black/50">Loading...</p>}>
        <JobLoader params={params} />
      </Suspense>
    </main>
  );
}

async function JobLoader({ params }: { params: PageProps<"/v/[id]">["params"] }) {
  const { id } = await params;
  return <JobView id={id} />;
}
