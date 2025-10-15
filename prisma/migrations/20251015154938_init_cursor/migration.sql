-- CreateTable
CREATE TABLE "Cursor" (
    "id" SERIAL NOT NULL,
    "chainKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "block" BIGINT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cursor_chainKey_eventName_key" ON "Cursor"("chainKey", "eventName");
