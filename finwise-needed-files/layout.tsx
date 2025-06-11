import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finwise - AI Personal Finance Assistant",
  description:
    "Smart financial management with AI-powered insights. Track expenses, manage cash flow, and get personalized financial advice.",
  keywords: [
    "finance",
    "AI",
    "budgeting",
    "expense tracking",
    "financial advisor",
  ],
  authors: [{ name: "Finwise Team" }],
  openGraph: {
    title: "Finwise - AI Personal Finance Assistant",
    description: "Smart financial management with AI-powered insights",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finwise - AI Personal Finance Assistant",
    description: "Smart financial management with AI-powered insights",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
