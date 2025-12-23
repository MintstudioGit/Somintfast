-- CreateTable
CREATE TABLE "ScrapedLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteUrl" TEXT NOT NULL,
    "companyName" TEXT,
    "ownerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "rawData" TEXT,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tier" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "isCatchAll" BOOLEAN NOT NULL DEFAULT false,
    "isDisposable" BOOLEAN NOT NULL DEFAULT false,
    "isRoleAccount" BOOLEAN NOT NULL DEFAULT false,
    "syntaxScore" INTEGER,
    "domainScore" INTEGER,
    "smtpScore" INTEGER,
    "overallScore" INTEGER,
    "provider" TEXT,
    "rawResponse" TEXT,
    "scrapedLeadId" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_scrapedLeadId_fkey" FOREIGN KEY ("scrapedLeadId") REFERENCES "ScrapedLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QualityMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tier" TEXT NOT NULL,
    "totalScraped" INTEGER NOT NULL DEFAULT 0,
    "emailsFound" INTEGER NOT NULL DEFAULT 0,
    "emailsVerified" INTEGER NOT NULL DEFAULT 0,
    "emailsValid" INTEGER NOT NULL DEFAULT 0,
    "emailFoundRate" REAL NOT NULL DEFAULT 0,
    "emailValidRate" REAL NOT NULL DEFAULT 0,
    "overallQualityScore" REAL NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ScrapedLead_tier_idx" ON "ScrapedLead"("tier");

-- CreateIndex
CREATE INDEX "ScrapedLead_scrapedAt_idx" ON "ScrapedLead"("scrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_scrapedLeadId_key" ON "EmailVerification"("scrapedLeadId");

-- CreateIndex
CREATE INDEX "EmailVerification_status_idx" ON "EmailVerification"("status");

-- CreateIndex
CREATE INDEX "EmailVerification_isValid_idx" ON "EmailVerification"("isValid");

-- CreateIndex
CREATE INDEX "QualityMetrics_tier_idx" ON "QualityMetrics"("tier");

-- CreateIndex
CREATE INDEX "QualityMetrics_periodStart_idx" ON "QualityMetrics"("periodStart");
