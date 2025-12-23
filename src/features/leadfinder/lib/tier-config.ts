/**
 * LeadFinder Subscription Tier Configuration - Hybrid Plan
 * Real pricing and quality guarantees based on actual costs
 *
 * Quality Strategy:
 * - Solo/Starter: Balanced Quality (70% margin, entry/growth tiers)
 * - Team: Balanced+ Quality (70% margin, volume tier)
 * - Professional/Enterprise: World-Class (55% margin, premium positioning)
 */

import { SubscriptionTier } from "@prisma/client";

export interface TierConfig {
  name: string;
  price: number; // EUR per month
  currency: string;
  qualityLevel: "balanced" | "balanced+" | "world-class" | "world-class+";

  // Quality guarantees (with SLA)
  guarantees: {
    ownerNameAccuracy: number; // percentage
    emailAccuracy: number; // percentage
    maxEmailBounceRate?: number; // Professional/Enterprise only
    linkedInCoverage: number; // percentage
    maxDataAge: number; // max age in days
    slaRefund: boolean; // auto-refund if breached
  };

  features: {
    // Scraping
    maxScrapesPerMonth: number;
    scrapingDepth: "basic" | "enhanced" | "deep";
    cacheMaxAge: number; // days
    realTimeScraping: boolean;
    parallelRequests: number;

    // Email verification
    emailVerification: boolean;
    verificationMethod: "none" | "smtp" | "smtp+reoon" | "triple";
    verificationAccuracy: number; // target %
    smtpValidation: boolean;

    // Data sources
    googleMaps: boolean;
    impressumScraping: boolean;
    handelsregister: "none" | "sample" | "full";
    linkedInMethod: "pattern" | "pattern+http" | "pattern+http+bing" | "full+pdl";
    phoneValidation: boolean;

    // Quality features
    multiSourceVerification: boolean;
    qualityScoring: boolean;
    duplicateDetection: boolean;
    dataEnrichment: boolean;

    // API & Integration
    apiAccess: boolean;
    apiRateLimit: number; // requests/min
    webhooks: boolean;
    exportFormats: string[];

    // Support
    support: "community" | "email" | "priority" | "dedicated";
    accountManager: boolean;
    sla: string;
  };

  limits: {
    dailyScrapeLimit: number;
    storageDays: number;
    teamMembers: number;
  };

  // Real monthly costs
  costs: {
    googleMaps: number;
    scraping: number;
    emailVerification: number;
    computing: number;
    linkedIn: number;
    handelsregister: number;
    storage: number;
    other: number;
    total: number;
  };

  margin: {
    absolute: number; // EUR
    percentage: number; // %
  };
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  SOLO: {
    name: "Solo",
    price: 49,
    currency: "EUR",
    qualityLevel: "balanced",

    guarantees: {
      ownerNameAccuracy: 87, // 85-90% range
      emailAccuracy: 80,
      linkedInCoverage: 52, // 50-55% range
      maxDataAge: 30,
      slaRefund: false, // No SLA for budget tier
    },

    features: {
      maxScrapesPerMonth: 500,
      scrapingDepth: "basic",
      cacheMaxAge: 30,
      realTimeScraping: false,
      parallelRequests: 1,

      emailVerification: false, // Too expensive for this tier
      verificationMethod: "none",
      verificationAccuracy: 0,
      smtpValidation: false,

      googleMaps: true,
      impressumScraping: true,
      handelsregister: "none",
      linkedInMethod: "pattern", // URL pattern only
      phoneValidation: false,

      multiSourceVerification: false,
      qualityScoring: false,
      duplicateDetection: true,
      dataEnrichment: false,

      apiAccess: true,
      apiRateLimit: 10,
      webhooks: false,
      exportFormats: ["csv"],

      support: "community",
      accountManager: false,
      sla: "best-effort",
    },

    limits: {
      dailyScrapeLimit: 25,
      storageDays: 30,
      teamMembers: 1,
    },

    costs: {
      googleMaps: 3,
      scraping: 4,
      emailVerification: 0,
      computing: 1.5,
      linkedIn: 2,
      handelsregister: 0,
      storage: 1.5,
      other: 2,
      total: 14,
    },

    margin: {
      absolute: 35,
      percentage: 71,
    },
  },

  STARTER: {
    name: "Starter",
    price: 149,
    currency: "EUR",
    qualityLevel: "balanced",

    guarantees: {
      ownerNameAccuracy: 90,
      emailAccuracy: 85,
      linkedInCoverage: 62, // 60-65% range
      maxDataAge: 14,
      slaRefund: false,
    },

    features: {
      maxScrapesPerMonth: 2000,
      scrapingDepth: "enhanced",
      cacheMaxAge: 14,
      realTimeScraping: false,
      parallelRequests: 2,

      emailVerification: true,
      verificationMethod: "smtp", // Free SMTP validation
      verificationAccuracy: 85,
      smtpValidation: true,

      googleMaps: true,
      impressumScraping: true,
      handelsregister: "none",
      linkedInMethod: "pattern+http", // Pattern + HTTP verification
      phoneValidation: false,

      multiSourceVerification: false,
      qualityScoring: true,
      duplicateDetection: true,
      dataEnrichment: false,

      apiAccess: true,
      apiRateLimit: 30,
      webhooks: false,
      exportFormats: ["csv", "json"],

      support: "email",
      accountManager: false,
      sla: "48h",
    },

    limits: {
      dailyScrapeLimit: 100,
      storageDays: 90,
      teamMembers: 2,
    },

    costs: {
      googleMaps: 8,
      scraping: 12,
      emailVerification: 0, // SMTP is free!
      computing: 4,
      linkedIn: 6,
      handelsregister: 0,
      storage: 2.8,
      other: 11.2,
      total: 44,
    },

    margin: {
      absolute: 105,
      percentage: 70,
    },
  },

  TEAM: {
    name: "Team",
    price: 345,
    currency: "EUR",
    qualityLevel: "balanced+",

    guarantees: {
      ownerNameAccuracy: 92,
      emailAccuracy: 92,
      maxEmailBounceRate: 15, // Guarantee < 15% bounce
      linkedInCoverage: 70,
      maxDataAge: 7,
      slaRefund: true, // Auto-refund if SLA breached
    },

    features: {
      maxScrapesPerMonth: 5000,
      scrapingDepth: "deep",
      cacheMaxAge: 7,
      realTimeScraping: false,
      parallelRequests: 5,

      emailVerification: true,
      verificationMethod: "smtp+reoon", // SMTP + Reoon API
      verificationAccuracy: 92,
      smtpValidation: true,

      googleMaps: true,
      impressumScraping: true,
      handelsregister: "sample", // 20% sample checks
      linkedInMethod: "pattern+http+bing", // Full stack without PDL
      phoneValidation: false,

      multiSourceVerification: true,
      qualityScoring: true,
      duplicateDetection: true,
      dataEnrichment: true,

      apiAccess: true,
      apiRateLimit: 100,
      webhooks: true,
      exportFormats: ["csv", "json", "xlsx"],

      support: "priority",
      accountManager: false,
      sla: "24h",
    },

    limits: {
      dailyScrapeLimit: 250,
      storageDays: 180,
      teamMembers: 5,
    },

    costs: {
      googleMaps: 15,
      scraping: 25,
      emailVerification: 32, // Reoon API
      computing: 10,
      linkedIn: 15,
      handelsregister: 3,
      storage: 5,
      other: 0,
      total: 105,
    },

    margin: {
      absolute: 240,
      percentage: 70,
    },
  },

  PROFESSIONAL: {
    name: "Professional",
    price: 995,
    currency: "EUR",
    qualityLevel: "world-class",

    guarantees: {
      ownerNameAccuracy: 98,
      emailAccuracy: 98,
      maxEmailBounceRate: 5, // Premium guarantee
      linkedInCoverage: 90,
      maxDataAge: 0.5, // 12 hours
      slaRefund: true,
    },

    features: {
      maxScrapesPerMonth: 12000,
      scrapingDepth: "deep",
      cacheMaxAge: 0.5, // 12 hours
      realTimeScraping: true,
      parallelRequests: 10,

      emailVerification: true,
      verificationMethod: "triple", // Triple verification
      verificationAccuracy: 98,
      smtpValidation: true,

      googleMaps: true,
      impressumScraping: true,
      handelsregister: "full",
      linkedInMethod: "full+pdl", // People Data Labs enrichment
      phoneValidation: true,

      multiSourceVerification: true,
      qualityScoring: true,
      duplicateDetection: true,
      dataEnrichment: true,

      apiAccess: true,
      apiRateLimit: 500,
      webhooks: true,
      exportFormats: ["csv", "json", "xlsx", "xml"],

      support: "priority",
      accountManager: true,
      sla: "12h",
    },

    limits: {
      dailyScrapeLimit: 600,
      storageDays: 365,
      teamMembers: 15,
    },

    costs: {
      googleMaps: 40,
      scraping: 90,
      emailVerification: 93.6, // Triple verification
      computing: 35,
      linkedIn: 75, // PDL
      handelsregister: 15,
      storage: 20,
      other: 71.4,
      total: 440,
    },

    margin: {
      absolute: 555,
      percentage: 56,
    },
  },

  ENTERPRISE: {
    name: "Enterprise",
    price: 1990,
    currency: "EUR",
    qualityLevel: "world-class+",

    guarantees: {
      ownerNameAccuracy: 99,
      emailAccuracy: 99,
      maxEmailBounceRate: 2, // Best-in-class
      linkedInCoverage: 93, // 92-95% range
      maxDataAge: 0.083, // 2 hours / real-time
      slaRefund: true,
    },

    features: {
      maxScrapesPerMonth: 30000,
      scrapingDepth: "deep",
      cacheMaxAge: 0.083, // 2 hours
      realTimeScraping: true,
      parallelRequests: 20,

      emailVerification: true,
      verificationMethod: "triple",
      verificationAccuracy: 99,
      smtpValidation: true,

      googleMaps: true,
      impressumScraping: true,
      handelsregister: "full",
      linkedInMethod: "full+pdl",
      phoneValidation: true,

      multiSourceVerification: true,
      qualityScoring: true,
      duplicateDetection: true,
      dataEnrichment: true,

      apiAccess: true,
      apiRateLimit: 2000,
      webhooks: true,
      exportFormats: ["csv", "json", "xlsx", "xml", "parquet"],

      support: "dedicated",
      accountManager: true,
      sla: "4h",
    },

    limits: {
      dailyScrapeLimit: 1500,
      storageDays: 730,
      teamMembers: 999,
    },

    costs: {
      googleMaps: 75,
      scraping: 180,
      emailVerification: 234, // Enterprise-grade
      computing: 70,
      linkedIn: 150,
      handelsregister: 15,
      storage: 40,
      other: 226,
      total: 990,
    },

    margin: {
      absolute: 1000,
      percentage: 50,
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
 * Get email verification method for a tier
 */
export function getVerificationMethod(tier: SubscriptionTier): string {
  return TIER_CONFIGS[tier].features.verificationMethod;
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

/**
 * Check if tier meets SLA for refund
 */
export function checkSLABreach(
  tier: SubscriptionTier,
  metrics: {
    ownerNameAccuracy?: number;
    emailBounceRate?: number;
    linkedInCoverage?: number;
    avgDataAge?: number;
  }
): { breached: boolean; reasons: string[] } {
  const config = TIER_CONFIGS[tier];

  if (!config.guarantees.slaRefund) {
    return { breached: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (metrics.ownerNameAccuracy !== undefined) {
    if (metrics.ownerNameAccuracy < config.guarantees.ownerNameAccuracy) {
      reasons.push(
        `Owner name accuracy ${metrics.ownerNameAccuracy}% < ${config.guarantees.ownerNameAccuracy}% guarantee`
      );
    }
  }

  if (metrics.emailBounceRate !== undefined && config.guarantees.maxEmailBounceRate) {
    if (metrics.emailBounceRate > config.guarantees.maxEmailBounceRate) {
      reasons.push(
        `Email bounce rate ${metrics.emailBounceRate}% > ${config.guarantees.maxEmailBounceRate}% max`
      );
    }
  }

  if (metrics.linkedInCoverage !== undefined) {
    if (metrics.linkedInCoverage < config.guarantees.linkedInCoverage) {
      reasons.push(
        `LinkedIn coverage ${metrics.linkedInCoverage}% < ${config.guarantees.linkedInCoverage}% guarantee`
      );
    }
  }

  if (metrics.avgDataAge !== undefined) {
    if (metrics.avgDataAge > config.guarantees.maxDataAge) {
      reasons.push(
        `Data freshness ${metrics.avgDataAge}d > ${config.guarantees.maxDataAge}d max`
      );
    }
  }

  return {
    breached: reasons.length > 0,
    reasons,
  };
}

/**
 * Calculate quality score for metrics
 */
export function calculateQualityScore(
  tier: SubscriptionTier,
  metrics: {
    ownerNameAccuracy: number;
    emailAccuracy: number;
    linkedInCoverage: number;
    dataFreshness: number; // days
    emailBounceRate: number;
  }
): number {
  const config = TIER_CONFIGS[tier];
  const targets = config.guarantees;

  // Component scores (0-100)
  const ownerScore = Math.min(100, (metrics.ownerNameAccuracy / targets.ownerNameAccuracy) * 100);
  const emailScore = Math.min(100, (metrics.emailAccuracy / targets.emailAccuracy) * 100);
  const linkedInScore = Math.min(100, (metrics.linkedInCoverage / targets.linkedInCoverage) * 100);
  const freshnessScore = Math.max(0, 100 - (metrics.dataFreshness / targets.maxDataAge) * 100);

  // Bounce rate penalty
  const bounceRatePenalty = targets.maxEmailBounceRate
    ? Math.max(0, (metrics.emailBounceRate - targets.maxEmailBounceRate) * 2)
    : metrics.emailBounceRate * 1.5;

  // Weighted average
  const weights = {
    owner: 0.25,
    email: 0.35,
    linkedIn: 0.25,
    freshness: 0.15,
  };

  const score =
    ownerScore * weights.owner +
    emailScore * weights.email +
    linkedInScore * weights.linkedIn +
    freshnessScore * weights.freshness -
    bounceRatePenalty;

  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}
