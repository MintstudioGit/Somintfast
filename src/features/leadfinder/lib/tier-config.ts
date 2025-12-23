/**
 * LeadFinder Subscription Tier Configuration
 * Defines capabilities and limits for each pricing tier
 */

import { SubscriptionTier } from "@prisma/client";

export interface TierConfig {
  name: string;
  price: number; // in EUR per month
  currency: string;
  features: {
    // Scraping capabilities
    maxScrapesPerMonth: number;
    scrapingDepth: "basic" | "enhanced" | "deep";
    parallelRequests: number;

    // Email verification
    emailVerification: boolean;
    verificationAccuracy: number; // percentage
    verificationProvider: "none" | "basic" | "reoon";

    // Data quality
    qualityChecks: boolean;
    duplicateDetection: boolean;
    dataEnrichment: boolean;

    // API & Export
    apiAccess: boolean;
    apiRateLimit: number; // requests per minute
    exportFormats: string[];

    // Support
    support: "community" | "email" | "priority" | "dedicated";
    sla: string;
  };
  limits: {
    dailyScrapeLimit: number;
    storageDays: number;
    teamMembers: number;
  };
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  SOLO: {
    name: "Solo",
    price: 49,
    currency: "EUR",
    features: {
      maxScrapesPerMonth: 500,
      scrapingDepth: "basic",
      parallelRequests: 1,

      emailVerification: false,
      verificationAccuracy: 0,
      verificationProvider: "none",

      qualityChecks: false,
      duplicateDetection: true,
      dataEnrichment: false,

      apiAccess: true,
      apiRateLimit: 10,
      exportFormats: ["csv"],

      support: "community",
      sla: "best-effort",
    },
    limits: {
      dailyScrapeLimit: 25,
      storageDays: 30,
      teamMembers: 1,
    },
  },

  STARTER: {
    name: "Starter",
    price: 99,
    currency: "EUR",
    features: {
      maxScrapesPerMonth: 2000,
      scrapingDepth: "enhanced",
      parallelRequests: 2,

      emailVerification: true,
      verificationAccuracy: 85,
      verificationProvider: "basic",

      qualityChecks: true,
      duplicateDetection: true,
      dataEnrichment: false,

      apiAccess: true,
      apiRateLimit: 30,
      exportFormats: ["csv", "json"],

      support: "email",
      sla: "48h",
    },
    limits: {
      dailyScrapeLimit: 100,
      storageDays: 90,
      teamMembers: 2,
    },
  },

  TEAM: {
    name: "Team",
    price: 299,
    currency: "EUR",
    features: {
      maxScrapesPerMonth: 10000,
      scrapingDepth: "deep",
      parallelRequests: 5,

      emailVerification: true,
      verificationAccuracy: 95,
      verificationProvider: "reoon",

      qualityChecks: true,
      duplicateDetection: true,
      dataEnrichment: true,

      apiAccess: true,
      apiRateLimit: 100,
      exportFormats: ["csv", "json", "xlsx"],

      support: "priority",
      sla: "24h",
    },
    limits: {
      dailyScrapeLimit: 500,
      storageDays: 180,
      teamMembers: 5,
    },
  },

  PROFESSIONAL: {
    name: "Professional",
    price: 799,
    currency: "EUR",
    features: {
      maxScrapesPerMonth: 50000,
      scrapingDepth: "deep",
      parallelRequests: 10,

      emailVerification: true,
      verificationAccuracy: 97,
      verificationProvider: "reoon",

      qualityChecks: true,
      duplicateDetection: true,
      dataEnrichment: true,

      apiAccess: true,
      apiRateLimit: 500,
      exportFormats: ["csv", "json", "xlsx", "xml"],

      support: "priority",
      sla: "12h",
    },
    limits: {
      dailyScrapeLimit: 2000,
      storageDays: 365,
      teamMembers: 15,
    },
  },

  ENTERPRISE: {
    name: "Enterprise",
    price: 1990,
    currency: "EUR",
    features: {
      maxScrapesPerMonth: 200000,
      scrapingDepth: "deep",
      parallelRequests: 20,

      emailVerification: true,
      verificationAccuracy: 98,
      verificationProvider: "reoon",

      qualityChecks: true,
      duplicateDetection: true,
      dataEnrichment: true,

      apiAccess: true,
      apiRateLimit: 2000,
      exportFormats: ["csv", "json", "xlsx", "xml", "parquet"],

      support: "dedicated",
      sla: "4h",
    },
    limits: {
      dailyScrapeLimit: 10000,
      storageDays: 730,
      teamMembers: 999,
    },
  },
};

/**
 * Get configuration for a specific tier
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Check if a tier has email verification enabled
 */
export function hasEmailVerification(tier: SubscriptionTier): boolean {
  return TIER_CONFIGS[tier].features.emailVerification;
}

/**
 * Get verification accuracy for a tier
 */
export function getVerificationAccuracy(tier: SubscriptionTier): number {
  return TIER_CONFIGS[tier].features.verificationAccuracy;
}

/**
 * Check if user has reached their daily scrape limit
 */
export function canScrape(
  tier: SubscriptionTier,
  scrapedToday: number
): boolean {
  return scrapedToday < TIER_CONFIGS[tier].limits.dailyScrapeLimit;
}

/**
 * Calculate remaining scrapes for the day
 */
export function getRemainingDailyScrapes(
  tier: SubscriptionTier,
  scrapedToday: number
): number {
  const limit = TIER_CONFIGS[tier].limits.dailyScrapeLimit;
  return Math.max(0, limit - scrapedToday);
}
