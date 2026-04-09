export default function ProfileLoading() {
  return (
    <main
      className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="mx-auto grid w-full max-w-600 grid-cols-1 gap-3 pb-8 pt-1 md:px-3">
        <article className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md">
          <div className="h-3 w-24 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_22%,transparent)]" />
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-18 w-18 animate-pulse rounded-full border border-(--border) bg-[color-mix(in_srgb,var(--text)_16%,transparent)]" />
              <div className="min-w-0 space-y-2">
                <div className="h-6 w-40 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_20%,transparent)]" />
                <div className="h-3 w-36 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_16%,transparent)]" />
                <div className="h-3 w-28 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_16%,transparent)]" />
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3 lg:min-w-95">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--background)_72%,transparent)] px-2.5 py-2"
                >
                  <div className="h-2.5 w-16 animate-pulse rounded bg-[color-mix(in_srgb,var(--accent)_28%,transparent)]" />
                  <div className="mt-1 h-4 w-12 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_20%,transparent)]" />
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_90%,transparent)] p-4">
          <div className="h-6 w-44 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_22%,transparent)]" />
          <div className="mt-3 grid list-none gap-2.5 p-0">
            {Array.from({ length: 8 }).map((_, index) => (
              <article
                key={index}
                className="overflow-hidden rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] shadow-[0_10px_22px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
              >
                <div className="h-23 animate-pulse bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" />
                <div className="space-y-2 px-3 py-2">
                  <div className="h-4 w-52 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_22%,transparent)]" />
                  <div className="h-3 w-28 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_18%,transparent)]" />
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
