import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MintLeadBase",
  description: "Lead database with real-data sourcing",
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
