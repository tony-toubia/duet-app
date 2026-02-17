'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Spinner } from '@/components/ui/Spinner';

type SearchTab = 'email' | 'code';

export function FriendsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTab, setSearchTab] = useState<SearchTab>('email');
  const [emailQuery, setEmailQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ uid: string; name: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);

  const isGuest = useAuthStore((s) => s.isGuest);

  const {
    friends,
    recentConnections,
    statuses,
    searchResult,
    isSearching,
    friendCode,
    isFriendCodeLoading,
    pendingRequests,
    acceptedFriends,
    subscribe,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    searchByEmail,
    lookupFriendCode,
    getOrCreateFriendCode,
    clearSearch,
  } = useFriendsStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

  // Load friend code on mount
  useEffect(() => {
    if (!isGuest) {
      getOrCreateFriendCode().catch(() => {});
    }
  }, [isGuest, getOrCreateFriendCode]);

  // Auto-lookup friend code from URL param
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && codeParam.length === 8) {
      setSearchTab('code');
      setCodeQuery(codeParam.toUpperCase());
      lookupFriendCode(codeParam);
    }
  }, [searchParams, lookupFriendCode]);

  const handleSearchByEmail = async () => {
    if (!emailQuery.trim()) return;
    setError(null);
    setSearchNotFound(false);
    try {
      await searchByEmail(emailQuery);
      // Check if no result after search
      setTimeout(() => {
        const { searchResult } = useFriendsStore.getState();
        if (!searchResult) setSearchNotFound(true);
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Search failed.');
    }
  };

  const handleLookupCode = async () => {
    if (codeQuery.length !== 8) return;
    setError(null);
    setSearchNotFound(false);
    try {
      await lookupFriendCode(codeQuery);
      setTimeout(() => {
        const { searchResult } = useFriendsStore.getState();
        if (!searchResult) setSearchNotFound(true);
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Lookup failed.');
    }
  };

  const handleSendRequest = async (uid: string) => {
    setError(null);
    try {
      await sendFriendRequest(uid);
      clearSearch();
      setEmailQuery('');
      setCodeQuery('');
      setSearchNotFound(false);
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

  const handleCopyCode = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  };

  const handleShareInvite = async () => {
    if (!friendCode) return;
    const url = `${window.location.origin}/app/friends?code=${friendCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Add me on Duet!',
          text: `Add me as a friend on Duet! My friend code: ${friendCode}`,
          url,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } catch {}
    }
  };

  const pending = pendingRequests();
  const accepted = acceptedFriends();
  const recentList = Object.entries(recentConnections)
    .map(([uid, c]) => ({ uid, ...c }))
    .filter((conn) => !friends[conn.uid])
    .sort((a, b) => b.lastConnectedAt - a.lastConnectedAt);

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

      <div className="px-5 flex flex-col gap-5 max-w-lg mx-auto w-full pb-8">
        {error && (
          <div className="bg-danger/15 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Your Friend Code */}
        {!isGuest && (
          <div className="bg-glass border border-glass-border rounded-2xl p-4">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Your Friend Code</div>
            {isFriendCodeLoading ? (
              <Spinner size="sm" />
            ) : friendCode ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-extrabold tracking-[4px] text-primary">{friendCode}</span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs text-text-muted hover:text-text-main transition-colors"
                  >
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleShareInvite}
                  className="bg-primary/20 border border-primary/40 text-primary rounded-xl py-2 px-4 text-sm font-semibold hover:bg-primary/30 transition-colors"
                >
                  Share Invite Link
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* Add Friend */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Add Friend</h2>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            <button
              onClick={() => { setSearchTab('email'); clearSearch(); setSearchNotFound(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchTab === 'email' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
            >
              By Email
            </button>
            <button
              onClick={() => { setSearchTab('code'); clearSearch(); setSearchNotFound(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchTab === 'code' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
            >
              By Friend Code
            </button>
          </div>

          {/* Search input */}
          {searchTab === 'email' ? (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter email address..."
                value={emailQuery}
                onChange={(e) => { setEmailQuery(e.target.value); setSearchNotFound(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchByEmail(); }}
                className="flex-1 bg-white/10 border border-glass-border rounded-xl py-3 px-4 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={handleSearchByEmail}
                disabled={!emailQuery.trim() || isSearching}
                className="bg-primary text-white rounded-xl py-3 px-5 font-semibold disabled:opacity-50 hover:bg-primary-light transition-colors"
              >
                {isSearching ? <Spinner size="sm" /> : 'Search'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 8-character code..."
                value={codeQuery}
                onChange={(e) => { setCodeQuery(e.target.value.toUpperCase()); setSearchNotFound(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLookupCode(); }}
                maxLength={8}
                className="flex-1 bg-white/10 border border-glass-border rounded-xl py-3 px-4 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors tracking-widest font-semibold uppercase"
              />
              <button
                onClick={handleLookupCode}
                disabled={codeQuery.length !== 8 || isSearching}
                className="bg-primary text-white rounded-xl py-3 px-5 font-semibold disabled:opacity-50 hover:bg-primary-light transition-colors"
              >
                {isSearching ? <Spinner size="sm" /> : 'Look Up'}
              </button>
            </div>
          )}

          {/* Search result */}
          {searchResult && (
            <div className="flex items-center bg-glass border border-glass-border rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold mr-3">
                {searchResult.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 font-medium">{searchResult.displayName}</span>
              {friends[searchResult.uid] ? (
                <span className="text-text-muted text-sm">
                  {friends[searchResult.uid].status === 'accepted' ? 'Friends' : 'Pending'}
                </span>
              ) : (
                <button
                  onClick={() => handleSendRequest(searchResult.uid)}
                  className="bg-primary text-white rounded-lg py-1.5 px-3 text-sm font-semibold hover:bg-primary-light transition-colors"
                >
                  Add
                </button>
              )}
            </div>
          )}

          {searchNotFound && !isSearching && !searchResult && (
            <p className="text-text-muted text-sm text-center py-2">
              {searchTab === 'email' ? 'No user found with that email.' : 'No user found with that code.'}
            </p>
          )}
        </div>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Pending Requests</h2>
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

        {/* Recent Connections */}
        {recentList.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Recent Connections</h2>
            {recentList.map((conn) => (
              <div key={conn.uid} className="flex items-center bg-glass border border-glass-border rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold mr-3">
                  {conn.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{conn.displayName}</span>
                </div>
                <button
                  onClick={() => handleSendRequest(conn.uid)}
                  className="bg-primary text-white rounded-lg py-1.5 px-3 text-sm font-semibold hover:bg-primary-light transition-colors"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Friends {accepted.length > 0 && `(${accepted.length})`}
          </h2>
          {accepted.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">
              No friends yet. Search by email or share your friend code to connect.
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
