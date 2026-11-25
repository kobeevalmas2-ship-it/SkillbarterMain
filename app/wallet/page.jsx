import WalletClient from "./WalletClient";

export const metadata = { title: "Кошелёк и история транзакций · SkillBarter" };

export default function WalletPage({ searchParams }) {
  return <WalletClient initialRecipient={typeof searchParams.recipient === "string" ? searchParams.recipient : ""}
    initialMinutes={typeof searchParams.minutes === "string" ? searchParams.minutes : "60"}
    initialService={typeof searchParams.service === "string" ? searchParams.service.slice(0, 200) : ""} />;
}
