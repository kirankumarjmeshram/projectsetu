import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ProjectSetu",
  description: "Prepare bankable project reports and financial projections.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
