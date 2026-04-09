import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminFromCandidates } from "@/lib/adminPlayers";
import { prisma } from "@/lib/prisma";
import { API_ROUTES } from "@/lib/routes";

type SessionUser = {
  discordId?: string;
};

async function runMassRefresh(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;
  const discordId = sessionUser?.discordId?.trim();

  if (!discordId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const requester = await prisma.user.findUnique({
    where: { discordId },
    select: {
      username: true,
      discord_username: true,
    },
  });

  if (!requester) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const canMassRefresh = isAdminFromCandidates([
    requester.discord_username,
    requester.username,
  ]);

  if (!canMassRefresh) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const refreshSecret = process.env.LEADERBOARD_REFRESH_SECRET;
  if (!refreshSecret) {
    return NextResponse.json({ message: "Missing LEADERBOARD_REFRESH_SECRET." }, { status: 500 });
  }

  const refreshUrl = new URL(API_ROUTES.leaderboardRefresh, request.url);

  const refreshResponse = await fetch(refreshUrl, {
    method: "POST",
    headers: {
      "x-refresh-secret": refreshSecret,
    },
    cache: "no-store",
  });

  const payload = (await refreshResponse.json().catch(() => null)) as
    | {
        message?: string;
        refreshedAt?: string;
        levels?: number;
        records?: number;
        fetchedProfiles?: number;
        missingProfiles?: number;
      }
    | null;

  if (!refreshResponse.ok) {
    return NextResponse.json(
      { message: payload?.message || "Mass refresh failed." },
      { status: refreshResponse.status },
    );
  }

  return NextResponse.json({
    message: payload?.message || "Mass refresh completed.",
    refreshedAt: payload?.refreshedAt,
    levels: payload?.levels,
    records: payload?.records,
    fetchedProfiles: payload?.fetchedProfiles,
    missingProfiles: payload?.missingProfiles,
  });
}

export async function GET(request: NextRequest) {
  return runMassRefresh(request);
}

export async function POST(request: NextRequest) {
  return runMassRefresh(request);
}
