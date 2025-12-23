/**
 * Prisma Database Seeder
 * Creates sample data for development and testing
 */

import { PrismaClient, SubscriptionTier, VerificationStatus, LeadStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data (be careful in production!)
  console.log("🗑️  Clearing existing data...");
  await prisma.emailVerification.deleteMany();
  await prisma.scrapedLead.deleteMany();
  await prisma.qualityMetrics.deleteMany();
  await prisma.lead.deleteMany();

  // Seed Original Leads
  console.log("📝 Seeding original leads...");
  const leads = await prisma.lead.createMany({
    data: [
      {
        companyName: "Acme GmbH",
        website: "https://acme-example.de",
        industry: "Software",
        location: "Berlin, Germany",
        status: LeadStatus.NEW,
        owner: "Sales Team",
        notes: "Potential enterprise customer",
      },
      {
        companyName: "TechStart Berlin",
        website: "https://techstart-example.de",
        industry: "Technology",
        location: "Berlin, Germany",
        status: LeadStatus.CONTACTED,
        owner: "John Doe",
        notes: "Follow up next week",
      },
      {
        companyName: "Deutsche Marketing AG",
        website: "https://marketing-example.de",
        industry: "Marketing",
        location: "Munich, Germany",
        status: LeadStatus.QUALIFIED,
        owner: "Jane Smith",
      },
    ],
  });
  console.log(`✅ Created ${leads.count} original leads`);

  // Seed Scraped Leads with Email Verifications
  console.log("🔍 Seeding scraped leads...");

  const scrapedLeadData = [
    {
      websiteUrl: "https://example-company-1.de",
      companyName: "Example Company GmbH",
      ownerName: "Max Mustermann",
      email: "info@example-company-1.de",
      phone: "+49 30 12345678",
      address: "Beispielstraße 1, 10115 Berlin",
      tier: SubscriptionTier.ENTERPRISE,
      rawData: JSON.stringify({
        hasVAT: true,
        hasTradeRegister: true,
        pageTitle: "Impressum - Example Company GmbH",
      }),
    },
    {
      websiteUrl: "https://example-company-2.de",
      companyName: "Another Business Ltd",
      ownerName: "Erika Musterfrau",
      email: "kontakt@example-company-2.de",
      phone: "+49 89 98765432",
      address: "Musterweg 42, 80331 München",
      tier: SubscriptionTier.TEAM,
      rawData: JSON.stringify({
        hasVAT: true,
        hasTradeRegister: false,
      }),
    },
    {
      websiteUrl: "https://startup-example.de",
      companyName: "Cool Startup GmbH",
      ownerName: "Hans Schmidt",
      email: "hello@startup-example.de",
      phone: "+49 40 55566677",
      address: "Innovationsplatz 5, 20095 Hamburg",
      tier: SubscriptionTier.PROFESSIONAL,
      rawData: JSON.stringify({
        hasVAT: false,
        pageTitle: "Impressum - Cool Startup",
      }),
    },
    {
      websiteUrl: "https://consulting-firm.de",
      companyName: "Consulting Experts AG",
      ownerName: "Dr. Anna Weber",
      email: "info@consulting-firm.de",
      phone: "+49 69 11223344",
      address: "Beratungsstraße 10, 60311 Frankfurt",
      tier: SubscriptionTier.STARTER,
      rawData: JSON.stringify({
        hasVAT: true,
        hasTradeRegister: true,
      }),
    },
    {
      websiteUrl: "https://small-business.de",
      companyName: "Small Business e.K.",
      ownerName: "Peter Klein",
      email: "peter@small-business.de",
      phone: "+49 711 99887766",
      tier: SubscriptionTier.SOLO,
      rawData: JSON.stringify({}),
    },
  ];

  for (const data of scrapedLeadData) {
    const scrapedLead = await prisma.scrapedLead.create({
      data,
    });

    // Add email verification for leads with emails
    if (data.email) {
      const highTiers: SubscriptionTier[] = [
        SubscriptionTier.TEAM,
        SubscriptionTier.PROFESSIONAL,
        SubscriptionTier.ENTERPRISE,
      ];
      const isHighTier = highTiers.includes(data.tier);

      await prisma.emailVerification.create({
        data: {
          scrapedLeadId: scrapedLead.id,
          email: data.email,
          status: isHighTier ? VerificationStatus.VALID : VerificationStatus.RISKY,
          isValid: isHighTier,
          isCatchAll: false,
          isDisposable: false,
          isRoleAccount: data.email.startsWith("info@") || data.email.startsWith("kontakt@"),
          syntaxScore: 100,
          domainScore: isHighTier ? 95 : 75,
          smtpScore: isHighTier ? 90 : 65,
          overallScore: isHighTier ? 95 : 70,
          provider: isHighTier ? "reoon" : "ml-fallback",
          rawResponse: JSON.stringify({
            timestamp: new Date().toISOString(),
            tier: data.tier,
          }),
        },
      });
    }
  }
  console.log(`✅ Created ${scrapedLeadData.length} scraped leads with verifications`);

  // Seed Quality Metrics
  console.log("📊 Seeding quality metrics...");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const metricsData = [
    {
      tier: SubscriptionTier.SOLO,
      totalScraped: 120,
      emailsFound: 85,
      emailsVerified: 0,
      emailsValid: 0,
      emailFoundRate: 70.83,
      emailValidRate: 0,
      overallQualityScore: 28.33,
    },
    {
      tier: SubscriptionTier.STARTER,
      totalScraped: 450,
      emailsFound: 380,
      emailsVerified: 380,
      emailsValid: 323,
      emailFoundRate: 84.44,
      emailValidRate: 85.0,
      overallQualityScore: 84.78,
    },
    {
      tier: SubscriptionTier.TEAM,
      totalScraped: 1200,
      emailsFound: 1080,
      emailsVerified: 1080,
      emailsValid: 1026,
      emailFoundRate: 90.0,
      emailValidRate: 95.0,
      overallQualityScore: 93.0,
    },
    {
      tier: SubscriptionTier.PROFESSIONAL,
      totalScraped: 3500,
      emailsFound: 3255,
      emailsVerified: 3255,
      emailsValid: 3157,
      emailFoundRate: 93.0,
      emailValidRate: 97.0,
      overallQualityScore: 95.4,
    },
    {
      tier: SubscriptionTier.ENTERPRISE,
      totalScraped: 12000,
      emailsFound: 11280,
      emailsVerified: 11280,
      emailsValid: 11054,
      emailFoundRate: 94.0,
      emailValidRate: 98.0,
      overallQualityScore: 96.4,
    },
  ];

  for (const data of metricsData) {
    await prisma.qualityMetrics.create({
      data: {
        ...data,
        periodStart: thirtyDaysAgo,
        periodEnd: now,
      },
    });
  }
  console.log(`✅ Created ${metricsData.length} quality metrics records`);

  console.log("✨ Database seeding complete!");
  console.log("\n📈 Summary:");
  console.log(`  - ${leads.count} original leads`);
  console.log(`  - ${scrapedLeadData.length} scraped leads`);
  console.log(`  - ${scrapedLeadData.filter(d => d.email).length} email verifications`);
  console.log(`  - ${metricsData.length} quality metrics records`);
  console.log("\n🚀 You can now run: npm run dev");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
