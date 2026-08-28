"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import {
  createCorrespondence,
  setCorrespondenceStatus,
  updateCorrespondence,
} from "./actions";

const TYPES = ["Instruction", "Notice", "Design Change", "General"];

export type CorrespondenceRow = {
  id: string;
  number: string;
  type: string;
  subject: string;
  fromText: string;
  toText: string;
  date: string;
  body: string;
  status: "ISSUED" | "ACTIONED" | "CLOSED";
  createdById: string;
  createdByLabel: string;
};

export default function CorrespondenceClient({
  projectId,
  currentUserId,
  currentRole,
  items,
}: {
  projectId: string;
  currentUserId: string;
  currentRole: string;
  items: CorrespondenceRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<CorrespondenceRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = items.filter((c) =>
    `${c.number} ${c.subject} ${c.type}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Correspondence</h2>
          <p>Instructions, design changes and formal notices.</p>
        </div>
        <button className="btn" onClick={() => setCreateOpen(true)}>
          + New Correspondence
        </button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search correspondence..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No correspondence yet</h3>
          <p>Issue the first entry to start the log.</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((c) => (
            <div
              className="row-card"
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(c);
                }
              }}
            >
              <div className="row-num mono">{c.number}</div>
              <div className="row-main">
                <div className="row-title">{c.subject}</div>
                <div className="row-sub">
                  {c.type} · {c.fromText} → {c.toText}
                </div>
              </div>
              <span className={`pill ${c.status.toLowerCase()}`}>{c.status}</span>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CorrespondenceForm
          mode="create"
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {selected && (
        <CorrespondenceForm
          mode={
            currentRole === "SUPERINTENDENT" || selected.createdById === currentUserId
              ? "edit"
              : "view"
          }
          projectId={projectId}
          item={selected}
          canTransition={currentRole === "SUPERINTENDENT"}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function CorrespondenceForm({
  mode,
  projectId,
  item,
  canTransition,
  onClose,
}: {
  mode: "create" | "edit" | "view";
  projectId: string;
  item?: CorrespondenceRow;
  canTransition?: boolean;
  onClose: () => void;
}) {
  const action =
    mode === "edit" && item
      ? updateCorrespondence.bind(null, projectId, item.id)
      : createCorrespondence.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [isPendingStatus, startTransition] = useTransition();

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const readOnly = mode === "view";
  const title = mode === "create" ? "New Correspondence" : item ? `${item.number} — ${item.subject}` : "Correspondence";

  return (
    <Modal
      onClose={onClose}
      title={title}
      footer={
        <>
          {canTransition && item?.status === "ISSUED" && (
            <button
              type="button"
              className="btn amber"
              disabled={isPendingStatus}
              onClick={() =>
                startTransition(async () => {
                  await setCorrespondenceStatus(projectId, item.id, "ACTIONED");
                  onClose();
                })
              }
            >
              Mark Actioned
            </button>
          )}
          {canTransition && item && item.status !== "CLOSED" && (
            <button
              type="button"
              className="btn green"
              disabled={isPendingStatus}
              onClick={() =>
                startTransition(async () => {
                  await setCorrespondenceStatus(projectId, item.id, "CLOSED");
                  onClose();
                })
              }
            >
              Mark Closed
            </button>
          )}
          {readOnly ? (
            <button type="button" className="btn secondary" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" form="correspondence-form" className="btn" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </>
      }
    >
      {readOnly && item ? (
        <div className="detail-grid">
          <div>
            <div className="dt">Type</div>
            <div className="dd">{item.type}</div>
          </div>
          <div>
            <div className="dt">Status</div>
            <div className="dd">
              <span className={`pill ${item.status.toLowerCase()}`}>{item.status}</span>
            </div>
          </div>
          <div>
            <div className="dt">From</div>
            <div className="dd">{item.fromText}</div>
          </div>
          <div>
            <div className="dt">To</div>
            <div className="dd">{item.toText}</div>
          </div>
          <div>
            <div className="dt">Date</div>
            <div className="dd">{new Date(item.date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="dt">Raised by</div>
            <div className="dd">{item.createdByLabel}</div>
          </div>
          <div className="detail-full">
            <div className="dt">Body</div>
            <div className="dd">{item.body}</div>
          </div>
        </div>
      ) : (
        <form id="correspondence-form" action={formAction}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" name="type" defaultValue={item?.type ?? TYPES[0]}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={item?.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input id="subject" name="subject" type="text" defaultValue={item?.subject} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="fromText">From</label>
              <input id="fromText" name="fromText" type="text" defaultValue={item?.fromText} required />
            </div>
            <div className="field">
              <label htmlFor="toText">To</label>
              <input id="toText" name="toText" type="text" defaultValue={item?.toText} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="body">Body</label>
            <textarea id="body" name="body" rows={5} defaultValue={item?.body} required />
          </div>
          {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
        </form>
      )}
    </Modal>
  );
}
