import Link from "next/link";

import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const user = await requireUser();

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: { project: true },
    orderBy: { project: { name: "asc" } },
  });

  return (
    <div className="login-wrap" style={{ alignItems: "flex-start", paddingTop: "8vh" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div className="module-head">
          <div>
            <h2>Your Projects</h2>
            <p>Signed in as {user.name ?? user.email}</p>
          </div>
        </div>
        {memberships.length ? (
          <div className="list">
            {memberships.map((m) => (
              <Link
                key={m.projectId}
                href={`/projects/${m.projectId}`}
                className="row-card"
              >
                <div className="row-main">
                  <div className="row-title">{m.project.name}</div>
                  <div className="row-sub mono">{m.project.number}</div>
                </div>
                <span className="pill open">{m.role}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No projects yet</h3>
            <p>You haven&apos;t been added to any project.</p>
          </div>
        )}
      </div>
    </div>
  );
}
