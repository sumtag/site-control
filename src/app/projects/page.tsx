import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import ProjectsClient from "./ProjectsClient";

export default async function ProjectsPage() {
  const user = await requireUser();

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: { project: true },
    orderBy: { project: { name: "asc" } },
  });

  return (
    <ProjectsClient
      userLabel={user.name ?? user.email ?? "User"}
      memberships={memberships.map((m) => ({
        projectId: m.projectId,
        projectName: m.project.name,
        projectNumber: m.project.number,
        role: m.role,
      }))}
    />
  );
}
