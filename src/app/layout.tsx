import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { TRPCProvider } from "@/components/providers";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlackVault | Your AI Agents. Under Control.",
  description:
    "Manage API keys, track costs, and control your AI agents from a single dashboard. The mission control your AI agents never knew they needed.",
  keywords: [
    "AI agents",
    "API key management",
    "AI cost tracking",
    "agent observability",
    "LLM dashboard",
  ],
  openGraph: {
    title: "BlackVault | Your AI Agents. Under Control.",
    description:
      "Manage API keys, track costs, and control your AI agents from a single dashboard.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#00FF88",
          colorBackground: "#0A0A0A",
          colorInputBackground: "#111111",
          colorInputText: "#FAFAFA",
        },
      }}
    >
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-void-0 text-text-primary`}
        >
          <TRPCProvider>
            {children}
          </TRPCProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "#0A0A0A",
                border: "1px solid #222222",
                color: "#FAFAFA",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
