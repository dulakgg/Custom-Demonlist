export const ROUTES = {
  home: "/",
  leaderboard: "/leaderboard",
  profiles: "/profiles",
  login: "/login",
} as const;

export const CACHE_TAGS = {
  leaderboardLevels: "leaderboard-levels",
  profilesLeaderboard: "profiles-leaderboard",
} as const;

export function profileByIdRoute(id: number | string): string {
  return `/profile/${encodeURIComponent(String(id))}`;
}

export function profileByUsernameRoute(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) {
    return ROUTES.profiles;
  }

  return `/profile/username/${encodeURIComponent(trimmed)}`;
}

export function aredlLevelApiRoute(levelId: number | string): string {
  return `/api/aredl/levels/${encodeURIComponent(String(levelId))}`;
}

export function profileRefreshApiRoute(discordId?: string): string {
  if (!discordId) {
    return "/api/profile/refresh";
  }

  return `/api/profile/refresh?discordId=${encodeURIComponent(discordId)}`;
}

export const API_ROUTES = {
  leaderboardRefresh: "/api/leaderboard/refresh",
  profileRefresh: "/api/profile/refresh",
  massRefresh: "/api/refresh/mass",
  themes: "/api/themes",
} as const;

export function themeStylesheetRoute(theme: string): string {
  return `/themes/${encodeURIComponent(theme)}.css`;
}
