import { firebaseAuth } from './firebase';

const API_URL =
  process.env.NEXT_PUBLIC_MARKETING_API_URL ||
  'https://us-central1-duet-33cf5.cloudfunctions.net/marketingApi';

async function getToken(): Promise<string> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function api<T = any>(
  path: string,
  method: string = 'GET',
  body?: any
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// Segments
export async function fetchSegments() {
  return api<{ segments: any[] }>('segments');
}

export async function refreshSegments() {
  return api<{ counts: Record<string, number> }>('segments/refresh', 'POST');
}

// Campaigns
export async function fetchCampaigns() {
  return api<{ campaigns: any[] }>('campaigns');
}

export async function fetchCampaign(id: string) {
  return api<any>(`campaigns/${id}`);
}

export async function createCampaign(data: any) {
  return api<any>('campaigns', 'POST', data);
}

export async function updateCampaign(id: string, data: any) {
  return api<any>(`campaigns/${id}`, 'PUT', data);
}

export async function sendCampaign(id: string) {
  return api<any>(`campaigns/${id}/send`, 'POST');
}

// Preview
export async function previewEmail(body: string, includeUnsub: boolean) {
  return api<{ html: string }>('preview', 'POST', { body, includeUnsub });
}

// Stats
export async function fetchStats() {
  return api<{
    userCount: number;
    sentCampaigns: number;
    emailsToday: number;
    emailDailyLimit: number;
    segmentSummary: { id: string; name: string; memberCount: number }[];
  }>('stats');
}

// Journeys
export async function fetchJourneys() {
  return api<{ journeys: any[] }>('journeys');
}

export async function updateJourney(id: string, data: any) {
  return api<any>(`journeys/${id}`, 'PUT', data);
}

export async function seedJourneys() {
  return api<{ journeys: any[] }>('journeys/seed', 'POST');
}
