"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { saveUploadedFile, isNonEmptyFile } from "@/lib/storage";
import type { ActionState } from "@/lib/action-state";
import type { Prisma, TransmittalReason } from "@/generated/prisma/client";

const batchSharedSchema = z.object({
  discipline: z.string().trim().min(1, "Discipline is required"),
  rev: z.string().trim().min(1, "Revision is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().min(1, "Description is required"),
});

function fileKind(file: File): "image" | "pdf" {
  return file.type === "application/pdf" ? "pdf" : "image";
}

// Registers one or more drawings in a single submit — every file in the
// picker gets its own number/sheet name but shares discipline, revision,
// date and description, matching how a batch is normally issued together
// (e.g. all Rev A, all for tender, same day).
export async function createDrawings(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const parsedShared = batchSharedSchema.safeParse({
    discipline: formData.get("discipline"),
    rev: formData.get("rev"),
    date: formData.get("date"),
    description: formData.get("description"),
  });
  if (!parsedShared.success) return { ok: false, error: parsedShared.error.issues[0].message };

  const files = formData.getAll("files").filter(isNonEmptyFile);
  if (files.length === 0) return { ok: false, error: "At least one drawing file is required." };

  const entries: { number: string; title: string; file: File }[] = [];
  const seenNumbers = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    const number = String(formData.get(`number-${i}`) ?? "").trim();
    const title = String(formData.get(`title-${i}`) ?? "").trim();
    if (!number) return { ok: false, error: `Drawing number is required for ${files[i].name}.` };
    if (!title) return { ok: false, error: `Sheet name is required for ${files[i].name}.` };
    if (seenNumbers.has(number)) {
      return { ok: false, error: `Drawing number ${number} is used twice in this batch.` };
    }
    seenNumbers.add(number);
    entries.push({ number, title, file: files[i] });
  }

  const existing = await prisma.drawing.findMany({
    where: { projectId, number: { in: [...seenNumbers] } },
    select: { number: true },
  });
  if (existing.length > 0) {
    return {
      ok: false,
      error: `Already registered: ${existing.map((e) => e.number).join(", ")}.`,
    };
  }

  const saved = await Promise.all(
    entries.map(async (e) => ({ ...e, saved: await saveUploadedFile(e.file) })),
  );

  await prisma.$transaction(async (tx) => {
    for (const e of saved) {
      const kind = fileKind(e.file);
      const drawing = await tx.drawing.create({
        data: {
          projectId,
          number: e.number,
          title: e.title,
          discipline: parsedShared.data.discipline,
        },
      });
      await tx.drawingRevision.create({
        data: {
          drawingId: drawing.id,
          rev: parsedShared.data.rev,
          date: new Date(parsedShared.data.date),
          description: parsedShared.data.description,
          status: "CURRENT",
          sourceFileUrl: e.saved.url,
          sourceFileType: kind,
          renderedImageUrl: kind === "image" ? e.saved.url : null,
          createdById: membership.userId,
        },
      });
      await logActivity(tx, {
        projectId,
        type: "drawings",
        refNumber: e.number,
        title: e.title,
        action: "registered",
        actedById: membership.userId,
      });
    }
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

function parseTransmittalInput(formData: FormData) {
  const memberIds = formData.getAll("memberIds").map(String);
  const extraEmailsRaw = String(formData.get("extraEmails") ?? "");
  const extraEmails = extraEmailsRaw
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const message = String(formData.get("message") ?? "").trim() || undefined;
  const reason = String(formData.get("reason") ?? "") as TransmittalReason;

  if (memberIds.length === 0 && extraEmails.length === 0) {
    return { error: "Select at least one recipient." } as const;
  }
  if (!["FOR_TENDER", "FOR_CONSTRUCTION", "FOR_INFORMATION", "FOR_APPROVAL"].includes(reason)) {
    return { error: "Select a valid reason for transmittal." } as const;
  }

  return { memberIds, extraEmails, message, reason } as const;
}

async function createTransmittalRecipients(
  tx: Prisma.TransactionClient,
  transmittalId: string,
  projectId: string,
  memberIds: string[],
  extraEmails: string[],
) {
  const members = memberIds.length
    ? await tx.projectMember.findMany({
        where: { projectId, userId: { in: memberIds } },
        include: { user: { select: { name: true, email: true } } },
      })
    : [];
  for (const m of members) {
    if (!m.user.email) continue;
    await tx.transmittalRecipient.create({
      data: {
        transmittalId,
        userId: m.userId,
        emailAddress: m.user.email,
        name: m.user.name,
      },
    });
  }
  for (const email of extraEmails) {
    await tx.transmittalRecipient.create({ data: { transmittalId, emailAddress: email } });
  }
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

  const parsed = parseTransmittalInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  await prisma.$transaction(async (tx) => {
    const transmittal = await tx.transmittal.create({
      data: {
        projectId,
        drawingId,
        drawingRevisionId,
        sentById: membership.userId,
        reason: parsed.reason,
        message: parsed.message,
      },
    });
    await createTransmittalRecipients(tx, transmittal.id, projectId, parsed.memberIds, parsed.extraEmails);
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

// Sends one transmittal per selected drawing (each drawing's own permanent
// record, in its own transmittal history) sharing the same reason,
// recipients and message — a single "notify everyone about this batch"
// action rather than a genuinely combined multi-drawing record.
export async function sendBatchTransmittal(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const drawingIds = formData.getAll("drawingIds").map(String);
  if (drawingIds.length === 0) return { ok: false, error: "Select at least one drawing." };

  const drawings = await prisma.drawing.findMany({
    where: { id: { in: drawingIds }, projectId },
    include: { revisions: { where: { status: "CURRENT" }, take: 1 } },
  });
  if (drawings.length !== drawingIds.length) {
    return { ok: false, error: "One or more selected drawings could not be found." };
  }

  const parsed = parseTransmittalInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  await prisma.$transaction(async (tx) => {
    for (const drawing of drawings) {
      const revision = drawing.revisions[0];
      if (!revision) continue;
      const transmittal = await tx.transmittal.create({
        data: {
          projectId,
          drawingId: drawing.id,
          drawingRevisionId: revision.id,
          sentById: membership.userId,
          reason: parsed.reason,
          message: parsed.message,
        },
      });
      await createTransmittalRecipients(
        tx,
        transmittal.id,
        projectId,
        parsed.memberIds,
        parsed.extraEmails,
      );
      await logActivity(tx, {
        projectId,
        type: "transmittals",
        refNumber: drawing.number,
        title: `${drawing.title} rev ${revision.rev}`,
        action: "transmitted",
        actedById: membership.userId,
      });
    }
  });

  revalidatePath(`/projects/${projectId}/drawings`);
  return { ok: true };
}
