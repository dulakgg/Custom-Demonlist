"use client";

import Image from "next/image";

type User = {
  id: number;
  username: string;
  discordId: string;
  avatar: string | null;
  createdAt: Date;
};

export default function ProfilePageClient({ user }: { user: User }) {
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
    : "/images/default-avatar.jpg";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center p-6">
      <div className="relative h-24 w-24 overflow-hidden rounded-full border">
        <Image
          src={avatarUrl}
          alt="User avatar"
          fill
          className="object-cover"
        />
      </div>

      <h1 className="mt-4 text-xl font-bold">{user.username}</h1>

      <p className="text-sm opacity-70">Discord ID: {user.discordId}</p>

      <p className="text-sm opacity-70">
        Joined: {new Date(user.createdAt).toDateString()}
      </p>
    </div>
  );
}