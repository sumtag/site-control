"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";
import type { SubmittalStatus } from "@/generated/prisma/client";

const submittalSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  type: z.string().trim().min(1, "Type is required"),
  description: z.string().trim().optional(),
  submittedBy: z.string().trim().min(1, "Submitted by is required"),
  dateSubmitted: z.string().min(1, "Date submitted is required"),
  reviewerRole: z.string().trim().min(1, "Reviewer is required"),
  requiredBy: z.string().optional(),
});

export async function createSubmittal(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);

  const parsed = submittalSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    description: formData.get("description") || undefined,
    submittedBy: formData.get("submittedBy"),
    dateSubmitted: formData.get("dateSubmitted"),
    reviewerRole: formData.get("reviewerRole"),
    requiredBy: formData.get("requiredBy") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, projectId, "submittals");
    await tx.submittal.create({
      data: {
        projectId,
        number,
        title: parsed.data.title,
        type: parsed.data.type,
        description: parsed.data.description,
        submittedBy: parsed.data.submittedBy,
        dateSubmitted: new Date(parsed.data.dateSubmitted),
        reviewerRole: parsed.data.reviewerRole,
        requiredBy: parsed.data.requiredBy ? new Date(parsed.data.requiredBy) : undefined,
        createdById: membership.userId,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "submittals",
      refNumber: number,
      title: parsed.data.title,
      action: "lodged",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/submittals`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function reviewSubmittal(
  projectId: string,
  submittalId: string,
  status: SubmittalStatus,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT", "CLIENT"]);

  const submittal = await prisma.submittal.findFirst({
    where: { id: submittalId, projectId },
  });
  if (!submittal) return { ok: false, error: "Submittal not found." };

  const comments = String(formData.get("comments") ?? "").trim() || undefined;

  await prisma.$transaction(async (tx) => {
    await tx.submittal.update({
      where: { id: submittalId },
      data: {
        status,
        comments,
        reviewDate: new Date(),
        reviewedById: membership.userId,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "submittals",
      refNumber: submittal.number,
      title: submittal.title,
      action: status.toLowerCase(),
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/submittals`);
  return { ok: true };
}
