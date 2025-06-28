
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'FlowKeep',
  description: '把活動變成故事，把收支寫成風景',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap&text=把活動變成故事，把收支寫成風景" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col overflow-x-hidden" suppressHydrationWarning={true}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
