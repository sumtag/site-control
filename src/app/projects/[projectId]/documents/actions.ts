"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { saveUploadedFile, isNonEmptyFile } from "@/lib/storage";
import type { ActionState } from "@/lib/action-state";
import type { TransmittalReason } from "@/generated/prisma/client";

const documentSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  category: z.string().trim().min(1, "Category is required"),
  revision: z.string().trim().min(1, "Revision is required"),
  date: z.string().min(1, "Date is required"),
  author: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

function readDocumentForm(formData: FormData) {
  return documentSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    revision: formData.get("revision"),
    date: formData.get("date"),
    author: formData.get("author") || undefined,
    description: formData.get("description") || undefined,
  });
}

export async function createDocument(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);

  const parsed = readDocumentForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  let fileUrl: string | undefined;
  let fileName: string | undefined;
  const file = formData.get("file");
  if (isNonEmptyFile(file)) {
    const saved = await saveUploadedFile(file);
    fileUrl = saved.url;
    fileName = saved.name;
  }

  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, projectId, "documents");
    await tx.document.create({
      data: {
        projectId,
        number,
        title: parsed.data.title,
        category: parsed.data.category,
        revision: parsed.data.revision,
        date: new Date(parsed.data.date),
        author: parsed.data.author,
        description: parsed.data.description,
        fileUrl,
        fileName,
        createdById: membership.userId,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "documents",
      refNumber: number,
      title: parsed.data.title,
      action: "catalogued",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateDocument(
  projectId: string,
  documentId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  const doc = await prisma.document.findFirst({
    where: { id: documentId, projectId },
  });
  if (!doc) return { ok: false, error: "Document not found." };
  if (membership.role !== "SUPERINTENDENT" && doc.createdById !== membership.userId) {
    return {
      ok: false,
      error: "Only the Superintendent or the original uploader can edit this document.",
    };
  }

  const parsed = readDocumentForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  let fileUrl = doc.fileUrl;
  let fileName = doc.fileName;
  const file = formData.get("file");
  if (isNonEmptyFile(file)) {
    const saved = await saveUploadedFile(file);
    fileUrl = saved.url;
    fileName = saved.name;
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: {
        title: parsed.data.title,
        category: parsed.data.category,
        revision: parsed.data.revision,
        date: new Date(parsed.data.date),
        author: parsed.data.author,
        description: parsed.data.description,
        fileUrl,
        fileName,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "documents",
      refNumber: doc.number,
      title: parsed.data.title,
      action: "updated",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/documents`);
  return { ok: true };
}

export async function sendDocumentTransmittal(
  projectId: string,
  documentId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const doc = await prisma.document.findFirst({ where: { id: documentId, projectId } });
  if (!doc) return { ok: false, error: "Document not found." };

  const memberIds = formData.getAll("memberIds").map(String);
  const extraEmailsRaw = String(formData.get("extraEmails") ?? "");
  const extraEmails = extraEmailsRaw
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const message = String(formData.get("message") ?? "").trim() || undefined;
  const reason = String(formData.get("reason") ?? "") as TransmittalReason;

  if (memberIds.length === 0 && extraEmails.length === 0) {
    return { ok: false, error: "Select at least one recipient." };
  }
  if (!["FOR_TENDER", "FOR_CONSTRUCTION", "FOR_INFORMATION", "FOR_APPROVAL"].includes(reason)) {
    return { ok: false, error: "Select a valid reason for transmittal." };
  }

  const members = memberIds.length
    ? await prisma.projectMember.findMany({
        where: { projectId, userId: { in: memberIds } },
        include: { user: { select: { name: true, email: true } } },
      })
    : [];

  await prisma.$transaction(async (tx) => {
    const transmittal = await tx.documentTransmittal.create({
      data: {
        projectId,
        documentId,
        sentById: membership.userId,
        reason,
        message,
      },
    });
    for (const m of members) {
      if (!m.user.email) continue;
      await tx.documentTransmittalRecipient.create({
        data: {
          documentTransmittalId: transmittal.id,
          userId: m.userId,
          emailAddress: m.user.email,
          name: m.user.name,
        },
      });
    }
    for (const email of extraEmails) {
      await tx.documentTransmittalRecipient.create({
        data: { documentTransmittalId: transmittal.id, emailAddress: email },
      });
    }
    await logActivity(tx, {
      projectId,
      type: "transmittals",
      refNumber: doc.number,
      title: doc.title,
      action: "transmitted",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/documents`);
  return { ok: true };
}
