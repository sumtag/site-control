import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  await requireMembership(projectId);

  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    include: {
      revisions: {
        where: { status: "CURRENT" },
        take: 1,
      },
    },
  });

  const csv = toCsv(
    ["Drawing Number", "Sheet Name", "Discipline", "Current Revision", "Date of Issue"],
    drawings.map((d) => {
      const current = d.revisions[0];
      return [
        d.number,
        d.title,
        d.discipline,
        current?.rev ?? "",
        current ? current.date.toISOString().slice(0, 10) : "",
      ];
    }),
  );

  return csvResponse(csv, `drawing-register-${projectId}.csv`);
}
