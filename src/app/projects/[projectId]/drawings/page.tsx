import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import DrawingsClient from "./DrawingsClient";

export default async function DrawingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const membership = await requireMembership(projectId);

  const [drawings, members] = await Promise.all([
    prisma.drawing.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        revisions: {
          orderBy: { date: "desc" },
          include: {
            createdBy: { select: { name: true, email: true } },
            markups: {
              orderBy: { createdAt: "asc" },
              include: { createdBy: { select: { name: true, email: true } } },
            },
            transmittals: {
              orderBy: { sentAt: "desc" },
              include: {
                sentBy: { select: { name: true, email: true } },
                recipients: true,
              },
            },
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
    <DrawingsClient
      projectId={projectId}
      currentRole={membership.role}
      members={members.map((m) => ({
        userId: m.userId,
        label: m.user.name ?? m.user.email ?? "Unknown",
      }))}
      drawings={drawings.map((d) => ({
        id: d.id,
        number: d.number,
        title: d.title,
        discipline: d.discipline,
        revisions: d.revisions.map((r) => ({
          id: r.id,
          rev: r.rev,
          date: r.date.toISOString(),
          description: r.description,
          status: r.status,
          sourceFileUrl: r.sourceFileUrl,
          sourceFileType: r.sourceFileType,
          renderedImageUrl: r.renderedImageUrl,
          createdByLabel: r.createdBy.name ?? r.createdBy.email ?? "Unknown",
          markups: r.markups.map((mk) => ({
            id: mk.id,
            imageUrl: mk.imageUrl,
            createdByLabel: mk.createdBy.name ?? mk.createdBy.email ?? "Unknown",
          })),
          transmittals: r.transmittals.map((t) => ({
            id: t.id,
            sentAt: t.sentAt.toISOString(),
            sentByLabel: t.sentBy.name ?? t.sentBy.email ?? "Unknown",
            message: t.message,
            recipients: t.recipients.map((rec) => rec.name ?? rec.emailAddress),
          })),
        })),
      }))}
    />
  );
}
