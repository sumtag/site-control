"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import { createProject } from "./actions";

export type MembershipRow = {
  projectId: string;
  projectName: string;
  projectNumber: string;
  role: string;
};

export default function ProjectsClient({
  userLabel,
  memberships,
}: {
  userLabel: string;
  memberships: MembershipRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="login-wrap" style={{ alignItems: "flex-start", paddingTop: "8vh" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div className="module-head">
          <div>
            <h2>Your Projects</h2>
            <p>Signed in as {userLabel}</p>
          </div>
          <button className="btn" onClick={() => setCreateOpen(true)}>
            + New Project
          </button>
        </div>
        {memberships.length ? (
          <div className="list">
            {memberships.map((m) => (
              <Link key={m.projectId} href={`/projects/${m.projectId}`} className="row-card">
                <div className="row-main">
                  <div className="row-title">{m.projectName}</div>
                  <div className="row-sub mono">{m.projectNumber}</div>
                </div>
                <span className="pill open">{m.role}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No projects yet</h3>
            <p>You haven&apos;t been added to any project. Create one to get started.</p>
          </div>
        )}
      </div>

      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createProject, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title="New Project"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="project-create-form" className="btn" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      <form id="project-create-form" action={formAction}>
        <div className="field">
          <label htmlFor="name">Project Name</label>
          <input id="name" name="name" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="number">Project Number</label>
          <input id="number" name="number" type="text" placeholder="e.g. PRJ-2026-015" required />
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </Modal>
  );
}
