"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { saveUploadedFile, isNonEmptyFile } from "@/lib/storage";
import type { ActionState } from "@/lib/action-state";

const rfiSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  question: z.string().trim().min(1, "Question is required"),
  discipline: z.string().trim().min(1, "Discipline is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: z.string().optional(),
});

export async function createRfi(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);

  const parsed = rfiSchema.safeParse({
    subject: formData.get("subject"),
    question: formData.get("question"),
    discipline: formData.get("discipline"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const file = formData.get("file");
  let attachment: { fileUrl: string; fileName: string } | undefined;
  if (isNonEmptyFile(file)) {
    const saved = await saveUploadedFile(file);
    attachment = { fileUrl: saved.url, fileName: saved.name };
  }

  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, projectId, "rfis");
    const rfi = await tx.rfi.create({
      data: {
        projectId,
        number,
        subject: parsed.data.subject,
        question: parsed.data.question,
        discipline: parsed.data.discipline,
        priority: parsed.data.priority,
        raisedById: membership.userId,
        raisedDate: new Date(),
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
    });
    if (attachment) {
      await tx.rfiAttachment.create({
        data: {
          rfiId: rfi.id,
          name: attachment.fileName,
          fileUrl: attachment.fileUrl,
          uploadedById: membership.userId,
        },
      });
    }
    await logActivity(tx, {
      projectId,
      type: "rfis",
      refNumber: number,
      title: parsed.data.subject,
      action: "raised",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/rfis`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function respondToRfi(
  projectId: string,
  rfiId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT", "CLIENT"]);

  const response = String(formData.get("response") ?? "").trim();
  if (!response) return { ok: false, error: "Response is required." };

  const rfi = await prisma.rfi.findFirst({ where: { id: rfiId, projectId } });
  if (!rfi) return { ok: false, error: "RFI not found." };

  const file = formData.get("file");
  let attachment: { fileUrl: string; fileName: string } | undefined;
  if (isNonEmptyFile(file)) {
    const saved = await saveUploadedFile(file);
    attachment = { fileUrl: saved.url, fileName: saved.name };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rfi.update({
      where: { id: rfiId },
      data: {
        response,
        respondedById: membership.userId,
        respondedDate: new Date(),
      },
    });
    if (attachment) {
      await tx.rfiAttachment.create({
        data: {
          rfiId,
          name: attachment.fileName,
          fileUrl: attachment.fileUrl,
          uploadedById: membership.userId,
        },
      });
    }
    await logActivity(tx, {
      projectId,
      type: "rfis",
      refNumber: rfi.number,
      title: rfi.subject,
      action: "responded",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/rfis`);
  return { ok: true };
}

export async function closeRfi(projectId: string, rfiId: string): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const rfi = await prisma.rfi.findFirst({ where: { id: rfiId, projectId } });
  if (!rfi) return { ok: false, error: "RFI not found." };

  await prisma.$transaction(async (tx) => {
    await tx.rfi.update({ where: { id: rfiId }, data: { closed: true } });
    await logActivity(tx, {
      projectId,
      type: "rfis",
      refNumber: rfi.number,
      title: rfi.subject,
      action: "closed",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/rfis`);
  return { ok: true };
}
