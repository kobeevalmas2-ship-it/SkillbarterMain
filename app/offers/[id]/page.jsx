import OfferDetails from "./OfferDetails";

export const metadata = { title: "Услуга · SkillBarter", description: "Подробности услуги и оплата временем" };

export default function OfferPage({ params }) {
  return <OfferDetails id={params.id} />;
}
