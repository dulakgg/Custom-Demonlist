import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProfilePageClient from "./ProfilePageClient";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function ProfilePage({ params }: Props) {
    const { id } = await params;

    const userId = Number(id);

    if (isNaN(userId)) return notFound();

    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) return notFound();

    return <ProfilePageClient user={user} />;
}