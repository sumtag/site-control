-- CreateEnum
CREATE TYPE "TransmittalReason" AS ENUM ('FOR_TENDER', 'FOR_CONSTRUCTION', 'FOR_INFORMATION', 'FOR_APPROVAL');

-- AlterTable
ALTER TABLE "Transmittal" ADD COLUMN     "reason" "TransmittalReason" NOT NULL DEFAULT 'FOR_INFORMATION';

-- CreateTable
CREATE TABLE "DocumentTransmittal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "TransmittalReason" NOT NULL DEFAULT 'FOR_INFORMATION',
    "message" TEXT,

    CONSTRAINT "DocumentTransmittal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTransmittalRecipient" (
    "id" TEXT NOT NULL,
    "documentTransmittalId" TEXT NOT NULL,
    "userId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "DocumentTransmittalRecipient_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentTransmittal" ADD CONSTRAINT "DocumentTransmittal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTransmittal" ADD CONSTRAINT "DocumentTransmittal_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTransmittal" ADD CONSTRAINT "DocumentTransmittal_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTransmittalRecipient" ADD CONSTRAINT "DocumentTransmittalRecipient_documentTransmittalId_fkey" FOREIGN KEY ("documentTransmittalId") REFERENCES "DocumentTransmittal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTransmittalRecipient" ADD CONSTRAINT "DocumentTransmittalRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
