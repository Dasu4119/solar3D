import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solar3D",
  description: "Professional solar design and engineering platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
