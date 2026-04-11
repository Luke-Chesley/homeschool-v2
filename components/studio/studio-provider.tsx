"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { StudioAccess } from "@/lib/studio/types";

const STUDIO_STORAGE_KEY = "hsv2-studio-mode";

type StudioContextValue = {
  access: StudioAccess;
  isAvailable: boolean;
  isEnabled: boolean;
  activePanel: string | null;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  openPanel: (panelId: string) => void;
  closePanel: () => void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({
  access,
  children,
}: {
  access: StudioAccess;
  children: ReactNode;
}) {
  const [isEnabled, setIsEnabled] = useState(access.enabled);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  useEffect(() => {
    if (!access.enabled) {
      setIsEnabled(false);
      setActivePanel(null);
      return;
    }

    const saved = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (saved === "0") {
      setIsEnabled(false);
      return;
    }

    if (saved === "1") {
      setIsEnabled(true);
      return;
    }

    setIsEnabled(access.enabled);
  }, [access.enabled]);

  useEffect(() => {
    if (!access.enabled) {
      window.localStorage.removeItem(STUDIO_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STUDIO_STORAGE_KEY, isEnabled ? "1" : "0");
    if (!isEnabled) {
      setActivePanel(null);
    }
  }, [access.enabled, isEnabled]);

  const value = useMemo<StudioContextValue>(
    () => ({
      access,
      isAvailable: access.enabled,
      isEnabled: access.enabled && isEnabled,
      activePanel,
      setEnabled: (enabled) => setIsEnabled(enabled),
      toggleEnabled: () => setIsEnabled((current) => !current),
      openPanel: (panelId) => {
        if (!access.enabled || !isEnabled) {
          return;
        }
        setActivePanel(panelId);
      },
      closePanel: () => setActivePanel(null),
    }),
    [access, activePanel, isEnabled],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const context = useContext(StudioContext);

  if (!context) {
    throw new Error("useStudio must be used inside StudioProvider.");
  }

  return context;
}
