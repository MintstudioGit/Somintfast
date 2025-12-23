/**
 * LeadFinder Scrape API Endpoint
 * POST /api/leadfinder/scrape
 *
 * Scrapes a German website's Impressum page and optionally verifies email
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SubscriptionTier } from "@prisma/client";
import { ImpressumScraper } from "@/features/leadfinder/api/scraping/impressum-scraper";
import { EmailVerifier } from "@/features/leadfinder/api/verification/email-verifier";
import {
  getTierConfig,
  canScrape,
  hasEmailVerification,
} from "@/features/leadfinder/lib/tier-config";

// Request validation schema
const ScrapeRequestSchema = z.object({
  websiteUrl: z.string().url("Invalid website URL"),
  tier: z.enum(["SOLO", "STARTER", "TEAM", "PROFESSIONAL", "ENTERPRISE"]),
  verifyEmail: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = ScrapeRequestSchema.parse(body);

    const { websiteUrl, tier, verifyEmail } = validatedData;
    const subscriptionTier = tier as SubscriptionTier;

    // Check tier limits (simplified - in production, check against user account)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const scrapedToday = await prisma.scrapedLead.count({
      where: {
        tier: subscriptionTier,
        createdAt: {
          gte: todayStart,
        },
      },
    });

    if (!canScrape(subscriptionTier, scrapedToday)) {
      const tierConfig = getTierConfig(subscriptionTier);
      return NextResponse.json(
        {
          error: "Daily scrape limit reached",
          limit: tierConfig.limits.dailyScrapeLimit,
          used: scrapedToday,
        },
        { status: 429 }
      );
    }

    // Perform scraping
    const scraper = new ImpressumScraper();
    const scrapeResult = await scraper.scrape(websiteUrl, {
      tier: subscriptionTier,
    });

    if (!scrapeResult.success || !scrapeResult.data) {
      return NextResponse.json(
        {
          error: scrapeResult.error || "Scraping failed",
          success: false,
        },
        { status: 400 }
      );
    }

    // Save scraped data
    const scrapedLead = await prisma.scrapedLead.create({
      data: {
        websiteUrl: scrapeResult.data.websiteUrl,
        companyName: scrapeResult.data.companyName,
        ownerName: scrapeResult.data.ownerName,
        email: scrapeResult.data.email,
        phone: scrapeResult.data.phone,
        address: scrapeResult.data.address,
        rawData: JSON.stringify(scrapeResult.data.rawData),
        tier: subscriptionTier,
      },
    });

    // Verify email if requested and available
    let verificationResult = null;
    if (
      verifyEmail &&
      scrapeResult.data.email &&
      hasEmailVerification(subscriptionTier)
    ) {
      const verifier = new EmailVerifier();
      verificationResult = await verifier.verify(scrapeResult.data.email, {
        tier: subscriptionTier,
      });

      // Save verification result
      if (verificationResult) {
        await prisma.emailVerification.create({
          data: {
            scrapedLeadId: scrapedLead.id,
            email: verificationResult.email,
            status: verificationResult.status,
            isValid: verificationResult.isValid,
            isCatchAll: verificationResult.isCatchAll,
            isDisposable: verificationResult.isDisposable,
            isRoleAccount: verificationResult.isRoleAccount,
            syntaxScore: verificationResult.syntaxScore,
            domainScore: verificationResult.domainScore,
            smtpScore: verificationResult.smtpScore,
            overallScore: verificationResult.overallScore,
            provider: verificationResult.provider,
            rawResponse: verificationResult.rawResponse
              ? JSON.stringify(verificationResult.rawResponse)
              : null,
          },
        });
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        id: scrapedLead.id,
        websiteUrl: scrapedLead.websiteUrl,
        companyName: scrapedLead.companyName,
        ownerName: scrapedLead.ownerName,
        email: scrapedLead.email,
        phone: scrapedLead.phone,
        address: scrapedLead.address,
        tier: scrapedLead.tier,
        scrapedAt: scrapedLead.scrapedAt,
        googleMapsData: scrapeResult.data.googleMapsData || null,
        verification: verificationResult
          ? {
              status: verificationResult.status,
              isValid: verificationResult.isValid,
              overallScore: verificationResult.overallScore,
              provider: verificationResult.provider,
            }
          : null,
      },
      meta: {
        scrapingDepth: scrapeResult.scrapingDepth,
        remainingToday: getTierConfig(subscriptionTier).limits.dailyScrapeLimit - scrapedToday - 1,
        dataSources: {
          impressum: true,
          googleMaps: !!scrapeResult.data.googleMapsData,
          emailVerification: !!verificationResult,
        },
      },
    });
  } catch (error) {
    console.error("Scrape API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve scrape history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = tier
      ? { tier: tier as SubscriptionTier }
      : {};

    const [scrapedLeads, total] = await Promise.all([
      prisma.scrapedLead.findMany({
        where,
        include: {
          verification: true,
        },
        orderBy: {
          scrapedAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.scrapedLead.count({ where }),
    ]);

    return NextResponse.json({
      data: scrapedLeads,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Scrape GET API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
