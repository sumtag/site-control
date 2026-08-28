"use client";

export default function Modal({
  onClose,
  title,
  wide,
  children,
  footer,
}: {
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className={`modal ${wide ? "wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
