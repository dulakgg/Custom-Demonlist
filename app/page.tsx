import Link from "next/link";

export default function Home() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col items-center justify-center px-4 py-16 md:px-6"
      style={{
        background:
          "radial-gradient(circle at 12% 12%, color-mix(in srgb, var(--accent, var(--primary)) 22%, transparent), transparent 40%), radial-gradient(circle at 86% 7%, color-mix(in srgb, var(--secondary, var(--primary)) 18%, transparent), transparent 42%), linear-gradient(170deg, var(--background), color-mix(in srgb, var(--background) 78%, var(--primary)))",
      }}
    >
      <h1 className="text-center text-4xl font-bold tracking-tight text-(--text) sm:text-6xl">
        Welcome to Custom Demonlist
      </h1>
      <p className="mt-6 max-w-2xl text-center text-lg text-(--text)">
        Explore the leaderboard and discover the top demons.
      </p>
      <Link
        href="/leaderboard"
        className="mt-8 rounded-full border border-(--primary) bg-(--primary) px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110"
      >
        Open leaderboard
      </Link>
    </main>
  );
}
