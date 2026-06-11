import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "もくもく会 現地状況",
  description: "技術コミュニティのもくもく会 現地参加状況と会場状況のお知らせ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
