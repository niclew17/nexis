import { create } from "zustand";
import type { Startup, FilterCriteria } from "./types";

interface MapStore {
  selectedStartup: Startup | null;
  filters: FilterCriteria;
  mode: "2d" | "3d";
  isListening: boolean;
  voicePromptVisible: boolean;
  setSelectedStartup: (startup: Startup | null) => void;
  setFilters: (filters: FilterCriteria) => void;
  clearFilters: () => void;
  setMode: (mode: "2d" | "3d") => void;
  setIsListening: (listening: boolean) => void;
  setVoicePromptVisible: (visible: boolean) => void;
}

export const useMapStore = create<MapStore>()((set) => ({
  selectedStartup: null,
  filters: { stage: [], size: [], section: [] },
  mode: "2d",
  isListening: false,
  voicePromptVisible: false,
  setSelectedStartup: (startup) => set({ selectedStartup: startup }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: { stage: [], size: [], section: [] } }),
  setMode: (mode) => set({ mode }),
  setIsListening: (isListening) => set({ isListening }),
  setVoicePromptVisible: (voicePromptVisible) => set({ voicePromptVisible }),
}));
