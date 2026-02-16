'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { Spinner } from '@/components/ui/Spinner';

export function FriendsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ uid: string; name: string } | null>(null);

  const {
    friends,
    statuses,
    searchResults,
    isSearching,
    pendingRequests,
    acceptedFriends,
    subscribe,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    searchUsers,
    clearSearch,
  } = useFriendsStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setError(null);
    try {
      await searchUsers(searchQuery);
    } catch (err: any) {
      setError(err?.message || 'Search failed.');
    }
  };

  const handleSendRequest = async (uid: string) => {
    setError(null);
    try {
      await sendFriendRequest(uid);
      clearSearch();
      setSearchQuery('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send request.');
    }
  };

  const handleAccept = async (uid: string) => {
    try {
      await acceptFriendRequest(uid);
    } catch (err: any) {
      setError(err?.message || 'Failed to accept request.');
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeFriend(removeTarget.uid);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove friend.');
    }
    setRemoveTarget(null);
  };

  const pending = pendingRequests();
  const accepted = acceptedFriends();

  return (
    <div className="min-h-screen bg-background text-text-main">
      {/* Header */}
      <div className="flex items-center px-5 pt-6 pb-4">
        <button
          onClick={() => router.push('/app')}
          className="text-primary text-base font-medium"
        >
          Back
        </button>
        <h1 className="text-xl font-bold ml-4">Friends</h1>
      </div>

      <div className="px-5 flex flex-col gap-4 max-w-lg mx-auto w-full pb-8">
        {error && (
          <div className="bg-danger/15 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="flex-1 bg-white/10 border border-glass-border rounded-xl py-3 px-4 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={handleSearch}
            disabled={searchQuery.length < 2 || isSearching}
            className="bg-primary text-white rounded-xl py-3 px-5 font-semibold disabled:opacity-50 hover:bg-primary-light transition-colors"
          >
            {isSearching ? <Spinner size="sm" /> : 'Search'}
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted">Search Results</h2>
            {searchResults.map((user) => {
              const isFriend = !!friends[user.uid];
              return (
                <div key={user.uid} className="flex items-center bg-glass border border-glass-border rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold mr-3">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{user.displayName}</span>
                  {isFriend ? (
                    <span className="text-text-muted text-sm">Added</span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(user.uid)}
                      className="bg-primary text-white rounded-lg py-1.5 px-3 text-sm font-semibold hover:bg-primary-light transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pending requests */}
        {pending.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted">Pending Requests</h2>
            {pending.map((req) => (
              <div key={req.uid} className="flex items-center bg-glass border border-glass-border rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold mr-3">
                  {req.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 font-medium">{req.displayName}</span>
                <button
                  onClick={() => handleAccept(req.uid)}
                  className="bg-success text-white rounded-lg py-1.5 px-3 text-sm font-semibold mr-2"
                >
                  Accept
                </button>
                <button
                  onClick={() => setRemoveTarget({ uid: req.uid, name: req.displayName })}
                  className="text-text-muted text-sm hover:text-danger transition-colors"
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted">
            Friends {accepted.length > 0 && `(${accepted.length})`}
          </h2>
          {accepted.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">
              No friends yet. Search for users above to add friends.
            </p>
          ) : (
            accepted.map((friend) => {
              const status = statuses[friend.uid];
              const isOnline = status?.state === 'online';
              return (
                <div key={friend.uid} className="flex items-center bg-glass border border-glass-border rounded-xl p-3">
                  <div className="relative mr-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold">
                      {friend.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                        isOnline ? 'bg-success' : 'bg-gray-500'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{friend.displayName}</span>
                    <span className={`text-xs ml-2 ${isOnline ? 'text-success' : 'text-text-muted'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <button
                    onClick={() => setRemoveTarget({ uid: friend.uid, name: friend.displayName })}
                    className="text-text-muted text-sm hover:text-danger transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={() => setRemoveTarget(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Remove Friend</h2>
            <p className="text-sm text-[#6b6b80] mb-6">
              Remove {removeTarget.name} from your friends list?
            </p>
            <button
              onClick={handleConfirmRemove}
              className="bg-danger text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-red-600 transition-colors"
            >
              Remove
            </button>
            <button
              onClick={() => setRemoveTarget(null)}
              className="text-[#9a9aaa] text-[15px] font-semibold py-2 px-6"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
