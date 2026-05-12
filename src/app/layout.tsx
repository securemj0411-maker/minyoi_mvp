import type { Metadata } from "next";
import AppFooter from "@/components/app-footer";
import AppNav from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "미뇨이 MVP",
  description: "중고 리셀갭 후보 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppNav />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
