import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ levelId: string }>;
};

const API_BASE = "https://api.aredl.net/v2/api/aredl";

export async function GET(_: Request, { params }: RouteParams) {
  const { levelId } = await params;
  const id = Number(levelId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: "Invalid level id" }, { status: 400 });
  }

  const response = await fetch(`${API_BASE}/levels/${id}`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return NextResponse.json({ message: "Level not found" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
