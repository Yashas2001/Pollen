import { Admin } from "./Admin";

export const metadata = { title: "Pollen admin" };

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col items-center bg-[#F6F4EF] px-4 py-10 text-black">
      <Admin />
    </main>
  );
}
