import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "timvideo — Quản lý tìm video affiliate",
  description: "Hệ thống quản lý quy trình nhân viên tìm video sản phẩm affiliate",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
