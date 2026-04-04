import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";

type DiscordProfile = {
  id: string;
  username?: string;
  global_name?: string;
};

type AppJwt = {
  discordId?: string;
  name?: string | null;
};

const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!discordClientId || !discordClientSecret) {
  throw new Error("Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET in environment.");
}

if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("Missing AUTH_SECRET or NEXTAUTH_SECRET in environment.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile }) {
      try {
        const discordProfile = profile as DiscordProfile | undefined;
        const discordId = discordProfile?.id;

        if (!discordId) {
          return false;
        }

        const username =
          discordProfile?.global_name ||
          discordProfile?.username ||
          `discord-${discordId}`;

        await prisma.user.upsert({
          where: { discordId: String(discordId) },
          update: { username },
          create: {
            username,
            discordId: String(discordId),
          },
        });

        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, profile }) {
      const appToken = token as typeof token & AppJwt;
      const profileDiscordId = (profile as DiscordProfile | undefined)?.id;

      if (profileDiscordId) {
        appToken.discordId = String(profileDiscordId);
      }

      if (!appToken.discordId) {
        return appToken;
      }

      const user = await prisma.user.findUnique({
        where: { discordId: appToken.discordId },
        select: {
          username: true,
        },
      });

      if (user?.username) {
        appToken.name = user.username;
      }

      return appToken;
    },
  },
  secret: authSecret,
};