import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import TeamClient from "./TeamClient";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { invitedAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <TeamClient
      projectId={projectId}
      currentMembershipId={membership.id}
      isSuper={membership.role === "SUPERINTENDENT"}
      members={members.map((m) => ({
        id: m.id,
        userLabel: m.user.name ?? m.user.email ?? "Unknown",
        email: m.user.email,
        role: m.role,
        organization: m.organization,
        notifyOnDocuments: m.notifyOnDocuments,
        notifyOnDrawings: m.notifyOnDrawings,
        notifyOnRfis: m.notifyOnRfis,
        notifyOnSubmittals: m.notifyOnSubmittals,
        notifyOnDefects: m.notifyOnDefects,
        notifyOnCorrespondence: m.notifyOnCorrespondence,
        notifyOnTransmittals: m.notifyOnTransmittals,
      }))}
    />
  );
}
