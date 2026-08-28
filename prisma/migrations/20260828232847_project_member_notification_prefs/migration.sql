-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "notifyOnCorrespondence" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnDefects" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnDocuments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnDrawings" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnRfis" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnSubmittals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnTransmittals" BOOLEAN NOT NULL DEFAULT true;
