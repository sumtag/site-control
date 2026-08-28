import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import RfisClient from "./RfisClient";

export default async function RfisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const rfis = await prisma.rfi.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      raisedBy: { select: { name: true, email: true } },
      respondedBy: { select: { name: true, email: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <RfisClient
      projectId={projectId}
      currentRole={membership.role}
      rfis={rfis.map((r) => ({
        id: r.id,
        number: r.number,
        subject: r.subject,
        question: r.question,
        discipline: r.discipline,
        priority: r.priority,
        raisedByLabel: r.raisedBy.name ?? r.raisedBy.email ?? "Unknown",
        raisedDate: r.raisedDate.toISOString(),
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
        response: r.response,
        respondedByLabel: r.respondedBy ? (r.respondedBy.name ?? r.respondedBy.email) : null,
        respondedDate: r.respondedDate ? r.respondedDate.toISOString() : null,
        closed: r.closed,
        attachments: r.attachments.map((a) => ({ id: a.id, name: a.name, fileUrl: a.fileUrl })),
      }))}
    />
  );
}
