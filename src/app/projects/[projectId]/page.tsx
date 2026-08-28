import Link from "next/link";

import { requireMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireMembership(projectId);

  // Batched via $transaction rather than Promise.all: firing 10 independent
  // queries concurrently exhausts the local dev database's connection_limit
  // (see project memory) — the array form of $transaction sends them over a
  // single connection instead of opening one per query.
  const [
    members,
    openRfis,
    drawingsCount,
    pendingSubmittals,
    openDefects,
    openCorrespondence,
    documentsCount,
    recentActivity,
    overdueRfis,
    criticalDefects,
  ] = await prisma.$transaction([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { role: "asc" },
    }),
    prisma.rfi.count({ where: { projectId, closed: false } }),
    prisma.drawing.count({ where: { projectId } }),
    prisma.submittal.count({ where: { projectId, status: "PENDING" } }),
    prisma.defect.count({ where: { projectId, status: { not: "CLOSED" } } }),
    prisma.correspondence.count({ where: { projectId, status: { not: "CLOSED" } } }),
    prisma.document.count({ where: { projectId } }),
    prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actedBy: { select: { name: true, email: true } } },
    }),
    prisma.rfi.findMany({
      where: { projectId, closed: false, dueDate: { lt: new Date() } },
      select: { id: true, number: true, subject: true, dueDate: true },
      take: 5,
    }),
    prisma.defect.findMany({
      where: { projectId, status: { not: "CLOSED" }, severity: "CRITICAL" },
      select: { id: true, number: true, description: true },
      take: 5,
    }),
  ]);

  const needsAttention = [
    ...overdueRfis.map((r) => ({
      key: `rfi-${r.id}`,
      text: `${r.number} — ${r.subject}`,
      detail: `Overdue since ${r.dueDate ? new Date(r.dueDate).toLocaleDateString() : ""}`,
      href: `/projects/${projectId}/rfis`,
    })),
    ...criticalDefects.map((d) => ({
      key: `defect-${d.id}`,
      text: `${d.number} — ${d.description.slice(0, 60)}`,
      detail: "Critical defect open",
      href: `/projects/${projectId}/defects`,
    })),
  ];

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Project Dashboard</h2>
          <p>Live status across all document-control modules.</p>
        </div>
      </div>
      <div className="kpi-grid">
        <Link href={`/projects/${projectId}/rfis`} className="kpi" style={{ textDecoration: "none" }}>
          <div className="n">{openRfis}</div>
          <div className="l">Open RFIs</div>
        </Link>
        <Link href={`/projects/${projectId}/drawings`} className="kpi" style={{ textDecoration: "none" }}>
          <div className="n">{drawingsCount}</div>
          <div className="l">Drawings Registered</div>
        </Link>
        <Link href={`/projects/${projectId}/submittals`} className="kpi" style={{ textDecoration: "none" }}>
          <div className="n">{pendingSubmittals}</div>
          <div className="l">Submittals Pending</div>
        </Link>
        <Link href={`/projects/${projectId}/defects`} className="kpi" style={{ textDecoration: "none" }}>
          <div className="n">{openDefects}</div>
          <div className="l">Open Defects</div>
        </Link>
        <Link href={`/projects/${projectId}/correspondence`} className="kpi" style={{ textDecoration: "none" }}>
          <div className="n">{openCorrespondence}</div>
          <div className="l">Correspondence Open</div>
        </Link>
        <Link href={`/projects/${projectId}/documents`} className="kpi" style={{ textDecoration: "none" }}>
          <div className="n">{documentsCount}</div>
          <div className="l">Documents Catalogued</div>
        </Link>
      </div>
      <div className="dash-cols">
        <div className="panel">
          <h3>Needs Attention</h3>
          {needsAttention.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              <p>Nothing needs attention right now.</p>
            </div>
          ) : (
            needsAttention.map((item) => (
              <Link key={item.key} href={item.href} className="attn-item" style={{ textDecoration: "none" }}>
                <span className="t">{item.text}</span>
                <span className="d">{item.detail}</span>
              </Link>
            ))
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel">
            <h3>Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <p>No activity yet.</p>
              </div>
            ) : (
              recentActivity.map((a) => (
                <div className="activity-item" key={a.id}>
                  <div className="dot" />
                  <div style={{ flex: 1 }}>
                    <div className="txt">
                      <b>{a.actedBy.name ?? a.actedBy.email}</b> {a.action} {a.refNumber} — {a.title}
                    </div>
                  </div>
                  <span className="ts">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
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
      </div>
    </>
  );
}
