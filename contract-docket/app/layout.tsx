import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "계약 파일 | 전자계약 관리",
  description: "계약 초안부터 서명 회신까지 관리하는 전자계약 작업 공간",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
