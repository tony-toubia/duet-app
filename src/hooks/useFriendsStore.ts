import { create } from 'zustand';
import { friendsService, FriendEntry, RecentConnection } from '@/services/FriendsService';
import { presenceService } from '@/services/PresenceService';

interface FriendsState {
  friends: Record<string, FriendEntry>;
  recentConnections: Record<string, RecentConnection>;
  statuses: Record<string, { state: 'online' | 'offline'; lastSeen: number }>;
  searchResults: Array<{ uid: string; displayName: string; avatarUrl: string | null }>;
  isSearching: boolean;

  // Computed
  pendingRequests: () => Array<{ uid: string } & FriendEntry>;
  acceptedFriends: () => Array<{ uid: string } & FriendEntry>;

  // Actions
  subscribe: () => () => void;
  sendFriendRequest: (targetUid: string) => Promise<void>;
  acceptFriendRequest: (friendUid: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: {},
  recentConnections: {},
  statuses: {},
  searchResults: [],
  isSearching: false,

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

    // Subscribe to friends list
    const unsubFriends = friendsService.subscribeFriends((friends) => {
      set({ friends });

      // Subscribe to presence for all accepted friends
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

    // Subscribe to recent connections
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

  searchUsers: async (query: string) => {
    set({ isSearching: true });
    try {
      const results = await friendsService.searchUsers(query);
      set({ searchResults: results, isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], isSearching: false });
  },
}));
