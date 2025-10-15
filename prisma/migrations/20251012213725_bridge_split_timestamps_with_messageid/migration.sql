/*
  Warnings:

  - You are about to drop the column `timestamp` on the `Bridge` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[messageId]` on the table `Bridge` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `messageId` to the `Bridge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTimestamp` to the `Bridge` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Bridge_walletAddress_fromChain_timestamp_idx";

-- DropIndex
DROP INDEX "public"."Bridge_walletAddress_toChain_timestamp_idx";

-- AlterTable
ALTER TABLE "Bridge" DROP COLUMN "timestamp",
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "endTimestamp" TIMESTAMP(3),
ADD COLUMN     "messageId" TEXT NOT NULL,
ADD COLUMN     "startTimestamp" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "toChain" DROP NOT NULL,
ALTER COLUMN "toHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Bridge_messageId_key" ON "Bridge"("messageId");

-- CreateIndex
CREATE INDEX "Bridge_walletAddress_fromChain_startTimestamp_idx" ON "Bridge"("walletAddress", "fromChain", "startTimestamp" DESC);

-- CreateIndex
CREATE INDEX "Bridge_walletAddress_toChain_endTimestamp_idx" ON "Bridge"("walletAddress", "toChain", "endTimestamp" DESC);
