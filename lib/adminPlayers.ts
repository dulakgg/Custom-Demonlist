function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function loadAdminPlayers(): Set<string> {
  const raw = process.env.ADMIN_PLAYERS;

  if (!raw) {
    return new Set();
  }

  const fromEnv = raw
    .split(",")
    .map((value) => normalizeName(value))
    .filter(Boolean);

  if (fromEnv.length === 0) {
    return new Set();
  }

  return new Set(fromEnv);
}

const adminPlayers = loadAdminPlayers();

export function isAdminFromCandidates(candidates: Array<string | null | undefined>): boolean {
  return candidates
    .map((candidate) => normalizeName(candidate))
    .filter(Boolean)
    .some((name) => adminPlayers.has(name));
}
