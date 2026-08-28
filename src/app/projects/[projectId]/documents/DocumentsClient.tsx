"use client";

import { useActionState, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import FilePreviewLink from "@/components/FilePreviewLink";
import { initialActionState } from "@/lib/action-state";
import { isCadFile } from "@/lib/cad";
import { TRANSMITTAL_REASONS, TRANSMITTAL_REASON_LABELS } from "@/lib/transmittal";
import type { TransmittalReason } from "@/generated/prisma/client";
import { createDocument, sendDocumentTransmittal, updateDocument } from "./actions";

const CATEGORIES = [
  "Specification",
  "Contract",
  "Report",
  "Drawing Reference",
  "Other",
];

export type DocTransmittalRow = {
  id: string;
  sentAt: string;
  sentByLabel: string;
  reason: TransmittalReason;
  message: string | null;
  recipients: string[];
};

export type ProjectMemberOption = { userId: string; label: string };

export type DocRow = {
  id: string;
  number: string;
  title: string;
  category: string;
  revision: string;
  date: string;
  author: string | null;
  description: string | null;
  fileUrl: string | null;
  fileName: string | null;
  createdById: string;
  createdByLabel: string;
  transmittals: DocTransmittalRow[];
};

export default function DocumentsClient({
  projectId,
  currentUserId,
  currentRole,
  members,
  documents,
}: {
  projectId: string;
  currentUserId: string;
  currentRole: string;
  members: ProjectMemberOption[];
  documents: DocRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  // Track the selected document by id and re-derive it from the latest
  // `documents` prop on every render, rather than holding a point-in-time
  // snapshot — the CAD transmittal section stays open across a "Notify
  // Recipients" submission, so it needs to pick up the revalidated data
  // automatically instead of showing stale history until reopened.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = documents.filter((d) =>
    `${d.number} ${d.title} ${d.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected = selectedId ? (documents.find((d) => d.id === selectedId) ?? null) : null;

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Documents</h2>
          <p>Catalogue of specifications, contracts and project data.</p>
        </div>
        <button className="btn" onClick={() => setCreateOpen(true)}>
          + New Document
        </button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No documents yet</h3>
          <p>Add the first document to start the register.</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((d) => (
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
                <div className="row-title">{d.title}</div>
                <div className="row-sub">
                  {d.category} · Rev {d.revision} · {d.createdByLabel}
                </div>
              </div>
              <div className="row-meta">
                {new Date(d.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <DocumentForm
          mode="create"
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {selected && (
        <DocumentForm
          mode={
            currentRole === "SUPERINTENDENT" ||
            selected.createdById === currentUserId
              ? "edit"
              : "view"
          }
          projectId={projectId}
          doc={selected}
          isSuper={currentRole === "SUPERINTENDENT"}
          members={members}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function DocumentForm({
  mode,
  projectId,
  doc,
  isSuper,
  members,
  onClose,
}: {
  mode: "create" | "edit" | "view";
  projectId: string;
  doc?: DocRow;
  isSuper?: boolean;
  members?: ProjectMemberOption[];
  onClose: () => void;
}) {
  const action =
    mode === "edit" && doc
      ? updateDocument.bind(null, projectId, doc.id)
      : createDocument.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const readOnly = mode === "view";
  const title =
    mode === "create" ? "New Document" : doc ? `${doc.number} — ${doc.title}` : "Document";

  return (
    <Modal
      onClose={onClose}
      title={title}
      footer={
        readOnly ? (
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="document-form" className="btn" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </>
        )
      }
    >
      {readOnly && doc ? (
        <div className="detail-grid">
          <div>
            <div className="dt">Category</div>
            <div className="dd">{doc.category}</div>
          </div>
          <div>
            <div className="dt">Revision</div>
            <div className="dd">{doc.revision}</div>
          </div>
          <div>
            <div className="dt">Date</div>
            <div className="dd">{new Date(doc.date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="dt">Author</div>
            <div className="dd">{doc.author || "—"}</div>
          </div>
          <div className="detail-full">
            <div className="dt">Description</div>
            <div className="dd">{doc.description || "—"}</div>
          </div>
          {doc.fileUrl && (
            <div className="detail-full">
              <div className="dt">File</div>
              <div className="dd">
                <FilePreviewLink url={doc.fileUrl} label={doc.fileName || "Download"} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <form id="document-form" action={formAction}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              name="title"
              type="text"
              defaultValue={doc?.title}
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={doc?.category ?? CATEGORIES[0]}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="revision">Revision</label>
              <input
                id="revision"
                name="revision"
                type="text"
                defaultValue={doc?.revision ?? "A"}
                required
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={doc?.date ? doc.date.slice(0, 10) : new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="author">Author</label>
              <input id="author" name="author" type="text" defaultValue={doc?.author ?? ""} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" defaultValue={doc?.description ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="file">File {doc?.fileName ? `(current: ${doc.fileName})` : ""}</label>
            <input id="file" name="file" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.12da" />
            <div className="hint">Optional. Leave blank to keep the existing file.</div>
          </div>
          {state.error && (
            <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>
          )}
        </form>
      )}

      {doc && isCadFile(doc.fileName) && (
        <DocumentTransmittalSection
          projectId={projectId}
          doc={doc}
          isSuper={Boolean(isSuper)}
          members={members ?? []}
        />
      )}
    </Modal>
  );
}

function DocumentTransmittalSection({
  projectId,
  doc,
  isSuper,
  members,
}: {
  projectId: string;
  doc: DocRow;
  isSuper: boolean;
  members: ProjectMemberOption[];
}) {
  const [notifying, setNotifying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await sendDocumentTransmittal(projectId, doc.id, initialActionState, formData);
    setPending(false);
    // Called directly from the submit flow (not an effect), so it's safe to
    // update local UI state here once the action has actually resolved.
    if (result.ok) setNotifying(false);
    else setError(result.error);
  }

  return (
    <>
      <div className="divider" />
      <div className="dt" style={{ marginBottom: 6 }}>
        CAD File Change Notification
      </div>

      {isSuper && (
        <div className="status-actions">
          <button type="button" className="btn secondary sm" onClick={() => setNotifying((v) => !v)}>
            {notifying ? "Cancel" : "Notify Recipients"}
          </button>
        </div>
      )}

      {notifying && (
        <form action={handleSubmit} style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="doc-transmittal-reason">Reason for Transmittal</label>
            <select id="doc-transmittal-reason" name="reason" defaultValue="FOR_INFORMATION">
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
              <label
                key={m.userId}
                style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 400, textTransform: "none" }}
              >
                <input type="checkbox" name="memberIds" value={m.userId} />
                {m.label}
              </label>
            ))}
          </div>
          <div className="field">
            <label htmlFor="doc-transmittal-extraEmails">Additional Emails</label>
            <textarea id="doc-transmittal-extraEmails" name="extraEmails" rows={2} placeholder="one per line" />
          </div>
          <div className="field">
            <label htmlFor="doc-transmittal-message">Message</label>
            <textarea id="doc-transmittal-message" name="message" rows={2} />
          </div>
          {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
          <button type="submit" className="btn sm" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      )}

      {doc.transmittals.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="dt">Transmittal History</div>
          {doc.transmittals.map((t) => (
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
    </>
  );
}
