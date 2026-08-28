"use client";

import { useActionState, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import { closeDefect, createDefect, updateRemediation } from "./actions";

const SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;

export type DefectPhotoRow = { id: string; imageUrl: string };

export type DefectRow = {
  id: string;
  number: string;
  description: string;
  location: string;
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  status: "OPEN" | "PROGRESS" | "CLOSED";
  raisedByLabel: string;
  raisedDate: string;
  assignedTo: string;
  dueDate: string | null;
  remediation: string | null;
  closedDate: string | null;
  verifiedBy: string | null;
  photos: DefectPhotoRow[];
};

export default function DefectsClient({
  projectId,
  currentRole,
  currentUserLabel,
  defects,
}: {
  projectId: string;
  currentRole: string;
  currentUserLabel: string;
  defects: DefectRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<DefectRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = defects.filter((d) =>
    `${d.number} ${d.description} ${d.location}`.toLowerCase().includes(query.toLowerCase()),
  );

  const canRaise = currentRole === "SUPERINTENDENT" || currentRole === "CLIENT";

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Defect List</h2>
          <p>Publish defects and instruct remediation works.</p>
        </div>
        {canRaise && (
          <button className="btn" onClick={() => setCreateOpen(true)}>
            + Raise Defect
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search defects..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No defects yet</h3>
          <p>{canRaise ? "Raise the first defect." : "Nothing outstanding right now."}</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((d) => (
            <div
              className="row-card"
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(d);
                }
              }}
            >
              <div className="row-num mono">{d.number}</div>
              <div className="row-main">
                <div className="row-title">{d.description}</div>
                <div className="row-sub">
                  {d.location} · {d.severity} · assigned {d.assignedTo}
                </div>
              </div>
              <span className={`pill ${d.status.toLowerCase()}`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateDefectModal projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      {selected && (
        <DefectDetailModal
          projectId={projectId}
          defect={selected}
          currentUserLabel={currentUserLabel}
          canRemediate={
            (currentRole === "SUPERINTENDENT" || currentRole === "CONTRACTOR") &&
            selected.status !== "CLOSED"
          }
          canClose={
            (currentRole === "SUPERINTENDENT" || currentRole === "CLIENT") &&
            selected.status !== "CLOSED"
          }
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function CreateDefectModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const action = createDefect.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title="Raise Defect"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="defect-create-form" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Raise"}
          </button>
        </>
      }
    >
      <form id="defect-create-form" action={formAction}>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" name="location" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="severity">Severity</label>
            <select id="severity" name="severity" defaultValue="MINOR">
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="assignedTo">Assigned To</label>
            <input id="assignedTo" name="assignedTo" type="text" placeholder="Subcontractor / trade" required />
          </div>
          <div className="field">
            <label htmlFor="dueDate">Due Date</label>
            <input id="dueDate" name="dueDate" type="date" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="photo">Photo</label>
          <input id="photo" name="photo" type="file" accept="image/*" />
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </Modal>
  );
}

function DefectDetailModal({
  projectId,
  defect,
  currentUserLabel,
  canRemediate,
  canClose,
  onClose,
}: {
  projectId: string;
  defect: DefectRow;
  currentUserLabel: string;
  canRemediate: boolean;
  canClose: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "remediate" | "close">("view");

  const remediateAction = updateRemediation.bind(null, projectId, defect.id);
  const [remState, remFormAction, remPending] = useActionState(remediateAction, initialActionState);
  const closeAction = closeDefect.bind(null, projectId, defect.id);
  const [closeState, closeFormAction, closePending] = useActionState(closeAction, initialActionState);

  useEffect(() => {
    if (remState.ok || closeState.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remState, closeState]);

  return (
    <Modal
      onClose={onClose}
      title={`${defect.number} — ${defect.location}`}
      wide
      footer={
        mode === "remediate" ? (
          <>
            <button type="button" className="btn ghost" onClick={() => setMode("view")}>
              Back
            </button>
            <button type="submit" form="defect-remediate-form" className="btn" disabled={remPending}>
              {remPending ? "Saving…" : "Save"}
            </button>
          </>
        ) : mode === "close" ? (
          <>
            <button type="button" className="btn ghost" onClick={() => setMode("view")}>
              Back
            </button>
            <button type="submit" form="defect-close-form" className="btn green" disabled={closePending}>
              {closePending ? "Saving…" : "Confirm Close"}
            </button>
          </>
        ) : (
          <>
            {canRemediate && (
              <button type="button" className="btn amber" onClick={() => setMode("remediate")}>
                Log Remediation
              </button>
            )}
            {canClose && (
              <button type="button" className="btn green" onClick={() => setMode("close")}>
                Close Defect
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onClose}>
              Close
            </button>
          </>
        )
      }
    >
      {mode === "view" && (
        <>
          <div className="detail-grid">
            <div>
              <div className="dt">Severity</div>
              <div className="dd">{defect.severity}</div>
            </div>
            <div>
              <div className="dt">Status</div>
              <div className="dd">
                <span className={`pill ${defect.status.toLowerCase()}`}>{defect.status}</span>
              </div>
            </div>
            <div>
              <div className="dt">Raised By</div>
              <div className="dd">{defect.raisedByLabel}</div>
            </div>
            <div>
              <div className="dt">Assigned To</div>
              <div className="dd">{defect.assignedTo}</div>
            </div>
            <div>
              <div className="dt">Due Date</div>
              <div className="dd">{defect.dueDate ? new Date(defect.dueDate).toLocaleDateString() : "—"}</div>
            </div>
            {defect.status === "CLOSED" && (
              <div>
                <div className="dt">Verified By</div>
                <div className="dd">{defect.verifiedBy}</div>
              </div>
            )}
            <div className="detail-full">
              <div className="dt">Description</div>
              <div className="dd">{defect.description}</div>
            </div>
            {defect.remediation && (
              <div className="detail-full">
                <div className="dt">Remediation</div>
                <div className="dd">{defect.remediation}</div>
              </div>
            )}
          </div>
          {defect.photos.length > 0 && (
            <div className="thumb-row">
              {defect.photos.map((p) => (
                <a key={p.id} href={p.imageUrl} target="_blank" rel="noopener noreferrer">
                  <img src={p.imageUrl} alt="Defect photo" className="thumb" />
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {mode === "remediate" && (
        <form id="defect-remediate-form" action={remFormAction}>
          <div className="field">
            <label htmlFor="remediation">Remediation Notes</label>
            <textarea id="remediation" name="remediation" rows={4} required />
          </div>
          <div className="field">
            <label htmlFor="rphoto">Progress Photo</label>
            <input id="rphoto" name="photo" type="file" accept="image/*" />
          </div>
          {remState.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{remState.error}</p>}
        </form>
      )}

      {mode === "close" && (
        <form id="defect-close-form" action={closeFormAction}>
          <div className="field">
            <label htmlFor="verifiedBy">Verified By</label>
            <input id="verifiedBy" name="verifiedBy" type="text" defaultValue={currentUserLabel} required />
          </div>
          {closeState.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{closeState.error}</p>}
        </form>
      )}
    </Modal>
  );
}
