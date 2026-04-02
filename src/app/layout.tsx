import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DragDropProvider } from "@/components/drag-drop-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResumeRank — Rank Resumes by Job Fit",
  description: "Paste a job description, upload resumes, get ranked results instantly. Free and fast resume screening tool for recruiters and hiring managers.",
  keywords: ["resume screening", "resume ranking", "ATS", "candidate matching", "HR tool", "recruitment", "hiring"],
  authors: [{ name: "ResumeRank" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <DragDropProvider>
          {children}
        </DragDropProvider>
        <Toaster />
      </body>
    </html>
  );
}
