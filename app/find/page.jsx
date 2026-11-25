import FindClient from "./FindClient";
import { readSearchFilters } from "@/lib/search-filters.mjs";

export const metadata = { title: "Найти помощь — SkillBarter" };

export default async function FindPage({ searchParams }) {
  return <FindClient initialFilters={readSearchFilters(await searchParams)} />;
}
