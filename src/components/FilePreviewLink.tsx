"use client";

import { useState } from "react";

import Modal from "@/components/Modal";

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

// Plain `target="_blank"` links leave whether a PDF opens inline or
// downloads up to the browser's own PDF-handling setting. Embedding it in
// an iframe inside our own modal renders it with the browser's PDF engine
// regardless of that setting, so "view" reliably means view.
export default function FilePreviewLink({
  url,
  label,
  className,
}: {
  url: string;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pdf = isPdfUrl(url);

  if (!pdf) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  return (
    <>
      <a
        href={url}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {label}
      </a>
      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={label}
          wide
          footer={
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn secondary sm">
              Open in New Tab
            </a>
          }
        >
          <iframe src={url} title={label} style={{ width: "100%", height: "70vh", border: "none" }} />
        </Modal>
      )}
    </>
  );
}
