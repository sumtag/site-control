import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireMembership(projectId);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { role: "asc" },
  });

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Project Dashboard</h2>
          <p>Live status across all document-control modules.</p>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="n">—</div>
          <div className="l">Open RFIs</div>
        </div>
        <div className="kpi">
          <div className="n">—</div>
          <div className="l">Drawings Registered</div>
        </div>
        <div className="kpi">
          <div className="n">—</div>
          <div className="l">Submittals Pending</div>
        </div>
        <div className="kpi">
          <div className="n">—</div>
          <div className="l">Open Defects</div>
        </div>
        <div className="kpi">
          <div className="n">—</div>
          <div className="l">Correspondence Open</div>
        </div>
        <div className="kpi">
          <div className="n">—</div>
          <div className="l">Documents Catalogued</div>
        </div>
      </div>
      <div className="dash-cols">
        <div className="panel">
          <h3>Needs Attention</h3>
          <div className="empty" style={{ padding: 24 }}>
            <p>Module data lands in Phase 2 — nothing to show yet.</p>
          </div>
        </div>
        <div className="panel">
          <h3>Project Team</h3>
          {members.map((m) => (
            <div className="activity-item" key={m.id}>
              <div className="dot" />
              <div style={{ flex: 1 }}>
                <div className="txt">
                  <b>{m.user.name ?? m.user.email}</b>
                  {m.organization ? ` — ${m.organization}` : ""}
                </div>
              </div>
              <span className="pill open">{m.role}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
