import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    metadataBase: new URL(baseUrl),
    title: "RepoScribe Docs · Turn repositories into readable guides",
    description:
      "Documentation for RepoScribe, the developer-first documentation generator for React, TypeScript, Java, and Spring Boot projects.",
    openGraph: {
      type: "website",
      title: "RepoScribe Docs",
      description: "Readable developer documentation, straight from the code.",
      images: [{ url: `${baseUrl}/og.png`, width: 1200, height: 630, alt: "RepoScribe documentation" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "RepoScribe Docs",
      description: "Readable developer documentation, straight from the code.",
      images: [`${baseUrl}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
