import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100dvh-56px)] w-full items-center px-4 py-16 md:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center rounded-3xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_84%,transparent)] px-6 py-20 text-center shadow-[0_28px_68px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md sm:px-10">
        <h1 className="text-4xl font-bold tracking-tight text-(--text) sm:text-6xl">
          Measurement of tuffness demonlist
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-(--text)">
          look at our hardest completions so skeep and coldy
        </p>
        <Link
          href="/leaderboard"
          className="mt-8 rounded-full border border-(--primary) bg-(--primary) px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110"
        >
          Open List
        </Link>
      </div>
    </main>
  );
}
