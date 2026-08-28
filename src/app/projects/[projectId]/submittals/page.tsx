import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import SubmittalsClient from "./SubmittalsClient";

export default async function SubmittalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const submittals = await prisma.submittal.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
  });

  return (
    <SubmittalsClient
      projectId={projectId}
      currentRole={membership.role}
      submittals={submittals.map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        type: s.type,
        description: s.description,
        submittedBy: s.submittedBy,
        dateSubmitted: s.dateSubmitted.toISOString(),
        reviewerRole: s.reviewerRole,
        requiredBy: s.requiredBy ? s.requiredBy.toISOString() : null,
        status: s.status,
        comments: s.comments,
        reviewDate: s.reviewDate ? s.reviewDate.toISOString() : null,
        reviewedByLabel: s.reviewedBy ? (s.reviewedBy.name ?? s.reviewedBy.email) : null,
        createdByLabel: s.createdBy.name ?? s.createdBy.email ?? "Unknown",
      }))}
    />
  );
}
