"use client";

import { createContext, useContext, useState } from "react";

export type SignalScores = {
  hookStrength: number | null;
  specificity: number | null;
  clarity: number | null;
  emotionalResonance: number | null;
  callToAction: number | null;
};

type Ctx = {
  signalId: number;
  scores: SignalScores;
  setScores: (s: SignalScores) => void;
  currentAuthorId: number | null;
  setCurrentAuthorId: (id: number | null) => void;
};

const ScoresCtx = createContext<Ctx | null>(null);

export function ScoresProvider({
  children,
  signalId,
  initial,
  initialAuthorId,
}: {
  children: React.ReactNode;
  signalId: number;
  initial: SignalScores;
  initialAuthorId: number | null;
}) {
  const [scores, setScores] = useState<SignalScores>(initial);
  const [currentAuthorId, setCurrentAuthorId] = useState<number | null>(initialAuthorId);
  return (
    <ScoresCtx.Provider value={{ signalId, scores, setScores, currentAuthorId, setCurrentAuthorId }}>
      {children}
    </ScoresCtx.Provider>
  );
}

export function useScores() {
  const ctx = useContext(ScoresCtx);
  if (!ctx) throw new Error("useScores must be used inside ScoresProvider");
  return ctx;
}
