import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import DefectsClient from "./DefectsClient";

export default async function DefectsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const defects = await prisma.defect.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      raisedBy: { select: { name: true, email: true } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <DefectsClient
      projectId={projectId}
      currentRole={membership.role}
      currentUserLabel={membership.user.name ?? membership.user.email ?? "User"}
      defects={defects.map((d) => ({
        id: d.id,
        number: d.number,
        description: d.description,
        location: d.location,
        severity: d.severity,
        status: d.status,
        raisedByLabel: d.raisedBy.name ?? d.raisedBy.email ?? "Unknown",
        raisedDate: d.raisedDate.toISOString(),
        assignedTo: d.assignedTo,
        dueDate: d.dueDate ? d.dueDate.toISOString() : null,
        remediation: d.remediation,
        closedDate: d.closedDate ? d.closedDate.toISOString() : null,
        verifiedBy: d.verifiedBy,
        photos: d.photos.map((p) => ({ id: p.id, imageUrl: p.imageUrl })),
      }))}
    />
  );
}
