import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnchorFi — Bitcoin-Anchored Lending on Stacks",
  description:
    "Deposit STX as collateral, borrow aUSD against it. All logic on-chain in Clarity smart contracts secured by Bitcoin.",
  openGraph: {
    title: "AnchorFi",
    description: "Bitcoin-anchored lending protocol on Stacks",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-[#0a0c10] text-[#e8eaf0] antialiased">
        {children}
      </body>
    </html>
  );
}
