import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  await requireMembership(projectId);

  const rfis = await prisma.rfi.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    include: {
      raisedBy: { select: { name: true, email: true } },
    },
  });

  const csv = toCsv(
    ["RFI Number", "Subject", "Discipline", "Priority", "Raised By", "Raised Date", "Due Date", "Status"],
    rfis.map((r) => {
      const status = r.closed ? "Closed" : r.response ? "Answered" : "Open";
      return [
        r.number,
        r.subject,
        r.discipline,
        r.priority,
        r.raisedBy.name ?? r.raisedBy.email ?? "Unknown",
        r.raisedDate.toISOString().slice(0, 10),
        r.dueDate ? r.dueDate.toISOString().slice(0, 10) : "",
        status,
      ];
    }),
  );

  return csvResponse(csv, `rfi-register-${projectId}.csv`);
}
