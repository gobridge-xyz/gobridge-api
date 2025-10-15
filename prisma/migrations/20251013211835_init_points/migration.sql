/*
  Warnings:

  - You are about to drop the column `messageId` on the `Bridge` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[requestId]` on the table `Bridge` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `requestId` to the `Bridge` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Bridge_messageId_key";

-- AlterTable
ALTER TABLE "Bridge" DROP COLUMN "messageId",
ADD COLUMN     "requestId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Bridge_requestId_key" ON "Bridge"("requestId");
