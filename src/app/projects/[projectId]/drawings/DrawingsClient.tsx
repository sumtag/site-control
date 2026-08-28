"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import { TRANSMITTAL_REASONS, TRANSMITTAL_REASON_LABELS } from "@/lib/transmittal";
import type { TransmittalReason } from "@/generated/prisma/client";
import { addMarkup, addRevision, createDrawing, sendTransmittal } from "./actions";

const DISCIPLINES = ["Architectural", "Structural", "Civil", "Mechanical", "Electrical", "Hydraulic", "Other"];

export type MarkupRow = { id: string; imageUrl: string; createdByLabel: string };
export type TransmittalRow = {
  id: string;
  sentAt: string;
  sentByLabel: string;
  reason: TransmittalReason;
  message: string | null;
  recipients: string[];
};
export type RevisionRow = {
  id: string;
  rev: string;
  date: string;
  description: string;
  status: "CURRENT" | "SUPERSEDED";
  sourceFileUrl: string | null;
  sourceFileType: string | null;
  renderedImageUrl: string | null;
  createdByLabel: string;
  markups: MarkupRow[];
  transmittals: TransmittalRow[];
};
export type DrawingRow = {
  id: string;
  number: string;
  title: string;
  discipline: string;
  revisions: RevisionRow[];
};
export type ProjectMemberOption = { userId: string; label: string };

export default function DrawingsClient({
  projectId,
  currentRole,
  members,
  drawings,
}: {
  projectId: string;
  currentRole: string;
  members: ProjectMemberOption[];
  drawings: DrawingRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  // Track the selected drawing by id and re-derive it from the latest
  // `drawings` prop on every render, rather than holding a point-in-time
  // snapshot — the detail modal stays open across markup/transmittal
  // submissions, so it needs to pick up the revalidated data automatically.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isSuper = currentRole === "SUPERINTENDENT";
  const filtered = drawings.filter((d) =>
    `${d.number} ${d.title} ${d.discipline}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = selectedId ? (drawings.find((d) => d.id === selectedId) ?? null) : null;

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Drawing Register</h2>
          <p>Published drawings with full revision history and markup.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={`/projects/${projectId}/drawings/register`} className="btn secondary">
            Download Register
          </a>
          {isSuper && (
            <button className="btn" onClick={() => setCreateOpen(true)}>
              + New Drawing
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search drawings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No drawings yet</h3>
          <p>{isSuper ? "Register the first drawing." : "Nothing published yet."}</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((d) => {
            const current = d.revisions.find((r) => r.status === "CURRENT");
            return (
              <div
                className="row-card"
                key={d.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(d.id);
                  }
                }}
              >
                <div className="row-num mono">{d.number}</div>
                <div className="row-main">
                  <div className="row-title">
                    {current && <span className="rev-tri">{current.rev}</span>}
                    {" "}
                    {d.title}
                  </div>
                  <div className="row-sub">
                    {d.discipline} · {d.revisions.length} revision
                    {d.revisions.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateDrawingModal projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      {selected && (
        <DrawingDetailModal
          projectId={projectId}
          drawing={selected}
          isSuper={isSuper}
          members={members}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function CreateDrawingModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const action = createDrawing.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title="New Drawing"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="drawing-create-form" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Register"}
          </button>
        </>
      }
    >
      <form id="drawing-create-form" action={formAction}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="number">Drawing Number</label>
            <input id="number" name="number" type="text" placeholder="e.g. A-101" required />
          </div>
          <div className="field">
            <label htmlFor="title">Sheet Name</label>
            <input id="title" name="title" type="text" required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="discipline">Discipline</label>
            <select id="discipline" name="discipline" defaultValue={DISCIPLINES[0]}>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rev">Revision</label>
            <input id="rev" name="rev" type="text" defaultValue="A" required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="file">File</label>
            <input id="file" name="file" type="file" accept="image/*,.pdf" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Revision Description</label>
          <textarea id="description" name="description" rows={3} required />
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </Modal>
  );
}

function DrawingDetailModal({
  projectId,
  drawing,
  isSuper,
  members,
  onClose,
}: {
  projectId: string;
  drawing: DrawingRow;
  isSuper: boolean;
  members: ProjectMemberOption[];
  onClose: () => void;
}) {
  const [addingRevision, setAddingRevision] = useState(false);
  const revAction = addRevision.bind(null, projectId, drawing.id);
  const [revState, revFormAction, revPending] = useActionState(revAction, initialActionState);

  useEffect(() => {
    // The whole modal unmounts on close, so there's no need to also reset
    // addingRevision locally — doing so here would be a setState-in-effect
    // that the lint rule (rightly) flags as an unnecessary cascade.
    if (revState.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revState]);

  return (
    <Modal
      onClose={onClose}
      title={`${drawing.number} — ${drawing.title}`}
      wide
      footer={
        addingRevision ? (
          <>
            <button type="button" className="btn ghost" onClick={() => setAddingRevision(false)}>
              Cancel
            </button>
            <button type="submit" form="revision-form" className="btn" disabled={revPending}>
              {revPending ? "Saving…" : "Publish Revision"}
            </button>
          </>
        ) : (
          <>
            {isSuper && (
              <button type="button" className="btn amber" onClick={() => setAddingRevision(true)}>
                + Add Revision
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onClose}>
              Close
            </button>
          </>
        )
      }
    >
      <div className="detail-grid" style={{ marginBottom: 8 }}>
        <div>
          <div className="dt">Discipline</div>
          <div className="dd">{drawing.discipline}</div>
        </div>
      </div>

      {addingRevision && (
        <>
          <div className="divider" />
          <form id="revision-form" action={revFormAction}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="rev">Revision</label>
                <input id="rev" name="rev" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="rfile">File</label>
              <input id="rfile" name="file" type="file" accept="image/*,.pdf" required />
            </div>
            <div className="field">
              <label htmlFor="rdescription">Description</label>
              <textarea id="rdescription" name="description" rows={2} required />
            </div>
            {revState.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{revState.error}</p>}
          </form>
          <div className="divider" />
        </>
      )}

      {drawing.revisions.map((rev) => (
        <RevisionItem
          key={rev.id}
          projectId={projectId}
          drawingId={drawing.id}
          revision={rev}
          isSuper={isSuper}
          members={members}
        />
      ))}
    </Modal>
  );
}

function RevisionItem({
  projectId,
  drawingId,
  revision,
  isSuper,
  members,
}: {
  projectId: string;
  drawingId: string;
  revision: RevisionRow;
  isSuper: boolean;
  members: ProjectMemberOption[];
}) {
  const [transmitting, setTransmitting] = useState(false);

  const markupAction = addMarkup.bind(null, projectId, revision.id);
  const [markupState, markupFormAction, markupPending] = useActionState(markupAction, initialActionState);
  const markupFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (markupState.ok) markupFormRef.current?.reset();
  }, [markupState]);

  const [transmitPending, setTransmitPending] = useState(false);
  const [transmitError, setTransmitError] = useState<string | undefined>();

  async function handleTransmit(formData: FormData) {
    setTransmitPending(true);
    setTransmitError(undefined);
    const result = await sendTransmittal(projectId, drawingId, revision.id, initialActionState, formData);
    setTransmitPending(false);
    // Called directly from the submit flow (not an effect), so it's safe to
    // update local UI state here once the action has actually resolved.
    if (result.ok) setTransmitting(false);
    else setTransmitError(result.error);
  }

  return (
    <div className="rev-log-item">
      <div className="rlh">
        <div>
          <span className="rev-tri">{revision.rev}</span>
          <b>{new Date(revision.date).toLocaleDateString()}</b>
        </div>
        <span className={`pill ${revision.status.toLowerCase()}`}>{revision.status}</span>
      </div>
      <p style={{ fontSize: 13, margin: "8px 0" }}>{revision.description}</p>
      {revision.sourceFileUrl && (
        <a href={revision.sourceFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5 }}>
          View {revision.sourceFileType === "pdf" ? "PDF" : "file"}
        </a>
      )}

      {revision.markups.length > 0 && (
        <div className="thumb-row">
          {revision.markups.map((m) => (
            <a key={m.id} href={m.imageUrl} target="_blank" rel="noopener noreferrer">
              <img src={m.imageUrl} alt="Markup" className="thumb" />
            </a>
          ))}
        </div>
      )}

      <form ref={markupFormRef} action={markupFormAction} style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <input name="file" type="file" accept="image/*" required style={{ fontSize: 12 }} />
        <button type="submit" className="btn ghost sm" disabled={markupPending}>
          {markupPending ? "Uploading…" : "+ Add Markup"}
        </button>
      </form>
      {markupState.error && <p style={{ color: "var(--red)", fontSize: 12 }}>{markupState.error}</p>}

      {isSuper && (
        <div className="status-actions">
          <button type="button" className="btn secondary sm" onClick={() => setTransmitting((v) => !v)}>
            {transmitting ? "Cancel" : "Send Transmittal"}
          </button>
        </div>
      )}

      {transmitting && (
        <form action={handleTransmit} style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor={`reason-${revision.id}`}>Reason for Transmittal</label>
            <select id={`reason-${revision.id}`} name="reason" defaultValue="FOR_INFORMATION">
              {TRANSMITTAL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {TRANSMITTAL_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Recipients</label>
            {members.map((m) => (
              <label key={m.userId} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 400, textTransform: "none" }}>
                <input type="checkbox" name="memberIds" value={m.userId} />
                {m.label}
              </label>
            ))}
          </div>
          <div className="field">
            <label htmlFor={`extraEmails-${revision.id}`}>Additional Emails</label>
            <textarea
              id={`extraEmails-${revision.id}`}
              name="extraEmails"
              rows={2}
              placeholder="one per line"
            />
          </div>
          <div className="field">
            <label htmlFor={`message-${revision.id}`}>Message</label>
            <textarea id={`message-${revision.id}`} name="message" rows={2} />
          </div>
          {transmitError && <p style={{ color: "var(--red)", fontSize: 12 }}>{transmitError}</p>}
          <button type="submit" className="btn sm" disabled={transmitPending}>
            {transmitPending ? "Sending…" : "Send"}
          </button>
        </form>
      )}

      {revision.transmittals.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="dt">Transmittal History</div>
          {revision.transmittals.map((t) => (
            <div key={t.id} className="activity-item">
              <div className="dot" />
              <div style={{ flex: 1 }}>
                <div className="txt">
                  <b>{t.sentByLabel}</b> sent {TRANSMITTAL_REASON_LABELS[t.reason]} to{" "}
                  {t.recipients.join(", ") || "no recipients"}
                  {t.message ? ` — ${t.message}` : ""}
                </div>
              </div>
              <span className="ts">{new Date(t.sentAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
