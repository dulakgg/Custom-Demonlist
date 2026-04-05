import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";

type DiscordProfile = {
  id: string;
  username?: string;
  global_name?: string;
  avatar?: string | null;
};

type AppJwt = {
  discordId?: string;
  name?: string | null;
  id?: number;
  avatar?: string | null;
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
        const avatar = discordProfile?.avatar;

        await prisma.user.upsert({
          where: { discordId: String(discordId) },
          update: { username, avatar },
          create: {
            username,
            discordId: String(discordId),
            avatar,
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
          id: true,
          username: true,
          avatar: true,
        },
      });

      if (appToken.discordId) {
        appToken.discordId = appToken.discordId;
      }
      if (user?.username) {
        appToken.name = user.username;
      }
      if (user?.id) {
        appToken.id = user.id;
      }

      if (user?.avatar) {
        appToken.avatar = user.avatar;
      }

      return appToken;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).discordId = (token as any).discordId;
        (session.user as any).avatar = (token as any).avatar;
      }
      return session;
    }
  },
  secret: authSecret,
};