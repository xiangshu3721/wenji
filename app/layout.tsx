import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "问己 — AI 深度自我探索",
  description: "问至无问，答案自明。相比答案，好的问题更重要——镜像导师以空静爱陪你看见自己。",
  applicationName: "问己",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f4ef",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
