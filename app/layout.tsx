import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

const vt323 = VT323({
  variable: "--font-retro",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "FLAPPY BIRD",
  description: "Classic Flappy Bird arcade game with power-ups mode",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${pressStart2P.variable} ${vt323.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
