import WalletClient from "./WalletClient";

export const metadata = { title: "Кошелёк и история транзакций · SkillBarter" };

export default async function WalletPage({ searchParams }) {
  const query = await searchParams;
  return <WalletClient initialRecipient={typeof query.recipient === "string" ? query.recipient : ""}
    initialMinutes={typeof query.minutes === "string" ? query.minutes : "60"}
    initialService={typeof query.service === "string" ? query.service.slice(0, 200) : ""} />;
}
