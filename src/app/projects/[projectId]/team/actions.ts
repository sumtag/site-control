"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";

const ROLE_VALUES = ["SUPERINTENDENT", "CONTRACTOR", "CLIENT"] as const;

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  name: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  role: z.enum(ROLE_VALUES),
});

export async function addMember(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const parsed = addMemberSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    organization: formData.get("organization") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.$transaction(async (tx) => {
    // Pre-creates a bare User row by email if this person has never signed
    // in — their first real Entra sign-in attaches to it automatically (see
    // allowDangerousEmailAccountLinking in src/auth.ts). If they're already
    // a member of this project, this just updates their role/organization.
    const user = await tx.user.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email, name: parsed.data.name },
    });
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      update: { role: parsed.data.role, organization: parsed.data.organization },
      create: {
        projectId,
        userId: user.id,
        role: parsed.data.role,
        organization: parsed.data.organization,
      },
    });
    await logActivity(tx, {
      projectId,
      type: "team",
      refNumber: parsed.data.role,
      title: parsed.data.name || parsed.data.email,
      action: "added to team",
      actedById: membership.userId,
    });
  });

  revalidatePath(`/projects/${projectId}/team`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

const roleSchema = z.object({
  role: z.enum(ROLE_VALUES),
  organization: z.string().trim().optional(),
});

export async function updateMemberRole(
  projectId: string,
  memberId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const target = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
  if (!target) return { ok: false, error: "Member not found." };

  const parsed = roleSchema.safeParse({
    role: formData.get("role"),
    organization: formData.get("organization") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (target.role === "SUPERINTENDENT" && parsed.data.role !== "SUPERINTENDENT") {
    const superCount = await prisma.projectMember.count({
      where: { projectId, role: "SUPERINTENDENT" },
    });
    if (superCount <= 1) {
      return {
        ok: false,
        error: "Can't change the last Superintendent's role — promote someone else first.",
      };
    }
  }

  await prisma.projectMember.update({
    where: { id: memberId },
    data: { role: parsed.data.role, organization: parsed.data.organization },
  });

  revalidatePath(`/projects/${projectId}/team`);
  return { ok: true };
}

export async function removeMember(projectId: string, memberId: string): Promise<ActionState> {
  const membership = await requireMembership(projectId);
  requireRole(membership, ["SUPERINTENDENT"]);

  const target = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
  if (!target) return { ok: false, error: "Member not found." };

  if (target.role === "SUPERINTENDENT") {
    const superCount = await prisma.projectMember.count({
      where: { projectId, role: "SUPERINTENDENT" },
    });
    if (superCount <= 1) {
      return { ok: false, error: "Can't remove the last Superintendent on this project." };
    }
  }

  await prisma.projectMember.delete({ where: { id: memberId } });
  revalidatePath(`/projects/${projectId}/team`);
  return { ok: true };
}

const NOTIFY_FIELDS = [
  "notifyOnDocuments",
  "notifyOnDrawings",
  "notifyOnRfis",
  "notifyOnSubmittals",
  "notifyOnDefects",
  "notifyOnCorrespondence",
  "notifyOnTransmittals",
] as const;

// Personal preferences — every member (any role) edits their own row only,
// scoped by the caller's own membership id, never one passed from the form.
export async function updateNotificationPreferences(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const membership = await requireMembership(projectId);

  const data = Object.fromEntries(
    NOTIFY_FIELDS.map((field) => [field, formData.get(field) === "on"]),
  );

  await prisma.projectMember.update({
    where: { id: membership.id },
    data,
  });

  revalidatePath(`/projects/${projectId}/team`);
  return { ok: true };
}
