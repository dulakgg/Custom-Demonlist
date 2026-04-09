export default function AppLoading() {
  return (
    <main
      className="flex min-h-[calc(100dvh-56px)] w-full items-center px-4 py-16 md:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center rounded-3xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_84%,transparent)] px-6 py-20 text-center shadow-[0_28px_68px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md sm:px-10">
        <div className="h-4 w-40 animate-pulse rounded bg-[color-mix(in_srgb,var(--primary)_24%,transparent)]" />
        <div className="mt-4 h-12 w-full max-w-xl animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_22%,transparent)]" />
        <div className="mt-6 h-5 w-full max-w-md animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_18%,transparent)]" />
        <div className="mt-8 h-10 w-40 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--primary)_30%,transparent)]" />
      </div>
    </main>
  );
}
