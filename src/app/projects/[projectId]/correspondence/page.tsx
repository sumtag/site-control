import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import CorrespondenceClient from "./CorrespondenceClient";

export default async function CorrespondencePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const items = await prisma.correspondence.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return (
    <CorrespondenceClient
      projectId={projectId}
      currentUserId={membership.userId}
      currentRole={membership.role}
      items={items.map((c) => ({
        id: c.id,
        number: c.number,
        type: c.type,
        subject: c.subject,
        fromText: c.fromText,
        toText: c.toText,
        date: c.date.toISOString(),
        body: c.body,
        status: c.status,
        createdById: c.createdById,
        createdByLabel: c.createdBy.name ?? c.createdBy.email ?? "Unknown",
      }))}
    />
  );
}
