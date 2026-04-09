import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Los Worm",
  description: "Build your worm empire. One dirt at a time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
