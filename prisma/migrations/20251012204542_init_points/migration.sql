-- CreateTable
CREATE TABLE "UserPoints" (
    "walletAddress" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPoints_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "Bridge" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "fromChain" INTEGER NOT NULL,
    "fromHash" TEXT NOT NULL,
    "toChain" INTEGER NOT NULL,
    "toHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bridge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bridge_fromHash_key" ON "Bridge"("fromHash");

-- CreateIndex
CREATE INDEX "Bridge_walletAddress_fromChain_timestamp_idx" ON "Bridge"("walletAddress", "fromChain", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Bridge_walletAddress_toChain_timestamp_idx" ON "Bridge"("walletAddress", "toChain", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "Bridge" ADD CONSTRAINT "Bridge_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "UserPoints"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;
