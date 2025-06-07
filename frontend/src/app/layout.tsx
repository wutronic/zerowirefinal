import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zero Wire Video Generator",
  description: "Generate videos with AI-powered text-to-speech",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent extension conflicts
              if (typeof window !== 'undefined') {
                window.addEventListener('error', function(e) {
                  if (e.filename && e.filename.includes('content.js')) {
                    console.warn('Browser extension error detected and suppressed:', e.message);
                    e.preventDefault();
                    return false;
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
