import { create } from 'zustand';
import * as admin from '@/services/AdminService';

interface AdminState {
  // Data
  stats: {
    userCount: number;
    sentCampaigns: number;
    emailsToday: number;
    emailDailyLimit: number;
    segmentSummary: { id: string; name: string; memberCount: number }[];
  } | null;
  segments: any[];
  campaigns: any[];
  journeys: any[];

  // Loading states
  isLoadingStats: boolean;
  isLoadingSegments: boolean;
  isLoadingCampaigns: boolean;
  isLoadingJourneys: boolean;
  isRefreshingSegments: boolean;

  // Actions
  loadStats: () => Promise<void>;
  loadSegments: () => Promise<void>;
  loadCampaigns: () => Promise<void>;
  loadJourneys: () => Promise<void>;
  refreshSegments: () => Promise<void>;
  createCampaign: (data: any) => Promise<string>;
  sendCampaign: (id: string) => Promise<void>;
  createJourney: (data: any) => Promise<string>;
  updateJourney: (id: string, data: any) => Promise<void>;
  deleteJourney: (id: string) => Promise<void>;
  deleteCustomSegment: (id: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: null,
  segments: [],
  campaigns: [],
  journeys: [],
  isLoadingStats: false,
  isLoadingSegments: false,
  isLoadingCampaigns: false,
  isLoadingJourneys: false,
  isRefreshingSegments: false,

  loadStats: async () => {
    set({ isLoadingStats: true });
    try {
      const data = await admin.fetchStats();
      set({ stats: data });
    } finally {
      set({ isLoadingStats: false });
    }
  },

  loadSegments: async () => {
    set({ isLoadingSegments: true });
    try {
      const { segments } = await admin.fetchSegments();
      set({ segments });
    } finally {
      set({ isLoadingSegments: false });
    }
  },

  loadCampaigns: async () => {
    set({ isLoadingCampaigns: true });
    try {
      const { campaigns } = await admin.fetchCampaigns();
      set({ campaigns });
    } finally {
      set({ isLoadingCampaigns: false });
    }
  },

  refreshSegments: async () => {
    set({ isRefreshingSegments: true });
    try {
      await admin.refreshSegments();
      await get().loadSegments();
      await get().loadStats();
    } finally {
      set({ isRefreshingSegments: false });
    }
  },

  createCampaign: async (data) => {
    const result = await admin.createCampaign(data);
    await get().loadCampaigns();
    return result.id;
  },

  sendCampaign: async (id) => {
    await admin.sendCampaign(id);
    await get().loadCampaigns();
  },

  loadJourneys: async () => {
    set({ isLoadingJourneys: true });
    try {
      const { journeys } = await admin.fetchJourneys();
      set({ journeys });
    } finally {
      set({ isLoadingJourneys: false });
    }
  },

  createJourney: async (data) => {
    const result = await admin.createJourney(data);
    await get().loadJourneys();
    return result.id;
  },

  updateJourney: async (id, data) => {
    await admin.updateJourney(id, data);
    await get().loadJourneys();
  },

  deleteJourney: async (id) => {
    await admin.deleteJourney(id);
    await get().loadJourneys();
  },

  deleteCustomSegment: async (id) => {
    await admin.deleteCustomSegment(id);
    await get().loadSegments();
  },
}));
