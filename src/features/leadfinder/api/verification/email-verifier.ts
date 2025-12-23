/**
 * EmailVerifier - Verifies email addresses using Reoon API or SMTP fallback
 *
 * Reoon API provides 97-98% accuracy for email verification
 * Falls back to free SMTP verification for Solo/Starter tiers
 */

import { VerificationStatus, SubscriptionTier } from "@prisma/client";
import { getVerificationAccuracy, hasEmailVerification, getVerificationMethod } from "../../lib/tier-config";
import { SMTPVerifier } from "../datasources/smtp-verifier";

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
  provider: "reoon" | "smtp" | "none";
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
  private readonly smtpVerifier: SMTPVerifier;

  constructor() {
    this.reoonApiKey = process.env.REOON_API_KEY;
    this.smtpVerifier = new SMTPVerifier();
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

      // Fallback to free SMTP verification
      return await this.verifyWithSMTP(email, options);
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
      // If Reoon fails, fallback to SMTP
      console.warn("Reoon verification failed, falling back to SMTP:", error);
      return await this.verifyWithSMTP(email, options);
    }
  }

  /**
   * Verify email using free SMTP verification
   * Uses DNS MX record checks and disposable domain detection
   */
  private async verifyWithSMTP(
    email: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    // Use SMTP verifier for free verification
    const smtpResult = await this.smtpVerifier.verify(email, false);

    // Map SMTP result to our VerificationResult format
    let status: VerificationStatus;
    if (smtpResult.valid && smtpResult.confidence >= 70) {
      status = VerificationStatus.VALID;
    } else if (!smtpResult.valid || smtpResult.confidence < 40) {
      status = VerificationStatus.INVALID;
    } else {
      status = VerificationStatus.RISKY;
    }

    return {
      email: smtpResult.email,
      status,
      isValid: smtpResult.valid,
      isCatchAll: false, // SMTP verifier doesn't detect catch-all
      isDisposable: smtpResult.disposable,
      isRoleAccount: smtpResult.roleAccount,
      syntaxScore: smtpResult.syntaxValid ? 100 : 0,
      domainScore: smtpResult.mxRecordsFound ? 90 : (smtpResult.domainExists ? 50 : 0),
      smtpScore: smtpResult.mxRecordsFound ? 85 : 20,
      overallScore: smtpResult.confidence,
      provider: "smtp",
    };
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
