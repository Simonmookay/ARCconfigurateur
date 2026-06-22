import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const display = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Configurateur · A.R.C ALUMINIUM",
  description: "Configurateur de devis fourniture seule pour menuiseries aluminium",
  icons: { icon: "/arc-logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
