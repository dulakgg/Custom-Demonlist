export default function ProfilesLoading() {
  return (
    <main
      className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="mx-auto grid w-full max-w-600 grid-cols-1 gap-3">
        <header className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md">
          <div className="h-3 w-32 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_22%,transparent)]" />
          <div className="mt-2 h-8 w-64 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_28%,transparent)]" />
        </header>

        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 10 }).map((_, index) => (
            <article
              key={index}
              className="w-full overflow-hidden rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] shadow-[0_10px_22px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
            >
              <div className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-7 w-7 animate-pulse rounded-full border border-(--border) bg-[color-mix(in_srgb,var(--text)_16%,transparent)]" />
                    <div className="h-4 w-32 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_20%,transparent)]" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--primary)_24%,transparent)]" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_18%,transparent)]" />
                  <div className="h-3 w-28 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_18%,transparent)]" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
