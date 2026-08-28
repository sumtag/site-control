"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { saveUploadedFile, isNonEmptyFile } from "@/lib/storage";
import type { ActionState } from "@/lib/action-state";

const drawingSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  discipline: z.string().trim().min(1, "Discipline is required"),
  rev: z.string().trim().min(1, "Revision is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().min(1, "Description is required"),
});

function fileKind(file: File): "image" | "pdf" {
  return file.type === "application/pdf" ? "pdf" : "image";
}

export async function createDrawing(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const parsed = drawingSchema.safeParse({
    title: formData.get("title"),
    discipline: formData.get("discipline"),
    rev: formData.get("rev"),
    date: formData.get("date"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const file = formData.get("file");
  if (!isNonEmptyFile(file)) return { ok: false, error: "A drawing file is required." };
  const saved = await saveUploadedFile(file);
  const kind = fileKind(file);

  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, projectId, "drawings");
    const drawing = await tx.drawing.create({
      data: {
        projectId,
        number,
        title: parsed.data.title,
        discipline: parsed.data.discipline,
      },
    });
    await tx.drawingRevision.create({
      data: {
        drawingId: drawing.id,
        rev: parsed.data.rev,
        date: new Date(parsed.data.date),
        description: parsed.data.description,
        status: "CURRENT",
        sourceFileUrl: saved.url,
        sourceFileType: kind,
        renderedImageUrl: kind === "image" ? saved.url : null,
        createdById: membership.userId,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "drawings",
      refNumber: number,
      title: parsed.data.title,
      action: "registered",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/drawings`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

const revisionSchema = z.object({
  rev: z.string().trim().min(1, "Revision is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().min(1, "Description is required"),
});

export async function addRevision(
  projectId: string,
  drawingId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const drawing = await prisma.drawing.findFirst({ where: { id: drawingId, projectId } });
  if (!drawing) return { ok: false, error: "Drawing not found." };

  const parsed = revisionSchema.safeParse({
    rev: formData.get("rev"),
    date: formData.get("date"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const file = formData.get("file");
  if (!isNonEmptyFile(file)) return { ok: false, error: "A drawing file is required." };
  const saved = await saveUploadedFile(file);
  const kind = fileKind(file);

  const existing = await prisma.drawingRevision.findUnique({
    where: { drawingId_rev: { drawingId, rev: parsed.data.rev } },
  });
  if (existing) return { ok: false, error: `Revision ${parsed.data.rev} already exists.` };

  await prisma.$transaction(async (tx) => {
    await tx.drawingRevision.updateMany({
      where: { drawingId, status: "CURRENT" },
      data: { status: "SUPERSEDED" },
    });
    await tx.drawingRevision.create({
      data: {
        drawingId,
        rev: parsed.data.rev,
        date: new Date(parsed.data.date),
        description: parsed.data.description,
        status: "CURRENT",
        sourceFileUrl: saved.url,
        sourceFileType: kind,
        renderedImageUrl: kind === "image" ? saved.url : null,
        createdById: membership.userId,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "drawings",
      refNumber: drawing.number,
      title: `${drawing.title} rev ${parsed.data.rev}`,
      action: "revision published",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/drawings`);
  return { ok: true };
}

export async function addMarkup(
  projectId: string,
  drawingRevisionId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);

  const revision = await prisma.drawingRevision.findFirst({
    where: { id: drawingRevisionId, drawing: { projectId } },
    include: { drawing: true },
  });
  if (!revision) return { ok: false, error: "Revision not found." };

  const file = formData.get("file");
  if (!isNonEmptyFile(file)) return { ok: false, error: "A markup image is required." };
  const saved = await saveUploadedFile(file);

  await prisma.$transaction(async (tx) => {
    await tx.markup.create({
      data: { drawingRevisionId, imageUrl: saved.url, createdById: membership.userId },
    });
    await logActivity(tx, {
      projectId,
      type: "drawings",
      refNumber: revision.drawing.number,
      title: `${revision.drawing.title} rev ${revision.rev}`,
      action: "markup added",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/drawings`);
  return { ok: true };
}

export async function sendTransmittal(
  projectId: string,
  drawingId: string,
  drawingRevisionId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const revision = await prisma.drawingRevision.findFirst({
    where: { id: drawingRevisionId, drawingId, drawing: { projectId } },
    include: { drawing: true },
  });
  if (!revision) return { ok: false, error: "Revision not found." };

  const memberIds = formData.getAll("memberIds").map(String);
  const extraEmailsRaw = String(formData.get("extraEmails") ?? "");
  const extraEmails = extraEmailsRaw
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const message = String(formData.get("message") ?? "").trim() || undefined;

  if (memberIds.length === 0 && extraEmails.length === 0) {
    return { ok: false, error: "Select at least one recipient." };
  }

  const members = memberIds.length
    ? await prisma.projectMember.findMany({
        where: { projectId, userId: { in: memberIds } },
        include: { user: { select: { name: true, email: true } } },
      })
    : [];

  await prisma.$transaction(async (tx) => {
    const transmittal = await tx.transmittal.create({
      data: {
        projectId,
        drawingId,
        drawingRevisionId,
        sentById: membership.userId,
        message,
      },
    });
    for (const m of members) {
      if (!m.user.email) continue;
      await tx.transmittalRecipient.create({
        data: {
          transmittalId: transmittal.id,
          userId: m.userId,
          emailAddress: m.user.email,
          name: m.user.name,
        },
      });
    }
    for (const email of extraEmails) {
      await tx.transmittalRecipient.create({
        data: { transmittalId: transmittal.id, emailAddress: email },
      });
    }
    await logActivity(tx, {
      projectId,
      type: "transmittals",
      refNumber: revision.drawing.number,
      title: `${revision.drawing.title} rev ${revision.rev}`,
      action: "transmitted",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/drawings`);
  return { ok: true };
}
