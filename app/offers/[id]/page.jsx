import OfferDetails from "./OfferDetails";

export const metadata = { title: "Услуга · SkillBarter", description: "Подробности услуги и оплата временем" };

export default async function OfferPage({ params }) {
  const { id } = await params;
  return <OfferDetails id={id} />;
}
