/**
 * LeadFinder Quality Metrics API Endpoint
 * GET /api/leadfinder/quality/metrics
 *
 * Returns quality metrics for scraped leads
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SubscriptionTier, VerificationStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier") as SubscriptionTier | null;
    const days = parseInt(searchParams.get("days") || "30");

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const where = {
      ...(tier && { tier }),
      scrapedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Get scraped leads in date range
    const scrapedLeads = await prisma.scrapedLead.findMany({
      where,
      include: {
        verification: true,
      },
    });

    // Calculate metrics
    const totalScraped = scrapedLeads.length;
    const emailsFound = scrapedLeads.filter((lead) => lead.email).length;

    const verified = scrapedLeads.filter(
      (lead) => lead.verification !== null
    );
    const emailsVerified = verified.length;

    const emailsValid = verified.filter(
      (lead) => lead.verification?.status === VerificationStatus.VALID
    ).length;

    const emailFoundRate =
      totalScraped > 0 ? (emailsFound / totalScraped) * 100 : 0;
    const emailValidRate =
      emailsVerified > 0 ? (emailsValid / emailsVerified) * 100 : 0;

    // Calculate overall quality score (weighted)
    const overallQualityScore =
      emailFoundRate * 0.4 + emailValidRate * 0.6;

    // Breakdown by verification status
    const verificationBreakdown = {
      valid: verified.filter(
        (l) => l.verification?.status === VerificationStatus.VALID
      ).length,
      invalid: verified.filter(
        (l) => l.verification?.status === VerificationStatus.INVALID
      ).length,
      risky: verified.filter(
        (l) => l.verification?.status === VerificationStatus.RISKY
      ).length,
      unknown: verified.filter(
        (l) => l.verification?.status === VerificationStatus.UNKNOWN
      ).length,
    };

    // Average verification scores
    const scoresData = verified
      .map((l) => l.verification)
      .filter((v) => v?.overallScore !== null);

    const avgOverallScore =
      scoresData.length > 0
        ? scoresData.reduce((sum, v) => sum + (v?.overallScore || 0), 0) /
          scoresData.length
        : 0;

    // Get metrics by tier if not filtered
    let metricsByTier: Record<string, any> = {};
    if (!tier) {
      const tiers: SubscriptionTier[] = [
        "SOLO",
        "STARTER",
        "TEAM",
        "PROFESSIONAL",
        "ENTERPRISE",
      ];

      for (const t of tiers) {
        const tierLeads = scrapedLeads.filter((lead) => lead.tier === t);
        const tierTotal = tierLeads.length;

        if (tierTotal > 0) {
          const tierEmailsFound = tierLeads.filter((l) => l.email).length;
          const tierVerified = tierLeads.filter((l) => l.verification);
          const tierValid = tierVerified.filter(
            (l) => l.verification?.status === VerificationStatus.VALID
          ).length;

          metricsByTier[t] = {
            totalScraped: tierTotal,
            emailsFound: tierEmailsFound,
            emailsVerified: tierVerified.length,
            emailsValid: tierValid,
            emailFoundRate:
              tierTotal > 0 ? (tierEmailsFound / tierTotal) * 100 : 0,
            emailValidRate:
              tierVerified.length > 0
                ? (tierValid / tierVerified.length) * 100
                : 0,
          };
        }
      }
    }

    // Get recent scrapes trend (last 7 days)
    const trend: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = scrapedLeads.filter((lead) => {
        const scrapedAt = new Date(lead.scrapedAt);
        return scrapedAt >= date && scrapedAt < nextDate;
      }).length;

      trend.push({
        date: date.toISOString().split("T")[0],
        count,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days,
        },
        metrics: {
          totalScraped,
          emailsFound,
          emailsVerified,
          emailsValid,
          emailFoundRate: Math.round(emailFoundRate * 100) / 100,
          emailValidRate: Math.round(emailValidRate * 100) / 100,
          overallQualityScore: Math.round(overallQualityScore * 100) / 100,
        },
        verification: {
          breakdown: verificationBreakdown,
          averageScore: Math.round(avgOverallScore * 100) / 100,
        },
        trend,
        ...(Object.keys(metricsByTier).length > 0 && {
          byTier: metricsByTier,
        }),
      },
    });
  } catch (error) {
    console.error("Quality metrics API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST endpoint to save quality metrics snapshot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier, periodStart, periodEnd } = body;

    if (!tier || !periodStart || !periodEnd) {
      return NextResponse.json(
        {
          error: "Missing required fields: tier, periodStart, periodEnd",
        },
        { status: 400 }
      );
    }

    const subscriptionTier = tier as SubscriptionTier;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Calculate metrics for the period
    const scrapedLeads = await prisma.scrapedLead.findMany({
      where: {
        tier: subscriptionTier,
        scrapedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        verification: true,
      },
    });

    const totalScraped = scrapedLeads.length;
    const emailsFound = scrapedLeads.filter((lead) => lead.email).length;
    const emailsVerified = scrapedLeads.filter(
      (lead) => lead.verification
    ).length;
    const emailsValid = scrapedLeads.filter(
      (lead) => lead.verification?.status === VerificationStatus.VALID
    ).length;

    const emailFoundRate =
      totalScraped > 0 ? (emailsFound / totalScraped) * 100 : 0;
    const emailValidRate =
      emailsVerified > 0 ? (emailsValid / emailsVerified) * 100 : 0;
    const overallQualityScore = emailFoundRate * 0.4 + emailValidRate * 0.6;

    // Save metrics snapshot
    const metrics = await prisma.qualityMetrics.create({
      data: {
        tier: subscriptionTier,
        totalScraped,
        emailsFound,
        emailsVerified,
        emailsValid,
        emailFoundRate,
        emailValidRate,
        overallQualityScore,
        periodStart: start,
        periodEnd: end,
      },
    });

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Quality metrics POST error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
