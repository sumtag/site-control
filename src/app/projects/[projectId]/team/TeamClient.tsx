"use client";

import { useActionState, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import { addMember, removeMember, updateMemberRole, updateNotificationPreferences } from "./actions";

const ROLES = ["SUPERINTENDENT", "CONTRACTOR", "CLIENT"] as const;

const NOTIFY_OPTIONS = [
  { field: "notifyOnDocuments", label: "New / updated documents" },
  { field: "notifyOnDrawings", label: "New drawing revisions" },
  { field: "notifyOnRfis", label: "RFIs raised or answered" },
  { field: "notifyOnSubmittals", label: "Submittals lodged or reviewed" },
  { field: "notifyOnDefects", label: "Defects raised or closed" },
  { field: "notifyOnCorrespondence", label: "New correspondence" },
  { field: "notifyOnTransmittals", label: "Transmittals sent to me" },
] as const;

export type MemberRow = {
  id: string;
  userLabel: string;
  email: string | null;
  role: "SUPERINTENDENT" | "CONTRACTOR" | "CLIENT";
  organization: string | null;
  notifyOnDocuments: boolean;
  notifyOnDrawings: boolean;
  notifyOnRfis: boolean;
  notifyOnSubmittals: boolean;
  notifyOnDefects: boolean;
  notifyOnCorrespondence: boolean;
  notifyOnTransmittals: boolean;
};

export default function TeamClient({
  projectId,
  currentMembershipId,
  isSuper,
  members,
}: {
  projectId: string;
  currentMembershipId: string;
  isSuper: boolean;
  members: MemberRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? (members.find((m) => m.id === editingId) ?? null) : null;
  const me = members.find((m) => m.id === currentMembershipId) ?? null;

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Project Team</h2>
          <p>Membership, roles, and your notification preferences.</p>
        </div>
        {isSuper && (
          <button className="btn" onClick={() => setAddOpen(true)}>
            + Add Member
          </button>
        )}
      </div>

      <div className="list">
        {members.map((m) => (
          <div
            className="row-card"
            key={m.id}
            role={isSuper ? "button" : undefined}
            tabIndex={isSuper ? 0 : undefined}
            style={isSuper ? undefined : { cursor: "default" }}
            onClick={isSuper ? () => setEditingId(m.id) : undefined}
            onKeyDown={
              isSuper
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingId(m.id);
                    }
                  }
                : undefined
            }
          >
            <div className="row-main">
              <div className="row-title">
                {m.userLabel}
                {m.id === currentMembershipId ? " (you)" : ""}
              </div>
              <div className="row-sub">
                {m.email}
                {m.organization ? ` · ${m.organization}` : ""}
              </div>
            </div>
            <span className="pill open">{m.role}</span>
          </div>
        ))}
      </div>

      {me && (
        <>
          <div className="divider" style={{ marginTop: 28 }} />
          <NotificationPreferences projectId={projectId} member={me} />
        </>
      )}

      {addOpen && <AddMemberModal projectId={projectId} onClose={() => setAddOpen(false)} />}

      {editing && (
        <EditMemberModal
          projectId={projectId}
          member={editing}
          isSelf={editing.id === currentMembershipId}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}

function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const action = addMember.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title="Add Member"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-member-form" className="btn" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <form id="add-member-form" action={formAction}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
          <div className="hint">
            If they haven&apos;t signed in before, an account is created for them — it activates the
            first time they sign in.
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" placeholder="Optional, until they sign in" />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="CONTRACTOR">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="organization">Organization</label>
          <input id="organization" name="organization" type="text" placeholder="Company name" />
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </Modal>
  );
}

function EditMemberModal({
  projectId,
  member,
  isSelf,
  onClose,
}: {
  projectId: string;
  member: MemberRow;
  isSelf: boolean;
  onClose: () => void;
}) {
  const action = updateMemberRole.bind(null, projectId, member.id);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string | undefined>();

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function handleRemove() {
    if (!confirm(`Remove ${member.userLabel} from this project?`)) return;
    setRemovePending(true);
    setRemoveError(undefined);
    const result = await removeMember(projectId, member.id);
    setRemovePending(false);
    if (result.ok) onClose();
    else setRemoveError(result.error);
  }

  return (
    <Modal
      onClose={onClose}
      title={member.userLabel}
      footer={
        <>
          <button
            type="button"
            className="btn red"
            onClick={handleRemove}
            disabled={removePending || pending}
            style={{ marginRight: "auto" }}
          >
            {removePending ? "Removing…" : "Remove"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-member-form" className="btn" disabled={pending || removePending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="edit-member-form" action={formAction}>
        <div className="field">
          <label>Email</label>
          <div className="dd">{member.email}</div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="role">Role{isSelf ? " (your own)" : ""}</label>
            <select id="role" name="role" defaultValue={member.role}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="organization">Organization</label>
            <input
              id="organization"
              name="organization"
              type="text"
              defaultValue={member.organization ?? ""}
            />
          </div>
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
        {removeError && <p style={{ color: "var(--red)", fontSize: 13 }}>{removeError}</p>}
      </form>
    </Modal>
  );
}

function NotificationPreferences({ projectId, member }: { projectId: string; member: MemberRow }) {
  const action = updateNotificationPreferences.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <>
      <h3 style={{ fontSize: 16, marginTop: 8, marginBottom: 4 }}>My Notification Preferences</h3>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 0, marginBottom: 14 }}>
        What you&apos;d be emailed about on this project — email sending isn&apos;t connected yet, but
        these choices are saved and ready for when it is.
      </p>
      <form action={formAction}>
        <div className="field">
          {NOTIFY_OPTIONS.map((opt) => (
            <label
              key={opt.field}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 13.5,
                fontWeight: 400,
                textTransform: "none",
                marginBottom: 8,
              }}
            >
              <input type="checkbox" name={opt.field} defaultChecked={member[opt.field]} />
              {opt.label}
            </label>
          ))}
        </div>
        <button type="submit" className="btn sm" disabled={pending}>
          {pending ? "Saving…" : "Save Preferences"}
        </button>
        {state.ok && <span style={{ marginLeft: 10, fontSize: 12.5, color: "var(--green)" }}>Saved.</span>}
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </>
  );
}
