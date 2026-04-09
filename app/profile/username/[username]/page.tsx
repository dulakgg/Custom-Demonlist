import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { profileByIdRoute } from "@/lib/routes";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function ProfileUsernameRedirectPage({ params }: Props) {
  const { username } = await params;
  const trimmedUsername = username.trim();

  if (!trimmedUsername) {
    return notFound();
  }

  // Try AREDL username first, then local username as fallback.
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          discord_username: {
            equals: trimmedUsername,
            mode: "insensitive",
          },
        },
        {
          username: {
            equals: trimmedUsername,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (!user) {
    return notFound();
  }

  // Canonical profile pages are id-based.
  redirect(profileByIdRoute(user.id));
}
