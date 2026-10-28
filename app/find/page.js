import FindClient from "./FindClient";

export const metadata = { title: "Найти помощь — SkillBarter" };

export default function FindPage({ searchParams }) {
  return <FindClient initialCat={searchParams?.cat || ""} />;
}
