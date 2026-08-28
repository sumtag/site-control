"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { saveUploadedFile, isNonEmptyFile } from "@/lib/storage";
import type { ActionState } from "@/lib/action-state";

const defectSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  location: z.string().trim().min(1, "Location is required"),
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]),
  assignedTo: z.string().trim().min(1, "Assigned to is required"),
  dueDate: z.string().optional(),
});

export async function createDefect(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT", "CLIENT"]);

  const parsed = defectSchema.safeParse({
    description: formData.get("description"),
    location: formData.get("location"),
    severity: formData.get("severity"),
    assignedTo: formData.get("assignedTo"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const file = formData.get("photo");
  let photoUrl: string | undefined;
  if (isNonEmptyFile(file)) {
    photoUrl = (await saveUploadedFile(file)).url;
  }

  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, projectId, "defects");
    const defect = await tx.defect.create({
      data: {
        projectId,
        number,
        description: parsed.data.description,
        location: parsed.data.location,
        severity: parsed.data.severity,
        assignedTo: parsed.data.assignedTo,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        raisedById: membership.userId,
        raisedDate: new Date(),
      },
    });
    if (photoUrl) {
      await tx.defectPhoto.create({
        data: { defectId: defect.id, imageUrl: photoUrl, uploadedById: membership.userId },
      });
    }
    await logActivity(tx, {
      projectId,
      type: "defects",
      refNumber: number,
      title: parsed.data.description.slice(0, 80),
      action: "raised",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/defects`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateRemediation(
  projectId: string,
  defectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT", "CONTRACTOR"]);

  const remediation = String(formData.get("remediation") ?? "").trim();
  if (!remediation) return { ok: false, error: "Remediation notes are required." };

  const defect = await prisma.defect.findFirst({ where: { id: defectId, projectId } });
  if (!defect) return { ok: false, error: "Defect not found." };

  const file = formData.get("photo");
  let photoUrl: string | undefined;
  if (isNonEmptyFile(file)) {
    photoUrl = (await saveUploadedFile(file)).url;
  }

  await prisma.$transaction(async (tx) => {
    await tx.defect.update({
      where: { id: defectId },
      data: { remediation, status: "PROGRESS" },
    });
    if (photoUrl) {
      await tx.defectPhoto.create({
        data: { defectId, imageUrl: photoUrl, uploadedById: membership.userId },
      });
    }
    await logActivity(tx, {
      projectId,
      type: "defects",
      refNumber: defect.number,
      title: defect.description.slice(0, 80),
      action: "remediation logged",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/defects`);
  return { ok: true };
}

export async function closeDefect(
  projectId: string,
  defectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT", "CLIENT"]);

  const verifiedBy = String(formData.get("verifiedBy") ?? "").trim();
  if (!verifiedBy) return { ok: false, error: "Verified by is required." };

  const defect = await prisma.defect.findFirst({ where: { id: defectId, projectId } });
  if (!defect) return { ok: false, error: "Defect not found." };

  await prisma.$transaction(async (tx) => {
    await tx.defect.update({
      where: { id: defectId },
      data: { status: "CLOSED", closedDate: new Date(), verifiedBy },
    });
    await logActivity(tx, {
      projectId,
      type: "defects",
      refNumber: defect.number,
      title: defect.description.slice(0, 80),
      action: "closed",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/defects`);
  return { ok: true };
}
