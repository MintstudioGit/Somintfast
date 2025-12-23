/**
 * EmailVerifier - Verifies email addresses using Reoon API or ML fallback
 *
 * Reoon API provides 97-98% accuracy for email verification
 * Falls back to basic ML verification if Reoon is unavailable
 */

import { VerificationStatus, SubscriptionTier } from "@prisma/client";
import { getVerificationAccuracy, hasEmailVerification } from "../../lib/tier-config";

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  isValid: boolean;
  isCatchAll: boolean;
  isDisposable: boolean;
  isRoleAccount: boolean;
  syntaxScore?: number;
  domainScore?: number;
  smtpScore?: number;
  overallScore?: number;
  provider: "reoon" | "ml-fallback" | "none";
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface VerificationOptions {
  tier: SubscriptionTier;
  timeout?: number;
}

/**
 * Reoon API Response Interface
 */
interface ReoonResponse {
  status: "success" | "error";
  data?: {
    email: string;
    valid: boolean;
    catch_all: boolean;
    disposable: boolean;
    role: boolean;
    score: {
      syntax: number;
      domain: number;
      smtp: number;
      overall: number;
    };
    details?: {
      mx_records: boolean;
      smtp_check: boolean;
      dns_valid: boolean;
    };
  };
  error?: string;
}

/**
 * Main Email Verifier class
 */
export class EmailVerifier {
  private readonly reoonApiKey: string | undefined;
  private readonly reoonApiUrl = "https://api.reoon.com/api/v1/verify";
  private readonly DEFAULT_TIMEOUT = 15000; // 15 seconds

  constructor() {
    this.reoonApiKey = process.env.REOON_API_KEY;
  }

  /**
   * Verify an email address
   */
  async verify(
    email: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    // Check if tier supports email verification
    if (!hasEmailVerification(options.tier)) {
      return {
        email,
        status: VerificationStatus.UNKNOWN,
        isValid: false,
        isCatchAll: false,
        isDisposable: false,
        isRoleAccount: false,
        provider: "none",
        error: "Email verification not available for this tier",
      };
    }

    // Validate email format first
    if (!this.isValidEmailFormat(email)) {
      return {
        email,
        status: VerificationStatus.INVALID,
        isValid: false,
        isCatchAll: false,
        isDisposable: false,
        isRoleAccount: false,
        syntaxScore: 0,
        overallScore: 0,
        provider: "none",
        error: "Invalid email format",
      };
    }

    try {
      // Try Reoon API first for premium tiers
      if (this.reoonApiKey && this.shouldUseReoon(options.tier)) {
        return await this.verifyWithReoon(email, options);
      }

      // Fallback to basic ML verification
      return await this.verifyWithMLFallback(email, options);
    } catch (error) {
      return {
        email,
        status: VerificationStatus.UNKNOWN,
        isValid: false,
        isCatchAll: false,
        isDisposable: false,
        isRoleAccount: false,
        provider: "none",
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  }

  /**
   * Validate email format using regex
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Determine if Reoon should be used for this tier
   */
  private shouldUseReoon(tier: SubscriptionTier): boolean {
    // Reoon for TEAM and above
    return tier === "TEAM" || tier === "PROFESSIONAL" || tier === "ENTERPRISE";
  }

  /**
   * Verify email using Reoon API
   */
  private async verifyWithReoon(
    email: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    if (!this.reoonApiKey) {
      throw new Error("Reoon API key not configured");
    }

    try {
      const response = await fetch(this.reoonApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.reoonApiKey}`,
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(options.timeout || this.DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Reoon API error: ${response.status}`);
      }

      const data: ReoonResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || "Reoon verification failed");
      }

      if (!data.data) {
        throw new Error("Invalid Reoon response");
      }

      // Map Reoon response to our format
      const isValid = data.data.valid;
      const overallScore = data.data.score.overall;

      let status: VerificationStatus;
      if (isValid && overallScore >= 80) {
        status = VerificationStatus.VALID;
      } else if (!isValid || overallScore < 50) {
        status = VerificationStatus.INVALID;
      } else if (data.data.catch_all || data.data.role) {
        status = VerificationStatus.RISKY;
      } else {
        status = VerificationStatus.RISKY;
      }

      return {
        email,
        status,
        isValid,
        isCatchAll: data.data.catch_all,
        isDisposable: data.data.disposable,
        isRoleAccount: data.data.role,
        syntaxScore: data.data.score.syntax,
        domainScore: data.data.score.domain,
        smtpScore: data.data.score.smtp,
        overallScore,
        provider: "reoon",
        rawResponse: data.data as Record<string, unknown>,
      };
    } catch (error) {
      // If Reoon fails, fallback to ML
      console.warn("Reoon verification failed, falling back to ML:", error);
      return await this.verifyWithMLFallback(email, options);
    }
  }

  /**
   * Verify email using ML-based fallback
   * This is a simplified implementation - in production, you'd use a proper ML model
   */
  private async verifyWithMLFallback(
    email: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    const [localPart, domain] = email.split("@");

    // Check disposable email domains
    const isDisposable = this.isDisposableDomain(domain);

    // Check role accounts
    const isRoleAccount = this.isRoleAccount(localPart);

    // Perform basic DNS check
    const domainValid = await this.checkDomainExists(domain);

    // Calculate scores
    const syntaxScore = 100; // Already validated format
    const domainScore = domainValid ? 90 : 20;

    // Simple SMTP score estimation (would need actual SMTP check in production)
    const smtpScore = domainValid && !isDisposable ? 75 : 30;

    const overallScore = Math.round(
      (syntaxScore * 0.2 + domainScore * 0.4 + smtpScore * 0.4)
    );

    const isValid = overallScore >= 60 && !isDisposable;

    let status: VerificationStatus;
    if (isValid && overallScore >= 70) {
      status = VerificationStatus.VALID;
    } else if (!isValid || overallScore < 40) {
      status = VerificationStatus.INVALID;
    } else {
      status = VerificationStatus.RISKY;
    }

    return {
      email,
      status,
      isValid,
      isCatchAll: false, // Can't detect with basic verification
      isDisposable,
      isRoleAccount,
      syntaxScore,
      domainScore,
      smtpScore,
      overallScore,
      provider: "ml-fallback",
    };
  }

  /**
   * Check if domain is in disposable email list
   */
  private isDisposableDomain(domain: string): boolean {
    const disposableDomains = [
      "tempmail.com",
      "guerrillamail.com",
      "mailinator.com",
      "10minutemail.com",
      "trashmail.com",
      "throwaway.email",
      "temp-mail.org",
      "fakeinbox.com",
      "maildrop.cc",
      "yopmail.com",
    ];

    return disposableDomains.some((d) => domain.toLowerCase().includes(d));
  }

  /**
   * Check if email is a role account (info@, admin@, etc.)
   */
  private isRoleAccount(localPart: string): boolean {
    const roleKeywords = [
      "info",
      "admin",
      "support",
      "sales",
      "contact",
      "hello",
      "help",
      "noreply",
      "no-reply",
      "service",
      "office",
      "mail",
      "webmaster",
      "postmaster",
    ];

    const lowerLocal = localPart.toLowerCase();
    return roleKeywords.some((keyword) => lowerLocal === keyword);
  }

  /**
   * Check if domain exists (basic DNS check)
   */
  private async checkDomainExists(domain: string): Promise<boolean> {
    try {
      // In a real implementation, you'd check DNS MX records
      // For now, we'll do a simple HTTP check
      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok || response.status < 500;
    } catch {
      // Domain might not have a website but could still have MX records
      // In production, use proper DNS lookup
      return true; // Assume valid to avoid false negatives
    }
  }

  /**
   * Batch verify multiple emails
   */
  async verifyBatch(
    emails: string[],
    options: VerificationOptions
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    // Process in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((email) => this.verify(email, options))
      );
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
