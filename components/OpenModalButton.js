"use client";
import { useOffers } from "./OffersContext";

export default function OpenModalButton({ children, className = "bg-b text-white" }) {
  const { openModal } = useOffers();
  return <button className={`btn ${className}`} onClick={openModal}>{children}</button>;
}
