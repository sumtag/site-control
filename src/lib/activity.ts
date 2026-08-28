import { Prisma } from "@/generated/prisma/client";

export type ActivityType =
  | "project"
  | "team"
  | "documents"
  | "drawings"
  | "rfis"
  | "submittals"
  | "defects"
  | "correspondence"
  | "transmittals";

export async function logActivity(
  tx: Prisma.TransactionClient,
  entry: {
    projectId: string;
    type: ActivityType;
    refNumber: string;
    title: string;
    action: string;
    actedById: string;
  },
) {
  await tx.activityLog.create({ data: entry });
}
