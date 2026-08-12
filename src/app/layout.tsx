import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/shared/providers/query-provider";

export const metadata: Metadata = {
  title: "Solar3D",
  description: "Professional solar design and engineering platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
