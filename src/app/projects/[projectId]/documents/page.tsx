import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import DocumentsClient from "./DocumentsClient";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const [documents, members] = await Promise.all([
    prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        transmittals: {
          orderBy: { sentAt: "desc" },
          include: {
            sentBy: { select: { name: true, email: true } },
            recipients: true,
          },
        },
      },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <DocumentsClient
      projectId={projectId}
      currentUserId={membership.userId}
      currentRole={membership.role}
      members={members.map((m) => ({
        userId: m.userId,
        label: m.user.name ?? m.user.email ?? "Unknown",
      }))}
      documents={documents.map((d) => ({
        id: d.id,
        number: d.number,
        title: d.title,
        category: d.category,
        revision: d.revision,
        date: d.date.toISOString(),
        author: d.author,
        description: d.description,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        createdById: d.createdById,
        createdByLabel: d.createdBy.name ?? d.createdBy.email ?? "Unknown",
        transmittals: d.transmittals.map((t) => ({
          id: t.id,
          sentAt: t.sentAt.toISOString(),
          sentByLabel: t.sentBy.name ?? t.sentBy.email ?? "Unknown",
          reason: t.reason,
          message: t.message,
          recipients: t.recipients.map((rec) => rec.name ?? rec.emailAddress),
        })),
      }))}
    />
  );
}
