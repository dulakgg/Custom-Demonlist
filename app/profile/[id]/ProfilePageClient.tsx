"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaCrown } from "react-icons/fa6";
import { profileRefreshApiRoute } from "@/lib/routes";

type User = {
  id: number;
  username: string;
  discordId: string;
  discordUsername: string | null;
  avatar: string | null;
  createdAt: string;
};

type ProfileRecord = {
  id: string;
  completedAt: string | null;
  videoUrl: string | null;
  leaderboardRank: number | null;
  level: {
    levelId: number;
    levelName: string;
    position: number;
    points: number | null;
    twoPlayer: boolean | null;
    legacy: boolean;
    thumbnailUrl: string;
  };
};

type Props = {
  user: User;
  records: ProfileRecord[];
  isOwnProfile: boolean;
  canRefreshProfile: boolean;
  isAdminProfile: boolean;
  profileRank: number | null;
  profilePoints: number;
  profileCompletionCount: number;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function isTwoPlayerRecord(record: ProfileRecord): boolean {
  if (typeof record.level.twoPlayer === "boolean") {
    return record.level.twoPlayer;
  }

  return /\(2p\)/i.test(record.level.levelName);
}

export default function ProfilePageClient({
  user,
  records,
  isOwnProfile,
  canRefreshProfile,
  isAdminProfile,
  profileRank,
  profilePoints,
  profileCompletionCount,
}: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
    : "/images/default-avatar.jpg";

  async function refreshProfile() {
    setIsRefreshing(true);
    setRefreshMessage(null);

    try {
      // Allow admins to refresh viewed profiles; own profile still works too.
      const response = await fetch(profileRefreshApiRoute(user.discordId), {
        method: "POST",
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      const message = body?.message?.trim() || "Profile refresh failed.";

      if (!response.ok) {
        setRefreshMessage(message);
        return;
      }

      setRefreshMessage("Profile refreshed from AREDL.");
      router.refresh();
    } catch {
      setRefreshMessage("Could not refresh profile right now.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-600 grid-cols-1 gap-3 px-2 pb-8 pt-1 md:px-3">
      <article className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md">
        <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-(--accent)">Player profile</p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-18 w-18 overflow-hidden rounded-full border border-(--border)">
              <Image src={avatarUrl} alt="User avatar" fill className="object-cover" />
            </div>

            <div className="min-w-0">
              <h1 className="m-0 flex items-center gap-2 text-[clamp(1.15rem,2vw,1.8rem)] leading-tight text-(--text)">
                <span className="truncate">{user.username}</span>
                {isAdminProfile ? (
                  <FaCrown
                    className="text-(--primary)"
                    aria-label="This profile is an admin"
                    title="This profile is an admin"
                  />
                ) : null}
              </h1>
              <p className="m-0 mt-0.5 text-sm text-[color-mix(in_srgb,var(--text)_74%,transparent)]">
                AREDL: {user.discordUsername ?? "Not linked yet"}
              </p>
              <p className="m-0 mt-0.5 text-sm text-[color-mix(in_srgb,var(--text)_74%,transparent)]">Discord ID: {user.discordId}</p>
              <p className="m-0 mt-0.5 text-sm text-[color-mix(in_srgb,var(--text)_74%,transparent)]">
                Joined: {new Date(user.createdAt).toDateString()}
              </p>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-3 lg:min-w-95">
            <div className="rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--background)_72%,transparent)] px-2.5 py-2 text-center">
              <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-(--accent)">Profile Rank</p>
              <p className="m-0 mt-1 text-sm font-semibold text-(--text)">{profileRank ? `#${profileRank}` : "Unranked"}</p>
            </div>
            <div className="rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--background)_72%,transparent)] px-2.5 py-2 text-center">
              <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-(--accent)">Points</p>
              <p className="m-0 mt-1 text-sm font-semibold text-(--text)">{profilePoints}</p>
            </div>
            <div className="rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--background)_72%,transparent)] px-2.5 py-2 text-center">
              <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-(--accent)">Completions</p>
              <p className="m-0 mt-1 text-sm font-semibold text-(--text)">{profileCompletionCount}</p>
            </div>
          </div>
        </div>

        {isOwnProfile || canRefreshProfile ? (
          <div className="mt-4 flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={refreshProfile}
              disabled={isRefreshing}
              className="cursor-pointer rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--primary) transition hover:bg-[color-mix(in_srgb,var(--primary)_24%,var(--background))] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isRefreshing ? "Refreshing..." : "Refresh AREDL Profile"}
            </button>
            {refreshMessage ? <p className="text-xs opacity-80">{refreshMessage}</p> : null}
          </div>
        ) : null}
      </article>

      <article className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_90%,transparent)] p-4">
        <h2 className="m-0 text-lg font-semibold text-(--text)">Completions ({records.length})</h2>

        {!user.discordUsername ? (
          <p className="mt-2 text-sm opacity-75">
            This account has no linked AREDL username yet.
          </p>
        ) : records.length === 0 ? (
          <p className="mt-2 text-sm opacity-75">
            No records found for this AREDL username in cached completions.
          </p>
        ) : (
          <ul className="mt-3 grid list-none gap-2.5 p-0">
            {/* Records are pre-sorted on the server by local leaderboard rank. */}
            {records.map((record, index) => {
              const twoPlayerLabel = isTwoPlayerRecord(record) ? "2P" : "Solo";

              return (
              <li
                key={record.id}
                className="overflow-hidden rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] shadow-[0_10px_22px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
              >
                <div className="relative h-19.5 w-full sm:h-23 md:h-27">
                  <Image
                    src={record.level.thumbnailUrl}
                    alt={`${record.level.levelName} thumbnail`}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="px-3 py-2">
                  <p className="m-0 text-[clamp(0.95rem,1.35vw,1.2rem)] leading-tight text-(--text)">{record.level.levelName}</p>
                  <p className="m-0 mt-0.5 text-[11px] uppercase tracking-[0.12em] text-(--accent)">
                    Level #{record.level.levelId}{record.level.legacy ? " • Legacy" : ""}
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--text)_72%,transparent)]">
                      Completion #{index + 1}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-(--primary)">
                        Rank {record.leaderboardRank ? `#${record.leaderboardRank}` : "-"}
                      </span>
                      <span className="shrink-0 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-(--primary)">
                        AREDL #{Math.round(record.level.position)}
                      </span>
                      <span className="shrink-0 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-(--primary)">
                        {record.level.points ?? 0} pts
                      </span>
                      <span className="shrink-0 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-(--primary)">
                        {twoPlayerLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="m-0 text-xs text-[color-mix(in_srgb,var(--text)_72%,transparent)]">Completed: {formatDate(record.completedAt)}</p>
                    {record.videoUrl ? (
                      <a
                        href={record.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-lg border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,var(--background))] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-(--primary) transition hover:bg-[color-mix(in_srgb,var(--primary)_22%,var(--background))]"
                      >
                        Watch
                      </a>
                    ) : (
                      <span className="text-xs text-[color-mix(in_srgb,var(--text)_68%,transparent)]">No video</span>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </article>

    </section>
  );
}