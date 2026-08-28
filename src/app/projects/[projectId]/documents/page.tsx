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

  const documents = await prisma.document.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return (
    <DocumentsClient
      projectId={projectId}
      currentUserId={membership.userId}
      currentRole={membership.role}
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
      }))}
    />
  );
}
