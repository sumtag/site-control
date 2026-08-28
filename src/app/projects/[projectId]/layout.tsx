import { signOut } from "@/auth";
import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  return (
    <AppShell
      projectId={project.id}
      projectName={project.name}
      projectNumber={project.number}
      userLabel={membership.user.name ?? membership.user.email ?? "User"}
      role={membership.role}
      onSignOut={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      {children}
    </AppShell>
  );
}
