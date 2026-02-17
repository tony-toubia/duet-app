import { create } from 'zustand';
import { friendsService, FriendEntry, RecentConnection } from '@/services/FriendsService';
import { presenceService } from '@/services/PresenceService';

interface FriendsState {
  friends: Record<string, FriendEntry>;
  recentConnections: Record<string, RecentConnection>;
  statuses: Record<string, { state: 'online' | 'offline'; lastSeen: number }>;
  searchResult: { uid: string; displayName: string; avatarUrl: string | null } | null;
  isSearching: boolean;
  friendCode: string | null;
  isFriendCodeLoading: boolean;

  pendingRequests: () => Array<{ uid: string } & FriendEntry>;
  acceptedFriends: () => Array<{ uid: string } & FriendEntry>;

  subscribe: () => () => void;
  sendFriendRequest: (targetUid: string) => Promise<void>;
  acceptFriendRequest: (friendUid: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  searchByEmail: (email: string) => Promise<void>;
  lookupFriendCode: (code: string) => Promise<void>;
  loadFriendCode: () => Promise<void>;
  getOrCreateFriendCode: () => Promise<string>;
  clearSearch: () => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: {},
  recentConnections: {},
  statuses: {},
  searchResult: null,
  isSearching: false,
  friendCode: null,
  isFriendCodeLoading: false,

  pendingRequests: () => {
    const { friends } = get();
    const uid = require('@react-native-firebase/auth').default().currentUser?.uid;
    return Object.entries(friends)
      .filter(([, f]) => f.status === 'pending' && f.initiatedBy !== uid)
      .map(([uid, f]) => ({ uid, ...f }));
  },

  acceptedFriends: () => {
    const { friends } = get();
    return Object.entries(friends)
      .filter(([, f]) => f.status === 'accepted')
      .map(([uid, f]) => ({ uid, ...f }));
  },

  subscribe: () => {
    const unsubs: (() => void)[] = [];

    const unsubFriends = friendsService.subscribeFriends((friends) => {
      set({ friends });

      const acceptedUids = Object.entries(friends)
        .filter(([, f]) => f.status === 'accepted')
        .map(([uid]) => uid);

      if (acceptedUids.length > 0) {
        const unsubStatuses = presenceService.subscribeToStatuses(acceptedUids, (statuses) => {
          set({ statuses });
        });
        unsubs.push(unsubStatuses);
      }
    });
    unsubs.push(unsubFriends);

    const unsubRecent = friendsService.subscribeRecentConnections((connections) => {
      set({ recentConnections: connections });
    });
    unsubs.push(unsubRecent);

    return () => unsubs.forEach((u) => u());
  },

  sendFriendRequest: async (targetUid: string) => {
    await friendsService.sendFriendRequest(targetUid);
  },

  acceptFriendRequest: async (friendUid: string) => {
    await friendsService.acceptFriendRequest(friendUid);
  },

  removeFriend: async (friendUid: string) => {
    await friendsService.removeFriend(friendUid);
  },

  searchByEmail: async (email: string) => {
    set({ isSearching: true, searchResult: null });
    try {
      const result = await friendsService.searchByEmail(email);
      set({ searchResult: result, isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  lookupFriendCode: async (code: string) => {
    set({ isSearching: true, searchResult: null });
    try {
      const result = await friendsService.lookupFriendCode(code);
      set({ searchResult: result, isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  loadFriendCode: async () => {
    set({ isFriendCodeLoading: true });
    try {
      const code = await friendsService.getFriendCode();
      set({ friendCode: code, isFriendCodeLoading: false });
    } catch {
      set({ isFriendCodeLoading: false });
    }
  },

  getOrCreateFriendCode: async () => {
    set({ isFriendCodeLoading: true });
    try {
      const code = await friendsService.getOrCreateFriendCode();
      set({ friendCode: code, isFriendCodeLoading: false });
      return code;
    } catch (e) {
      set({ isFriendCodeLoading: false });
      throw e;
    }
  },

  clearSearch: () => {
    set({ searchResult: null, isSearching: false });
  },
}));
