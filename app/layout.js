import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OffersProvider } from "@/components/OffersContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
const head = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["600", "800"], variable: "--font-head" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-mono" });

export const metadata = { title: "SkillBarter", description: "Обмен навыками за время" };

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${inter.variable} ${head.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <OffersProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </OffersProvider>
      </body>
    </html>
  );
}
