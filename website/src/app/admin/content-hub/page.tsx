'use client';

import { useState, useEffect } from 'react';
import { firebaseDb as database } from '@/services/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { AnimatedPageIcon } from '@/components/admin/AnimatedPageIcon';
import { Spinner } from '@/components/ui/Spinner';

interface ContentItem {
  id: string;
  type: 'podcast' | 'live_stream' | 'playlist';
  title: string;
  deepLink: string;
  image: string;
  city?: string;
  createdAt: number;
}

export default function ContentHubAdmin() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'podcast' | 'live_stream' | 'playlist'>('podcast');
  const [deepLink, setDeepLink] = useState('');
  const [image, setImage] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const contentRef = ref(database, 'worldcup/content');
    const unsub = onValue(contentRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => b.createdAt - a.createdAt);
        setContent(parsed);
      } else {
        setContent([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deepLink) return;

    const contentRef = ref(database, 'worldcup/content');
    const newDoc = push(contentRef);
    await set(newDoc, {
      title,
      type,
      deepLink,
      image,
      city: city || null,
      createdAt: Date.now()
    });

    setTitle('');
    setDeepLink('');
    setImage('');
    setCity('');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this content item?')) {
      await remove(ref(database, `worldcup/content/${id}`));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AnimatedPageIcon name="dashboard" />
        <h1 className="text-2xl font-bold text-white">Content Hub Administration</h1>
      </div>

      <div className="bg-surface rounded-xl border border-glass-border p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Add New Recommendation</h2>
        <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="Match Day Playlist" />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white">
                <option value="podcast">Podcast</option>
                <option value="playlist">Playlist</option>
                <option value="live_stream">Live Stream</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Deep Link URL (e.g. spotify://)</label>
            <input type="text" value={deepLink} onChange={e => setDeepLink(e.target.value)} required className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Cover Image URL</label>
              <input type="text" value={image} onChange={e => setImage(e.target.value)} className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Target City (Optional)</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="e.g. Kansas City" />
            </div>
          </div>
          <button type="submit" className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-light">
            Create Content
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-xl border border-glass-border p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Active Content Pool</h2>
        {loading ? (
          <Spinner />
        ) : content.length === 0 ? (
          <p className="text-text-muted">No content items loaded.</p>
        ) : (
          <div className="divide-y divide-glass-border">
            {content.map(item => (
              <div key={item.id} className="py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{item.title}</h3>
                  <p className="text-sm text-text-muted capitalize">{item.type} • {item.city || 'Global'}</p>
                  <p className="text-xs text-text-muted mt-1 font-mono">{item.deepLink}</p>
                </div>
                <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 text-sm border border-red-500/30 px-3 py-1 rounded-md">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
