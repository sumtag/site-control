"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  number: z.string().trim().min(1, "Project number is required"),
});

// Whoever creates a project becomes its Superintendent — there's no
// separate global-admin role in this app, so project ownership starts with
// the creator, same as most workspace-per-project tools.
export async function createProject(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    number: formData.get("number"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const existing = await prisma.project.findUnique({
    where: { number: parsed.data.number },
  });
  if (existing) {
    return { ok: false, error: `Project number ${parsed.data.number} is already in use.` };
  }

  const project = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: { name: parsed.data.name, number: parsed.data.number },
    });
    await tx.projectMember.create({
      data: { projectId: project.id, userId: user.id, role: "SUPERINTENDENT" },
    });
    await logActivity(tx, {
      projectId: project.id,
      type: "project",
      refNumber: project.number,
      title: project.name,
      action: "created",
      actedById: user.id,
    });
    return project;
  });

  redirect(`/projects/${project.id}`);
}
