/**
 * ImpressumScraper - Extracts B2B lead data from German website Impressum pages
 *
 * German websites are legally required to have an "Impressum" (imprint) page
 * containing company information, owner details, and contact information.
 */

import { SubscriptionTier } from "@prisma/client";
import { getTierConfig } from "../../lib/tier-config";

export interface ScrapedData {
  websiteUrl: string;
  companyName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  rawData: Record<string, unknown>;
}

export interface ScrapeOptions {
  tier: SubscriptionTier;
  timeout?: number;
  followRedirects?: boolean;
  userAgent?: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapedData;
  error?: string;
  scrapingDepth: string;
  timestamp: Date;
}

/**
 * Main Impressum Scraper class
 */
export class ImpressumScraper {
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly DEFAULT_USER_AGENT =
    "Mozilla/5.0 (compatible; LeadFinderBot/1.0; +https://leadfinder.de)";

  /**
   * Scrape a German website's Impressum page for lead data
   */
  async scrape(
    websiteUrl: string,
    options: ScrapeOptions
  ): Promise<ScrapeResult> {
    const startTime = Date.now();
    const tierConfig = getTierConfig(options.tier);

    try {
      // Validate URL
      const url = this.validateUrl(websiteUrl);
      if (!url) {
        return {
          success: false,
          error: "Invalid URL format",
          scrapingDepth: tierConfig.features.scrapingDepth,
          timestamp: new Date(),
        };
      }

      // Find Impressum page
      const impressumUrl = await this.findImpressumPage(url, options);
      if (!impressumUrl) {
        return {
          success: false,
          error: "Could not find Impressum page",
          scrapingDepth: tierConfig.features.scrapingDepth,
          timestamp: new Date(),
        };
      }

      // Fetch and parse Impressum content
      const html = await this.fetchPage(impressumUrl, options);
      const scrapedData = await this.parseImpressum(
        html,
        url,
        tierConfig.features.scrapingDepth
      );

      return {
        success: true,
        data: scrapedData,
        scrapingDepth: tierConfig.features.scrapingDepth,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        scrapingDepth: tierConfig.features.scrapingDepth,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate and normalize URL
   */
  private validateUrl(url: string): string | null {
    try {
      // Add protocol if missing
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Find the Impressum page on a website
   * Common patterns: /impressum, /imprint, /kontakt, footer links
   */
  private async findImpressumPage(
    baseUrl: string,
    options: ScrapeOptions
  ): Promise<string | null> {
    const commonPaths = [
      "/impressum",
      "/impressum.html",
      "/imprint",
      "/kontakt",
      "/contact",
      "/about",
      "/ueber-uns",
      "/datenschutz",
    ];

    // Try common paths first
    for (const path of commonPaths) {
      try {
        const testUrl = new URL(path, baseUrl).href;
        const response = await fetch(testUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(options.timeout || this.DEFAULT_TIMEOUT),
        });

        if (response.ok) {
          return testUrl;
        }
      } catch {
        continue;
      }
    }

    // If not found in common paths, try to parse homepage for impressum link
    try {
      const html = await this.fetchPage(baseUrl, options);
      const impressumLink = this.findImpressumLinkInHtml(html, baseUrl);
      if (impressumLink) {
        return impressumLink;
      }
    } catch {
      // If homepage fails, return null
    }

    return null;
  }

  /**
   * Find Impressum link in HTML content
   */
  private findImpressumLinkInHtml(html: string, baseUrl: string): string | null {
    // Look for links containing impressum-related keywords
    const keywords = [
      "impressum",
      "imprint",
      "kontakt",
      "contact",
      "datenschutz",
    ];

    // Simple regex to find href attributes (this is a basic implementation)
    // In production, you'd use a proper HTML parser like cheerio or jsdom
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1].toLowerCase();

      for (const keyword of keywords) {
        if (href.includes(keyword)) {
          try {
            return new URL(match[1], baseUrl).href;
          } catch {
            continue;
          }
        }
      }
    }

    return null;
  }

  /**
   * Fetch page content
   */
  private async fetchPage(
    url: string,
    options: ScrapeOptions
  ): Promise<string> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": options.userAgent || this.DEFAULT_USER_AGENT,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(options.timeout || this.DEFAULT_TIMEOUT),
      redirect: options.followRedirects !== false ? "follow" : "manual",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Parse Impressum HTML content to extract lead data
   * Depth determines how thorough the extraction is
   */
  private async parseImpressum(
    html: string,
    websiteUrl: string,
    depth: "basic" | "enhanced" | "deep"
  ): Promise<ScrapedData> {
    const data: ScrapedData = {
      websiteUrl,
      rawData: {},
    };

    // Extract email addresses
    const emails = this.extractEmails(html);
    if (emails.length > 0) {
      data.email = this.selectBestEmail(emails);
      data.rawData.allEmails = emails;
    }

    // Extract phone numbers (German format)
    const phones = this.extractPhones(html);
    if (phones.length > 0) {
      data.phone = phones[0]; // Take first phone number
      data.rawData.allPhones = phones;
    }

    if (depth === "basic") {
      // Basic extraction - just email and phone
      return data;
    }

    // Enhanced: Also extract company name and owner
    data.companyName = this.extractCompanyName(html);
    data.ownerName = this.extractOwnerName(html);

    if (depth === "enhanced") {
      return data;
    }

    // Deep: Also extract address and other metadata
    data.address = this.extractAddress(html);
    data.rawData.metadata = {
      pageTitle: this.extractPageTitle(html),
      hasVAT: this.hasVATNumber(html),
      hasTradeRegister: this.hasTradeRegister(html),
    };

    return data;
  }

  /**
   * Extract email addresses from HTML
   */
  private extractEmails(html: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = html.match(emailRegex) || [];

    // Filter out common false positives
    return matches.filter((email) => {
      const lower = email.toLowerCase();
      return (
        !lower.includes("example.com") &&
        !lower.includes("test.com") &&
        !lower.includes("@sentry") &&
        !lower.includes("@placeholder")
      );
    });
  }

  /**
   * Select the best email from a list (prefer info@, kontakt@, etc.)
   */
  private selectBestEmail(emails: string[]): string {
    const priorityPrefixes = [
      "info@",
      "kontakt@",
      "contact@",
      "office@",
      "mail@",
    ];

    for (const prefix of priorityPrefixes) {
      const match = emails.find((e) => e.toLowerCase().startsWith(prefix));
      if (match) return match;
    }

    return emails[0];
  }

  /**
   * Extract German phone numbers
   */
  private extractPhones(html: string): string[] {
    // German phone number patterns
    const patterns = [
      /\+49[\s\-]?\d{2,5}[\s\-]?\d{3,}[\s\-]?\d{2,}/g, // +49 format
      /0\d{2,5}[\s\-]?\d{3,}[\s\-]?\d{2,}/g, // 0xxx format
    ];

    const phones: string[] = [];

    for (const pattern of patterns) {
      const matches = html.match(pattern) || [];
      phones.push(...matches.map((p) => p.replace(/[\s\-]/g, "")));
    }

    return [...new Set(phones)]; // Remove duplicates
  }

  /**
   * Extract company name from Impressum
   */
  private extractCompanyName(html: string): string | undefined {
    // Look for common patterns
    const patterns = [
      /(?:Firma|Company|Unternehmen):\s*([^\n<]+)/i,
      /(?:Inhaber|Owner):\s*([^\n<]+)/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract owner/responsible person name
   */
  private extractOwnerName(html: string): string | undefined {
    const patterns = [
      /(?:Inhaber|Owner|Geschäftsführer|Managing Director):\s*([^\n<]+)/i,
      /(?:Verantwortlich|Responsible):\s*([^\n<]+)/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract address
   */
  private extractAddress(html: string): string | undefined {
    const patterns = [
      /(?:Adresse|Address|Anschrift):\s*([^\n<]+(?:\n[^\n<]+){0,2})/i,
      /\d{5}\s+[A-Za-zäöüÄÖÜß\s]+/i, // German postal code + city
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract page title
   */
  private extractPageTitle(html: string): string | undefined {
    const match = html.match(/<title>([^<]+)<\/title>/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Check if page contains VAT number
   */
  private hasVATNumber(html: string): boolean {
    return /(?:USt-IdNr|VAT|UID|Umsatzsteuer-ID)/i.test(html);
  }

  /**
   * Check if page contains trade register info
   */
  private hasTradeRegister(html: string): boolean {
    return /(?:Handelsregister|Trade Register|HRB|HRA)/i.test(html);
  }
}
