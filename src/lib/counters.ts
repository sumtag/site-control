import { Prisma } from "@/generated/prisma/client";

// Per-project, per-module auto-numbering (DOC-001, RFI-001, ...). Counter
// rows are upserted+incremented inside the caller's transaction so a number
// is never handed out twice under concurrent creates.
const PREFIXES = {
  documents: "DOC",
  rfis: "RFI",
  submittals: "SUB",
  defects: "DEF",
  correspondence: "COR",
} as const;

export type CounterType = keyof typeof PREFIXES;

export async function nextNumber(
  tx: Prisma.TransactionClient,
  projectId: string,
  type: CounterType,
): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { projectId_type: { projectId, type } },
    update: { value: { increment: 1 } },
    create: { projectId, type, value: 1 },
  });
  return `${PREFIXES[type]}-${String(counter.value).padStart(3, "0")}`;
}
