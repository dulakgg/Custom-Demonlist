"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FaCrown } from "react-icons/fa6";

type LeaderboardRecord = {
  id: string;
  playerDisplayName: string;
  playerUsername: string;
  isListedPlayer: boolean;
  completedAt: string | undefined;
  videoUrl: string | null;
};

type LeaderboardLevel = {
  levelId: number;
  levelName: string;
  position: number;
  legacy: boolean;
  thumbnailUrl: string;
  records: LeaderboardRecord[];
};

type LevelDetails = {
  id: string;
  level_id: number;
  position: number;
  name: string;
  points: number;
  legacy: boolean;
  two_player: boolean;
  tags: string[];
  description: string;
  song: number;
  edel_enjoyment: number;
  is_edel_pending: boolean;
  gddl_tier: number;
  nlw_tier: string;
  publisher?: {
    username?: string;
    global_name?: string;
  };
};

type Props = {
  levels: LeaderboardLevel[];
};

function youtubeEmbed(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const watchIdMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  const shortIdMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  const embedIdMatch = url.match(/embed\/([a-zA-Z0-9_-]{6,})/);

  const videoId = watchIdMatch?.[1] ?? shortIdMatch?.[1] ?? embedIdMatch?.[1];
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

function formatDate(value?: string): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function detailRows(level: LeaderboardLevel, details?: LevelDetails) {
  return [
    { label: "Level ID", value: String(level.levelId) },
    { label: "Position", value: `#${level.position}` },
    { label: "Points", value: details?.points != null ? String(details.points) : "-" },
    { label: "Legacy", value: details?.legacy != null ? (details.legacy ? "Yes" : "No") : level.legacy ? "Yes" : "No" },
    { label: "Two Player", value: details?.two_player != null ? (details.two_player ? "Yes" : "No") : "-" },
    { label: "Song", value: details?.song != null ? String(details.song) : "-" },
    {
      label: "Publisher",
      value: details?.publisher ? details.publisher.global_name || details.publisher.username || "-" : "-",
    },
    { label: "GDDL Tier", value: details?.gddl_tier != null ? String(details.gddl_tier) : "-" },
    { label: "NLW Tier", value: details?.nlw_tier || "-" },
    {
      label: "Enjoyment",
      value: details?.edel_enjoyment != null ? String(details.edel_enjoyment) : "-",
    },
    {
      label: "Pending",
      value: details?.is_edel_pending != null ? (details.is_edel_pending ? "Yes" : "No") : "-",
    },
    {
      label: "Tags",
      value: details?.tags && details.tags.length > 0 ? details.tags.join(", ") : "-",
    },
  ];
}

type DetailTab = "records" | "info";

function LevelCard({
  level,
  index,
  isActive,
  onSelect,
  prefersReducedMotion,
}: {
  level: LeaderboardLevel;
  index: number;
  isActive: boolean;
  onSelect: (id: number) => void;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <motion.button
      type="button"
      className={`w-full cursor-pointer overflow-hidden rounded-lg border text-left shadow-[0_10px_22px_color-mix(in_srgb,var(--primary)_16%,transparent)] transition-colors ${
        isActive ? "border-(--primary)" : "border-(--border)"
      } bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] hover:bg-[color-mix(in_srgb,var(--primary)_18%,var(--background))]`}
      onClick={() => onSelect(level.levelId)}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.22, ease: "easeOut", delay: index * 0.012 }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.004 }}
    >
      <Image
        src={level.thumbnailUrl}
        alt={`${level.levelName} thumbnail`}
        width={1920}
        height={200}
        loading="lazy"
        sizes="(max-width: 1535px) 100vw, 1500px"
        className="block h-19.5 w-full object-cover sm:h-23 md:h-27 lg:h-29.5 xl:h-33"
      />
      <div className="px-3 py-2">
        <h2 className="m-0 text-[clamp(0.95rem,1.35vw,1.2rem)] leading-tight text-(--text)">{level.levelName}</h2>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-(--accent)">Position #{level.position}</p>
      </div>
    </motion.button>
  );
}

type LevelDetailsPanelProps = {
  level: LeaderboardLevel;
  selectedRecord: LeaderboardRecord | null;
  onRecordSelect: (recordId: string) => void;
  selectedDetails?: LevelDetails;
  loadingInfo: boolean;
  activeEmbed: string | null;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  prefersReducedMotion: boolean | null;
  className?: string;
  panelTitle: string;
};

function LevelDetailsPanel({
  level,
  selectedRecord,
  onRecordSelect,
  selectedDetails,
  loadingInfo,
  activeEmbed,
  activeTab,
  onTabChange,
  prefersReducedMotion,
  className,
  panelTitle,
}: LevelDetailsPanelProps) {
  const recordsTabId = `records-tab-${level.levelId}`;
  const infoTabId = `info-tab-${level.levelId}`;
  const recordsPanelId = `records-panel-${level.levelId}`;
  const infoPanelId = `info-panel-${level.levelId}`;

  return (
    <motion.article
      className={`rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_90%,transparent)] p-3 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] ${className ?? ""}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.2, ease: "easeOut" }}
    >
      <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-(--accent)">{panelTitle}</p>
      <h3 className="m-0 mt-1 text-[1.12rem] leading-tight text-(--text)">{level.levelName}</h3>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-[color-mix(in_srgb,var(--text)_72%,transparent)]">
        Position #{level.position} {level.legacy ? " • Legacy" : ""}
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_66%,black)]">
        {activeEmbed ? (
          <iframe
            src={activeEmbed}
            title={`${level.levelName} completion`}
            className="block aspect-video w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <div className="grid min-h-45 place-items-center px-3 text-center text-sm text-[color-mix(in_srgb,var(--text)_70%,transparent)]">
            Selected record has no embeddable completion video.
          </div>
        )}
      </div>

      <div className="mt-3" role="tablist" aria-label={`Records and info tabs for ${level.levelName}`}>
        <div className="grid w-full grid-cols-2 gap-2 rounded-xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_72%,transparent)] p-1.5">
          <button
            id={recordsTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "records"}
            aria-controls={recordsPanelId}
            onClick={() => onTabChange("records")}
            className={`cursor-pointer rounded-lg border border-(--primary) px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.11em] transition ${
              activeTab === "records"
                ? "bg-(--primary) text-white"
                : "bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] text-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_24%,var(--background))]"
            }`}
          >
            Records
          </button>
          <button
            id={infoTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            aria-controls={infoPanelId}
            onClick={() => onTabChange("info")}
            className={`cursor-pointer rounded-lg border border-(--primary) px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.11em] transition ${
              activeTab === "info"
                ? "bg-(--primary) text-white"
                : "bg-[color-mix(in_srgb,var(--primary)_14%,var(--background))] text-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_24%,var(--background))]"
            }`}
          >
            Info
          </button>
        </div>
      </div>

      {activeTab === "records" ? (
        <div id={recordsPanelId} role="tabpanel" aria-labelledby={recordsTabId} className="mt-2">
          {level.records.length === 0 ? (
            <p className="text-sm text-[color-mix(in_srgb,var(--text)_72%,transparent)]">No records available for this level.</p>
          ) : (
            <ul className="grid max-h-55 list-none gap-1.5 overflow-auto p-0 pr-1">
              {level.records.map((record) => {
                const active = selectedRecord?.id === record.id;

                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      onClick={() => onRecordSelect(record.id)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? "border-(--primary) bg-(--primary) text-white"
                          : "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,var(--background))] hover:bg-[color-mix(in_srgb,var(--primary)_20%,var(--background))]"
                      }`}
                      title={record.playerUsername}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {record.isListedPlayer ? (
                          <FaCrown
                            className={`shrink-0 ${active ? "text-[color-mix(in_srgb,white_90%,transparent)]" : "text-(--primary)"}`}
                            aria-label="Listed player"
                          />
                        ) : null}
                        <span className={`truncate ${active ? "text-white" : "text-(--text)"}`}>{record.playerDisplayName}</span>
                      </span>
                      <span className={`shrink-0 ${active ? "text-[color-mix(in_srgb,white_82%,transparent)]" : "text-[color-mix(in_srgb,var(--text)_72%,transparent)]"}`}>
                        {formatDate(record.completedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div id={infoPanelId} role="tabpanel" aria-labelledby={infoTabId} className="mt-2">
          {loadingInfo && !selectedDetails ? (
            <p className="text-sm text-[color-mix(in_srgb,var(--text)_72%,transparent)]">Loading level info...</p>
          ) : (
            <>
              <ul className="grid list-none gap-1.5 p-0">
                {detailRows(level, selectedDetails).map((entry) => (
                  <li
                    key={entry.label}
                    className="rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--background)_74%,transparent)] px-2.5 py-2"
                  >
                    <p className="m-0 text-[10px] uppercase tracking-widest text-(--accent)">{entry.label}</p>
                    <p className="m-0 mt-0.5 wrap-break-word text-sm text-(--text)">{entry.value}</p>
                  </li>
                ))}
              </ul>
              {selectedDetails?.description ? (
                <div className="mt-2 rounded-lg border border-(--border) bg-[color-mix(in_srgb,var(--background)_74%,transparent)] px-2.5 py-2">
                  <p className="m-0 text-[10px] uppercase tracking-widest text-(--accent)">Description</p>
                  <p className="m-0 mt-1 text-sm text-(--text)">{selectedDetails.description}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

export default function LeaderboardClient({ levels }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(levels[0]?.levelId ?? null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [detailsByLevelId, setDetailsByLevelId] = useState<Record<number, LevelDetails>>({});
  const [loadingInfoForLevelId, setLoadingInfoForLevelId] = useState<number | null>(null);
  const [tabByLevelId, setTabByLevelId] = useState<Record<number, DetailTab>>({});

  const selectedLevel = useMemo(
    () => levels.find((level) => level.levelId === selectedLevelId) ?? null,
    [levels, selectedLevelId],
  );

  useEffect(() => {
    if (!selectedLevel) {
      setSelectedRecordId(null);
      return;
    }

    const firstWithVideo = selectedLevel.records.find((record) => youtubeEmbed(record.videoUrl) !== null);
    setSelectedRecordId(firstWithVideo?.id ?? selectedLevel.records[0]?.id ?? null);
  }, [selectedLevel]);

  useEffect(() => {
    if (!selectedLevel) {
      return;
    }

    const levelId = selectedLevel.levelId;

    if (detailsByLevelId[levelId]) {
      return;
    }

    let cancelled = false;

    async function loadDetails() {
      setLoadingInfoForLevelId(levelId);
      try {
        const response = await fetch(`/api/aredl/levels/${levelId}`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as LevelDetails;
        if (!cancelled) {
          setDetailsByLevelId((prev) => ({ ...prev, [levelId]: payload }));
        }
      } finally {
        if (!cancelled) {
          setLoadingInfoForLevelId((current) => (current === levelId ? null : current));
        }
      }
    }

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [detailsByLevelId, selectedLevel]);

  const selectedRecord = useMemo(() => {
    if (!selectedLevel) {
      return null;
    }

    if (selectedRecordId) {
      const found = selectedLevel.records.find((record) => record.id === selectedRecordId);
      if (found) {
        return found;
      }
    }

    return selectedLevel.records[0] ?? null;
  }, [selectedLevel, selectedRecordId]);

  const activeEmbed = youtubeEmbed(selectedRecord?.videoUrl);
  const currentLevels = useMemo(() => levels.filter((level) => !level.legacy), [levels]);
  const legacyLevels = useMemo(() => levels.filter((level) => level.legacy), [levels]);
  const selectedDetails = selectedLevel ? detailsByLevelId[selectedLevel.levelId] : undefined;

  function setTabForLevel(levelId: number, tab: DetailTab) {
    setTabByLevelId((prev) => {
      if (prev[levelId] === tab) {
        return prev;
      }

      return { ...prev, [levelId]: tab };
    });
  }

  function handleLevelSelect(levelId: number) {
    setSelectedLevelId((current) => (current === levelId ? null : levelId));
  }

  function renderLevelRow(level: LeaderboardLevel, index: number) {
    const isActive = selectedLevelId === level.levelId;
    const levelDetails = detailsByLevelId[level.levelId];
    const loadingLevelInfo = loadingInfoForLevelId === level.levelId && !levelDetails;
    const panelRecord = isActive ? selectedRecord : level.records[0] ?? null;
    const panelEmbed = youtubeEmbed(panelRecord?.videoUrl);
    const panelTab = tabByLevelId[level.levelId] ?? "records";

    return (
      <div key={level.levelId} className="flex flex-col gap-2">
        <LevelCard
          level={level}
          index={index}
          isActive={isActive}
          onSelect={handleLevelSelect}
          prefersReducedMotion={prefersReducedMotion}
        />
        {isActive ? (
          <LevelDetailsPanel
            level={level}
            selectedRecord={panelRecord}
            onRecordSelect={setSelectedRecordId}
            selectedDetails={levelDetails}
            loadingInfo={loadingLevelInfo}
            activeEmbed={panelEmbed}
            activeTab={panelTab}
            onTabChange={(tab) => setTabForLevel(level.levelId, tab)}
            prefersReducedMotion={prefersReducedMotion}
            className="xl:hidden"
            panelTitle="Level details"
          />
        ) : null}
      </div>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-600 grid-cols-1 gap-3 pb-8 pt-1 xl:items-start xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <header className="rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] backdrop-blur-md">
          <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-(--accent)">Custom demonlist</p>
          <h1 className="m-0 mt-1 text-[clamp(1.3rem,2.6vw,2.5rem)] leading-[0.95] text-(--text)">Leaderboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-[color-mix(in_srgb,var(--text)_74%,transparent)]">
            Click a strip to open completion details. On phones, tabs open directly under the selected strip.
          </p>
        </header>

        <div className="mt-4 flex flex-col gap-2.5" aria-label="Current list">
          {currentLevels.map((level, index) => renderLevelRow(level, index))}
        </div>

        {legacyLevels.length > 0 ? (
          <section className="mt-5" aria-label="Legacy list">
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-(--accent)">--legacy--</p>
            <div className="flex flex-col gap-2.5">
              {legacyLevels.map((level, index) => renderLevelRow(level, currentLevels.length + index))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="hidden xl:block xl:self-start xl:sticky xl:top-20.5 xl:max-h-[calc(100dvh-82px)] xl:overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedLevel ? (
            <LevelDetailsPanel
              key={selectedLevel.levelId}
              level={selectedLevel}
              selectedRecord={selectedRecord}
              onRecordSelect={setSelectedRecordId}
              selectedDetails={selectedDetails}
              loadingInfo={loadingInfoForLevelId === selectedLevel.levelId && !selectedDetails}
              activeEmbed={activeEmbed}
              activeTab={tabByLevelId[selectedLevel.levelId] ?? "records"}
              onTabChange={(tab) => setTabForLevel(selectedLevel.levelId, tab)}
              prefersReducedMotion={prefersReducedMotion}
              panelTitle="Completion panel"
            />
          ) : (
            <motion.article
              key="no-selection"
              className="grid min-h-50 place-items-center rounded-2xl border border-(--border) bg-[color-mix(in_srgb,var(--background)_90%,transparent)] p-3 text-[color-mix(in_srgb,var(--text)_72%,transparent)]"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            >
              Select a level to open details.
            </motion.article>
          )}
        </AnimatePresence>
      </aside>
    </section>
  );
}
