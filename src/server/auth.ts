import type { GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
  TokenSet,
} from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { env } from "../env/server.mjs";
import { prisma } from "./db";

/**
 * Module augmentation for `next-auth` types.
 * Allows us to add custom properties to the `session` object and keep type
 * safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 **/
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    // ...other properties
    // role: UserRole;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks,
 * etc.
 *
 * @see https://next-auth.js.org/configuration/options
 **/
export const authOptions: NextAuthOptions = {
  callbacks: {
    async session({ session, user }) {
      const [spotify]: any = await prisma.account.findMany({
        where: { userId: user.id, provider: "spotify" },
      });
      if (spotify?.expires_at < Date.now()) {
        try {
          const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: env.SPOTIFY_APP_ID,
                client_secret: env.SPOTIFY_APP_SECRET,
                grant_type: "refresh_token",
                refresh_token: spotify.refresh_token,
              }),
              method: "POST",
            }
          );
          const tokens: TokenSet | any = await response.json();
          if (!response.ok) throw tokens;
          await prisma.account.update({
            data: {
              access_token: tokens.access_token,
              expires_at: Date.now() + tokens.expires_in * 1000,
              refresh_token: tokens.refresh_token ?? spotify.refresh_token,
            },
            where: {
              provider_providerAccountId: {
                provider: "spotify",
                providerAccountId: spotify.providerAccountId,
              },
            },
          });
        } catch (error) {
          console.error("Error regarding refresh token", error);
        }
      }
      if (session.user) {
        session.user.id = user.id;
        // session.user.role = user.role; <-- put other properties on the session here
        // session.user.access_token = user.access_token
      }
      return session;
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    SpotifyProvider({
      clientId: env.SPOTIFY_APP_ID,
      clientSecret: env.SPOTIFY_APP_SECRET,
      authorization: {
        params: {
          scope:
            "user-read-email user-read-private user-top-read user-read-recently-played playlist-read-private playlist-modify-private user-library-read user-library-modify user-read-playback-position",
        },
      },
    }),
    /**
     * ...add more providers here
     *
     * Most other providers require a bit more work than the Discord provider.
     * For example, the GitHub provider requires you to add the
     * `refresh_token_expires_in` field to the Account model. Refer to the
     * NextAuth.js docs for the provider you want to use. Example:
     * @see https://next-auth.js.org/providers/github
     **/
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the
 * `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 **/
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
