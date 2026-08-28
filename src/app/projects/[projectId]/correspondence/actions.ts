"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";
import type { CorrespondenceStatus } from "@/generated/prisma/client";

const correspondenceSchema = z.object({
  type: z.string().trim().min(1, "Type is required"),
  subject: z.string().trim().min(1, "Subject is required"),
  fromText: z.string().trim().min(1, "From is required"),
  toText: z.string().trim().min(1, "To is required"),
  date: z.string().min(1, "Date is required"),
  body: z.string().trim().min(1, "Body is required"),
});

function readForm(formData: FormData) {
  return correspondenceSchema.safeParse({
    type: formData.get("type"),
    subject: formData.get("subject"),
    fromText: formData.get("fromText"),
    toText: formData.get("toText"),
    date: formData.get("date"),
    body: formData.get("body"),
  });
}

export async function createCorrespondence(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);

  const parsed = readForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, projectId, "correspondence");
    await tx.correspondence.create({
      data: {
        projectId,
        number,
        type: parsed.data.type,
        subject: parsed.data.subject,
        fromText: parsed.data.fromText,
        toText: parsed.data.toText,
        date: new Date(parsed.data.date),
        body: parsed.data.body,
        createdById: membership.userId,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "correspondence",
      refNumber: number,
      title: parsed.data.subject,
      action: "issued",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/correspondence`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateCorrespondence(
  projectId: string,
  correspondenceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  const item = await prisma.correspondence.findFirst({
    where: { id: correspondenceId, projectId },
  });
  if (!item) return { ok: false, error: "Correspondence entry not found." };
  if (membership.role !== "SUPERINTENDENT" && item.createdById !== membership.userId) {
    return {
      ok: false,
      error: "Only the Superintendent or the original author can edit this entry.",
    };
  }

  const parsed = readForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.$transaction(async (tx) => {
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: {
        type: parsed.data.type,
        subject: parsed.data.subject,
        fromText: parsed.data.fromText,
        toText: parsed.data.toText,
        date: new Date(parsed.data.date),
        body: parsed.data.body,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "correspondence",
      refNumber: item.number,
      title: parsed.data.subject,
      action: "updated",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/correspondence`);
  return { ok: true };
}

export async function setCorrespondenceStatus(
  projectId: string,
  correspondenceId: string,
  status: CorrespondenceStatus,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const item = await prisma.correspondence.findFirst({
    where: { id: correspondenceId, projectId },
  });
  if (!item) return { ok: false, error: "Correspondence entry not found." };

  await prisma.$transaction(async (tx) => {
    await tx.correspondence.update({ where: { id: correspondenceId }, data: { status } });
    await logActivity(tx, {
      projectId,
      type: "correspondence",
      refNumber: item.number,
      title: item.subject,
      action: status.toLowerCase(),
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/correspondence`);
  return { ok: true };
}
