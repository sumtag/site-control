import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

const isDev = process.env.NODE_ENV !== "production";

const entraConfigured =
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Only registered once the Azure app registration is in place — an
    // unconfigured OIDC provider fails Auth.js's config assertion on every
    // request, including ones that don't touch this provider at all.
    ...(entraConfigured
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
    // Ad-hoc external sign-in (magic link via Graph, not SMTP) lands here in
    // Phase 2 as a real Credentials provider backed by the LoginToken table.

    // Dev-only bypass so the app is clickable before Entra is configured.
    // Never active in production — see the isDev guard on the array below.
    ...(isDev
      ? [
          Credentials({
            id: "dev-demo",
            name: "Demo user (dev only)",
            credentials: { email: { label: "Email", type: "text" } },
            async authorize(credentials) {
              const email = credentials?.email as string | undefined;
              if (!email) return null;
              return prisma.user.findUnique({ where: { email } });
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
