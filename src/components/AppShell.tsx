"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import SpiireLogo from "@/components/SpiireLogo";

const MODULES = [
  { key: "dashboard", label: "Dashboard", num: "00" },
  { key: "documents", label: "Documents", num: "01" },
  { key: "drawings", label: "Drawings", num: "02" },
  { key: "rfis", label: "RFIs", num: "03" },
  { key: "submittals", label: "Submittals", num: "04" },
  { key: "defects", label: "Defect List", num: "05" },
  { key: "correspondence", label: "Correspondence", num: "06" },
  { key: "team", label: "Team", num: "07" },
];

export default function AppShell({
  projectId,
  projectName,
  projectNumber,
  userLabel,
  role,
  onSignOut,
  children,
}: {
  projectId: string;
  projectName: string;
  projectNumber: string;
  userLabel: string;
  role: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const current =
    MODULES.find((m) => pathname.startsWith(`${base}/${m.key}`))?.key ??
    "dashboard";

  return (
    <div id="app">
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-strip">
          <Link href="/projects" aria-label="All projects">
            <SpiireLogo />
          </Link>
        </div>
        <div className="titleblock">
          <Link href="/projects" className="back-link">
            ← All Projects
          </Link>
          <div className="proj-label">Project</div>
          <h1>{projectName}</h1>
          <div className="proj-num mono">{projectNumber}</div>
        </div>
        <nav className="sidenav">
          {MODULES.map((m) => (
            <Link
              key={m.key}
              href={m.key === "dashboard" ? base : `${base}/${m.key}`}
              className={m.key === current ? "active" : ""}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="num">{m.num}</span> {m.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">SITE CONTROL · Document Control System</div>
      </div>

      <div className="main">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="menu-btn"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <div className="breadcrumb">
              {projectNumber} / <b>{MODULES.find((m) => m.key === current)?.label}</b>
            </div>
          </div>
          <div className="topbar-right">
            <div className="user-chip">
              <b>{userLabel}</b>
              <span className="role-pill">{role}</span>
            </div>
            <form action={onSignOut}>
              <button type="submit" className="btn ghost sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
