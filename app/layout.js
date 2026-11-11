import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OffersProvider } from "@/components/OffersContext";
import { AuthProvider } from "@/components/AuthContext";
import { WalletProvider } from "@/components/WalletContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/components/LanguageContext";
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, normalizeLanguage, translate } from "@/lib/i18n.mjs";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
const head = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["600", "800"], variable: "--font-head" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono" });

export function generateMetadata() {
  const language = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  return { title: "SkillBarter", description: translate(language, "Обмен навыками за время") };
}

export default function RootLayout({ children }) {
  const language = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  return (
    <html lang={language} className={`${inter.variable} ${head.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <LanguageProvider initialLanguage={language}>
          <AuthProvider>
            <WalletProvider>
              <OffersProvider>
                <Header />
                <main>{children}</main>
                <Footer />
              </OffersProvider>
            </WalletProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
