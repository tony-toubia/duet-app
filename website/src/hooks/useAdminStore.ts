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

  // Loading states
  isLoadingStats: boolean;
  isLoadingSegments: boolean;
  isLoadingCampaigns: boolean;
  isRefreshingSegments: boolean;

  // Actions
  loadStats: () => Promise<void>;
  loadSegments: () => Promise<void>;
  loadCampaigns: () => Promise<void>;
  refreshSegments: () => Promise<void>;
  createCampaign: (data: any) => Promise<string>;
  sendCampaign: (id: string) => Promise<void>;
  deleteCustomSegment: (id: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: null,
  segments: [],
  campaigns: [],
  isLoadingStats: false,
  isLoadingSegments: false,
  isLoadingCampaigns: false,
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

  deleteCustomSegment: async (id) => {
    await admin.deleteCustomSegment(id);
    await get().loadSegments();
  },
}));
