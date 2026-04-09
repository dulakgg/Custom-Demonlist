export default function LoginLoading() {
  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-8 w-44 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_22%,transparent)]" />
      <div className="h-4 w-52 animate-pulse rounded bg-[color-mix(in_srgb,var(--text)_18%,transparent)]" />
      <div className="h-11 w-56 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--primary)_24%,transparent)]" />
    </main>
  );
}
