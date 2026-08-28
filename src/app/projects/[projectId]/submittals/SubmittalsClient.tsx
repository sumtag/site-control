"use client";

import { useActionState, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import { initialActionState } from "@/lib/action-state";
import { createSubmittal, reviewSubmittal } from "./actions";

const TYPES = ["Shop Drawing", "Sample", "Material Data", "Method Statement", "Other"];
const REVIEWERS = ["Superintendent", "Client", "Architect"];

export type SubmittalRow = {
  id: string;
  number: string;
  title: string;
  type: string;
  description: string | null;
  submittedBy: string;
  dateSubmitted: string;
  reviewerRole: string;
  requiredBy: string | null;
  status: "PENDING" | "APPROVED" | "RESUBMIT" | "REJECTED";
  comments: string | null;
  reviewDate: string | null;
  reviewedByLabel: string | null;
  createdByLabel: string;
};

export default function SubmittalsClient({
  projectId,
  currentRole,
  submittals,
}: {
  projectId: string;
  currentRole: string;
  submittals: SubmittalRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<SubmittalRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = submittals.filter((s) =>
    `${s.number} ${s.title} ${s.type}`.toLowerCase().includes(query.toLowerCase()),
  );

  const canReview = currentRole === "SUPERINTENDENT" || currentRole === "CLIENT";

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Submittals</h2>
          <p>Hold points and approvals lodged for Superintendent / Client sign-off.</p>
        </div>
        <button className="btn" onClick={() => setCreateOpen(true)}>
          + New Submittal
        </button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search submittals..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No submittals yet</h3>
          <p>Lodge the first submittal for review.</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((s) => (
            <div
              className="row-card"
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(s);
                }
              }}
            >
              <div className="row-num mono">{s.number}</div>
              <div className="row-main">
                <div className="row-title">{s.title}</div>
                <div className="row-sub">
                  {s.type} · {s.submittedBy} · reviewed by {s.reviewerRole}
                </div>
              </div>
              <span className={`pill ${s.status.toLowerCase()}`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateSubmittalModal projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      {selected && (
        <SubmittalDetailModal
          projectId={projectId}
          submittal={selected}
          canReview={canReview && selected.status === "PENDING"}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function CreateSubmittalModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const action = createSubmittal.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title="New Submittal"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="submittal-form" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Lodge"}
          </button>
        </>
      }
    >
      <form id="submittal-form" action={formAction}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={TYPES[0]}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="submittedBy">Submitted By</label>
            <input id="submittedBy" name="submittedBy" type="text" placeholder="Company / person" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="dateSubmitted">Date Submitted</label>
            <input
              id="dateSubmitted"
              name="dateSubmitted"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="requiredBy">Required By</label>
            <input id="requiredBy" name="requiredBy" type="date" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="reviewerRole">Reviewer</label>
          <select id="reviewerRole" name="reviewerRole" defaultValue={REVIEWERS[0]}>
            {REVIEWERS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      </form>
    </Modal>
  );
}

function SubmittalDetailModal({
  projectId,
  submittal,
  canReview,
  onClose,
}: {
  projectId: string;
  submittal: SubmittalRow;
  canReview: boolean;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<"APPROVED" | "RESUBMIT" | "REJECTED" | null>(null);
  const action = decision
    ? reviewSubmittal.bind(null, projectId, submittal.id, decision)
    : reviewSubmittal.bind(null, projectId, submittal.id, "APPROVED");
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      onClose={onClose}
      title={`${submittal.number} — ${submittal.title}`}
      wide
      footer={
        canReview && decision ? (
          <>
            <button type="button" className="btn ghost" onClick={() => setDecision(null)}>
              Back
            </button>
            <button type="submit" form="submittal-review-form" className="btn" disabled={pending}>
              {pending ? "Saving…" : `Confirm ${decision}`}
            </button>
          </>
        ) : (
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <div className="detail-grid">
        <div>
          <div className="dt">Type</div>
          <div className="dd">{submittal.type}</div>
        </div>
        <div>
          <div className="dt">Status</div>
          <div className="dd">
            <span className={`stamp ${submittal.status.toLowerCase()}`}>{submittal.status}</span>
          </div>
        </div>
        <div>
          <div className="dt">Submitted By</div>
          <div className="dd">{submittal.submittedBy}</div>
        </div>
        <div>
          <div className="dt">Reviewer</div>
          <div className="dd">{submittal.reviewerRole}</div>
        </div>
        <div>
          <div className="dt">Date Submitted</div>
          <div className="dd">{new Date(submittal.dateSubmitted).toLocaleDateString()}</div>
        </div>
        <div>
          <div className="dt">Required By</div>
          <div className="dd">
            {submittal.requiredBy ? new Date(submittal.requiredBy).toLocaleDateString() : "—"}
          </div>
        </div>
        {submittal.description && (
          <div className="detail-full">
            <div className="dt">Description</div>
            <div className="dd">{submittal.description}</div>
          </div>
        )}
        {submittal.comments && (
          <div className="detail-full">
            <div className="dt">Review Comments ({submittal.reviewedByLabel})</div>
            <div className="dd">{submittal.comments}</div>
          </div>
        )}
      </div>

      {canReview && (
        <>
          <div className="divider" />
          {decision ? (
            <form id="submittal-review-form" action={formAction}>
              <div className="field">
                <label htmlFor="comments">Comments</label>
                <textarea id="comments" name="comments" rows={3} />
              </div>
              {state.error && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
            </form>
          ) : (
            <div className="status-actions">
              <button type="button" className="btn green" onClick={() => setDecision("APPROVED")}>
                Approve
              </button>
              <button type="button" className="btn amber" onClick={() => setDecision("RESUBMIT")}>
                Resubmit
              </button>
              <button type="button" className="btn red" onClick={() => setDecision("REJECTED")}>
                Reject
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
