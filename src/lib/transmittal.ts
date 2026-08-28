import type { TransmittalReason } from "@/generated/prisma/client";

export const TRANSMITTAL_REASONS: TransmittalReason[] = [
  "FOR_TENDER",
  "FOR_CONSTRUCTION",
  "FOR_INFORMATION",
  "FOR_APPROVAL",
];

export const TRANSMITTAL_REASON_LABELS: Record<TransmittalReason, string> = {
  FOR_TENDER: "For Tender",
  FOR_CONSTRUCTION: "For Construction",
  FOR_INFORMATION: "For Information",
  FOR_APPROVAL: "For Approval",
};
