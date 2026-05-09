import type { Metadata } from "next";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const stored = localStorage.getItem("minyoi-theme-v1") || "system";
                  const dark = stored === "dark" || (stored === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
                  document.documentElement.classList.toggle("dark", dark);
                  document.documentElement.dataset.theme = dark ? "dark" : "light";
                } catch {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
