import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadFinder - B2B Lead Scraping & Email Verification",
  description: "Scrape B2B lead data from German websites with 97-98% email verification accuracy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
