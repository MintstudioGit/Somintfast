/**
 * LeadFinder Search API Endpoint
 * GET /api/leadfinder/search
 *
 * Apollo.io-like search functionality for finding B2B leads
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VerificationStatus, SubscriptionTier } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Search filters
    const query = searchParams.get("q") || "";
    const companyName = searchParams.get("company");
    const location = searchParams.get("location");
    const hasEmail = searchParams.get("hasEmail");
    const hasPhone = searchParams.get("hasPhone");
    const emailStatus = searchParams.get("emailStatus");
    const tier = searchParams.get("tier");

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const offset = (page - 1) * limit;

    // Sort
    const sortBy = searchParams.get("sortBy") || "scrapedAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: any = {};

    // General search query
    if (query) {
      where.OR = [
        { companyName: { contains: query, mode: "insensitive" } },
        { websiteUrl: { contains: query, mode: "insensitive" } },
        { ownerName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { address: { contains: query, mode: "insensitive" } },
      ];
    }

    // Specific filters
    if (companyName) {
      where.companyName = { contains: companyName, mode: "insensitive" };
    }

    if (location) {
      where.address = { contains: location, mode: "insensitive" };
    }

    if (hasEmail === "true") {
      where.email = { not: null };
    } else if (hasEmail === "false") {
      where.email = null;
    }

    if (hasPhone === "true") {
      where.phone = { not: null };
    } else if (hasPhone === "false") {
      where.phone = null;
    }

    if (tier) {
      where.tier = tier as SubscriptionTier;
    }

    // Email verification status filter
    if (emailStatus) {
      where.verification = {
        status: emailStatus as VerificationStatus,
      };
    }

    // Execute query with pagination
    const [leads, total] = await Promise.all([
      prisma.scrapedLead.findMany({
        where,
        include: {
          verification: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        take: limit,
        skip: offset,
      }),
      prisma.scrapedLead.count({ where }),
    ]);

    // Transform data to include parsed Google Maps data
    const transformedLeads = leads.map((lead) => {
      let googleMapsData = null;
      try {
        if (lead.rawData) {
          const parsed = JSON.parse(lead.rawData);
          googleMapsData = parsed.googleMaps || null;
        }
      } catch {
        // Ignore JSON parse errors
      }

      return {
        id: lead.id,
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        ownerName: lead.ownerName,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        tier: lead.tier,
        scrapedAt: lead.scrapedAt,
        googleMaps: googleMapsData,
        verification: lead.verification
          ? {
              status: lead.verification.status,
              isValid: lead.verification.isValid,
              isDisposable: lead.verification.isDisposable,
              isRoleAccount: lead.verification.isRoleAccount,
              overallScore: lead.verification.overallScore,
              provider: lead.verification.provider,
            }
          : null,
      };
    });

    // Calculate stats for the current result set
    const stats = {
      total,
      withEmail: leads.filter((l) => l.email).length,
      withPhone: leads.filter((l) => l.phone).length,
      emailVerified: leads.filter(
        (l) => l.verification?.isValid === true
      ).length,
    };

    return NextResponse.json({
      success: true,
      data: transformedLeads,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
        stats,
      },
    });
  } catch (error) {
    console.error("LeadFinder search error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
