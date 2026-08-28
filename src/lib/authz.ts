import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ProjectMember, ProjectRole } from "@/generated/prisma/client";

// Server-side permission boundary. Every module route/action goes through
// one of these — the sidebar and buttons a role can't use are a UX nicety,
// never the actual check.

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

// Loads the caller's membership for a project, or bounces them out. A user
// who isn't a member sees a 404, not a 403 — we don't confirm the project
// exists to people outside it.
export async function requireMembership(
  projectId: string,
): Promise<ProjectMember & { user: { name: string | null; email: string | null } }> {
  const user = await requireUser();
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!membership) notFound();
  return membership;
}

export function requireRole(
  membership: { role: ProjectRole },
  allowed: ProjectRole[],
) {
  if (!allowed.includes(membership.role)) {
    throw new Error(
      `Role ${membership.role} is not permitted to perform this action (requires one of: ${allowed.join(", ")})`,
    );
  }
}
