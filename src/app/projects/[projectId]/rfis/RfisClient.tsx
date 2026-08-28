"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import { closeRfi, createRfi, respondToRfi } from "./actions";

const DISCIPLINES = ["Architectural", "Structural", "Civil", "Mechanical", "Electrical", "Hydraulic", "Other"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type RfiAttachmentRow = { id: string; name: string; fileUrl: string };

export type RfiRow = {
  id: string;
  number: string;
  subject: string;
  question: string;
  discipline: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  raisedByLabel: string;
  raisedDate: string;
  dueDate: string | null;
  response: string | null;
  respondedByLabel: string | null;
  respondedDate: string | null;
  closed: boolean;
  attachments: RfiAttachmentRow[];
};

function rfiStatus(r: RfiRow): "OPEN" | "OVERDUE" | "ANSWERED" | "CLOSED" {
  if (r.closed) return "CLOSED";
  if (r.response) return "ANSWERED";
  if (r.dueDate && new Date(r.dueDate) < new Date()) return "OVERDUE";
  return "OPEN";
}

export default function RfisClient({
  projectId,
  currentRole,
  rfis,
}: {
  projectId: string;
  currentRole: string;
  rfis: RfiRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<RfiRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = rfis.filter((r) =>
    `${r.number} ${r.subject} ${r.discipline}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="module-head">
        <div>
          <h2>RFIs</h2>
          <p>Requests for Information — log, respond, attach markups.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={`/projects/${projectId}/rfis/register`} className="btn secondary">
            Download Register
          </a>
          <button className="btn" onClick={() => setCreateOpen(true)}>
            + Raise RFI
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search RFIs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No RFIs yet</h3>
          <p>Raise the first request for information.</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((r) => {
            const status = rfiStatus(r);
            return (
              <div
                className="row-card"
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(r);
                  }
                }}
              >
                <div className="row-num mono">{r.number}</div>
                <div className="row-main">
                  <div className="row-title">{r.subject}</div>
                  <div className="row-sub">
                    {r.discipline} · {r.priority} · {r.raisedByLabel}
                  </div>
                </div>
                <span className={`pill ${status.toLowerCase()}`}>{status}</span>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && <CreateRfiModal projectId={projectId} onClose={() => setCreateOpen(false)} />}

      {selected && (
        <RfiDetailModal
          projectId={projectId}
          rfi={selected}
          canRespond={
            (currentRole === "SUPERINTENDENT" || currentRole === "CLIENT") && !selected.response
          }
          canClose={currentRole === "SUPERINTENDENT" && !!selected.response && !selected.closed}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function CreateRfiModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const action = createRfi.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title="Raise RFI"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="rfi-create-form" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Raise"}
          </button>
        </>
      }
    >
      <form id="rfi-create-form" action={formAction}>
        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" type="text" required />
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
            <label htmlFor="priority">Priority</label>
            <select id="priority" name="priority" defaultValue="MEDIUM">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="question">Question</label>
          <textarea id="question" name="question" rows={4} required />
        </div>
        <div className="field">
          <label htmlFor="dueDate">Due Date</label>
          <input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="file">Attachment</label>
          <input id="file" name="file" type="file" accept="image/*,.pdf" />
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </Modal>
  );
}

function RfiDetailModal({
  projectId,
  rfi,
  canRespond,
  canClose,
  onClose,
}: {
  projectId: string;
  rfi: RfiRow;
  canRespond: boolean;
  canClose: boolean;
  onClose: () => void;
}) {
  const respondAction = respondToRfi.bind(null, projectId, rfi.id);
  const [state, formAction, pending] = useActionState(respondAction, initialActionState);
  const [isPendingClose, startTransition] = useTransition();
  const status = rfiStatus(rfi);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title={`${rfi.number} — ${rfi.subject}`}
      wide
      footer={
        <>
          {canClose && (
            <button
              type="button"
              className="btn green"
              disabled={isPendingClose}
              onClick={() =>
                startTransition(async () => {
                  await closeRfi(projectId, rfi.id);
                  onClose();
                })
              }
            >
              Close RFI
            </button>
          )}
          {canRespond && (
            <button type="submit" form="rfi-respond-form" className="btn" disabled={pending}>
              {pending ? "Saving…" : "Submit Response"}
            </button>
          )}
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="detail-grid">
        <div>
          <div className="dt">Discipline</div>
          <div className="dd">{rfi.discipline}</div>
        </div>
        <div>
          <div className="dt">Priority</div>
          <div className="dd">{rfi.priority}</div>
        </div>
        <div>
          <div className="dt">Raised By</div>
          <div className="dd">{rfi.raisedByLabel}</div>
        </div>
        <div>
          <div className="dt">Status</div>
          <div className="dd">
            <span className={`pill ${status.toLowerCase()}`}>{status}</span>
          </div>
        </div>
        <div className="detail-full">
          <div className="dt">Question</div>
          <div className="dd">{rfi.question}</div>
        </div>
      </div>

      {rfi.attachments.length > 0 && (
        <>
          <div className="divider" />
          <div className="dt" style={{ marginBottom: 6 }}>
            Attachments
          </div>
          <div className="attach-list">
            {rfi.attachments.map((a) => (
              <div className="attach-row" key={a.id}>
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer">
                  {a.name}
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      {rfi.response ? (
        <>
          <div className="divider" />
          <div className="detail-grid">
            <div className="detail-full">
              <div className="dt">Response ({rfi.respondedByLabel})</div>
              <div className="dd">{rfi.response}</div>
            </div>
          </div>
        </>
      ) : canRespond ? (
        <>
          <div className="divider" />
          <form id="rfi-respond-form" action={formAction}>
            <div className="field">
              <label htmlFor="response">Response</label>
              <textarea id="response" name="response" rows={4} required />
            </div>
            <div className="field">
              <label htmlFor="rfile">Attachment</label>
              <input id="rfile" name="file" type="file" accept="image/*,.pdf" />
            </div>
            {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
          </form>
        </>
      ) : null}
    </Modal>
  );
}
