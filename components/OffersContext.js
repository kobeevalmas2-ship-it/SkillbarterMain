"use client";
import { createContext, useContext, useState } from "react";
import NewOfferModal from "./NewOfferModal";

const Ctx = createContext(null);
export const useOffers = () => useContext(Ctx);

export function OffersProvider({ children }) {
  const [mine, setMine] = useState([]);
  const [open, setOpen] = useState(false);
  const add = (o) => setMine((m) => [o, ...m]);
  return (
    <Ctx.Provider value={{ mine, add, openModal: () => setOpen(true), closeModal: () => setOpen(false) }}>
      {children}
      {open && <NewOfferModal />}
    </Ctx.Provider>
  );
}
