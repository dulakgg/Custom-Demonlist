export default function LeaderboardLoading() {
  return (
    <main className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1" aria-busy="true" aria-live="polite">
      <section className="mx-auto grid w-full max-w-600 grid-cols-1 gap-3 pb-8 pt-1 xl:items-start xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <header className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md">
            <div className="h-3 w-32 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_22%,transparent)]" />
            <div className="mt-2 h-8 w-56 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_28%,transparent)]" />
          </header>

          <div className="mt-4 flex flex-col gap-2.5">
            {Array.from({ length: 8 }).map((_, index) => (
              <article
                key={index}
                className="overflow-hidden rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))]"
              >
                <div className="h-23 animate-pulse bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" />
                <div className="space-y-2 px-3 py-2">
                  <div className="h-4 w-52 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_22%,transparent)]" />
                  <div className="h-3 w-28 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_18%,transparent)]" />
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="hidden xl:block xl:self-start xl:sticky xl:top-20.5">
          <article className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_90%,transparent)] p-3 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)]">
            <div className="h-3 w-36 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_22%,transparent)]" />
            <div className="mt-2 h-6 w-52 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_22%,transparent)]" />
            <div className="mt-3 aspect-video animate-pulse rounded-xl border border-(--border) bg-[color-mix(in_srgb,var(--primary)_16%,transparent)]" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="h-9 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" />
              <div className="h-9 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" />
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
