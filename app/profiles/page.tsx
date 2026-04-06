import Image from "next/image";
import Link from "next/link";
import { FaCrown } from "react-icons/fa6";
import { isAdminFromCandidates } from "@/lib/adminPlayers";
import { getProfilesLeaderboard } from "@/lib/profileLeaderboard";

export const dynamic = "force-dynamic";

function avatarUrl(discordId: string, avatar: string | null): string {
  return avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`
    : "/images/default-avatar.jpg";
}

export default async function ProfilesPage() {
  const profiles = await getProfilesLeaderboard();

  return (
    <main className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1">
      <section className="mx-auto grid w-full max-w-600 grid-cols-1 gap-3">
        <header className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md">
          <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-(--accent)">Custom demonlist</p>
          <h1 className="m-0 mt-1 text-[clamp(1.3rem,2.6vw,2.5rem)] leading-[0.95] text-(--text)">Profiles Leaderboard</h1>
        </header>

        {profiles.length === 0 ? (
          <article className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_90%,transparent)] p-4 text-sm text-[color-mix(in_srgb,var(--text)_72%,transparent)]">
            No profile leaderboard entries yet.
          </article>
        ) : (
          <div className="flex flex-col gap-2.5">
            {profiles.map((entry) => {
              // Admin badge comes from env-driven admin matching.
              const isAdminProfile = isAdminFromCandidates([entry.discordUsername, entry.username]);

              return (
                <article
                  key={entry.userId}
                  className="w-full overflow-hidden rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] text-left shadow-[0_10px_22px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Image
                          src={avatarUrl(entry.discordId, entry.avatar)}
                          alt={`${entry.username} avatar`}
                          width={30}
                          height={30}
                          className="rounded-full border border-(--border)"
                        />
                        <Link
                          href={`/profile/${entry.userId}`}
                          className="truncate text-sm font-semibold text-(--text) underline-offset-2 hover:underline"
                        >
                          {entry.username}
                        </Link>
                        {isAdminProfile ? (
                          <FaCrown
                            className="shrink-0 text-(--primary)"
                            aria-label="This profile is an admin"
                            title="This profile is an admin"
                          />
                        ) : null}
                      </div>

                      <span className="shrink-0 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-(--primary)">
                        {entry.points} pts
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-(--accent)">Position #{entry.position}</p>
                      <p className="m-0 text-xs text-[color-mix(in_srgb,var(--text)_72%,transparent)]">
                        {entry.completions} completions
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
