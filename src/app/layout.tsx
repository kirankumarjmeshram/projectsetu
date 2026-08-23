import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ProjectSetu",
  description: "Engineering foundation for bankable project reports.",
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
