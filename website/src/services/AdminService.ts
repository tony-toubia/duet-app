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

// Custom Segments
export async function fetchCustomSegments() {
  return api<{ customSegments: any[] }>('custom-segments');
}

export async function createCustomSegment(data: { name: string; description?: string; rules: any }) {
  return api<any>('custom-segments', 'POST', data);
}

export async function fetchCustomSegment(id: string) {
  return api<any>(`custom-segments/${id}`);
}

export async function updateCustomSegment(id: string, data: any) {
  return api<any>(`custom-segments/${id}`, 'PUT', data);
}

export async function deleteCustomSegment(id: string) {
  return api<{ deleted: string }>(`custom-segments/${id}`, 'DELETE');
}

export async function previewSegmentRules(rules: any) {
  return api<{ memberCount: number }>('custom-segments/preview', 'POST', { rules });
}

// Journeys
export async function fetchJourneys() {
  return api<{ journeys: any[] }>('journeys');
}

export async function fetchJourney(id: string) {
  return api<any>(`journeys/${id}`);
}

export async function createJourney(data: any) {
  return api<any>('journeys', 'POST', data);
}

export async function updateJourney(id: string, data: any) {
  return api<any>(`journeys/${id}`, 'PUT', data);
}

export async function deleteJourney(id: string) {
  return api<{ deleted: string }>(`journeys/${id}`, 'DELETE');
}

export async function fetchJourneyStats(id: string) {
  return api<{
    enrolled: number;
    completed: number;
    active: number;
    nodeDistribution: Record<string, number>;
  }>(`journeys/${id}/stats`);
}

export async function seedJourneys() {
  return api<{ journeys: any[] }>('journeys/seed', 'POST');
}

// Messages
export async function fetchMessages() {
  return api<{ messages: any[] }>('messages');
}

export async function fetchMessage(id: string) {
  return api<any>(`messages/${id}`);
}

export async function createMessage(data: any) {
  return api<any>('messages', 'POST', data);
}

export async function updateMessage(id: string, data: any) {
  return api<any>(`messages/${id}`, 'PUT', data);
}

export async function deleteMessage(id: string) {
  return api<{ deleted: string }>(`messages/${id}`, 'DELETE');
}

// Reporting
export async function fetchReportingMonths() {
  return api<{ months: { year: number; month: number; count: number }[] }>('reporting/months');
}

export async function fetchReportingCampaigns(year: number, month?: number) {
  const params = month !== undefined ? `year=${year}&month=${month}` : `year=${year}`;
  return api<{
    year: number;
    month?: number;
    campaigns: any[];
    totals: {
      totalTargeted: number;
      emailsSent: number;
      emailsFailed: number;
      pushSent: number;
      pushFailed: number;
      campaignCount: number;
    };
  }>(`reporting/campaigns?${params}`);
}

// Subscribers
export async function searchSubscribers(query: string) {
  return api<{
    results: {
      uid: string;
      displayName: string | null;
      email: string | null;
      avatarUrl: string | null;
      authProvider: string | null;
      platform: string | null;
      createdAt: number | null;
    }[];
  }>(`subscribers/search?q=${encodeURIComponent(query)}`);
}

export async function fetchSubscriber(uid: string) {
  return api<{
    uid: string;
    profile: any;
    preferences: any;
    pushToken: string | null;
    platform: string | null;
    emailState: any;
    status: any;
    events: any[];
    segments: { id: string; name: string }[];
    sendHistory: any[];
  }>(`subscribers/${uid}`);
}

// Assets
export async function fetchAssets() {
  return api<{ assets: any[] }>('assets');
}

export async function createAsset(data: { name: string; url: string; tags?: string[]; description?: string; contentType?: string; fileSize?: number }) {
  return api<any>('assets', 'POST', data);
}

export async function updateAsset(id: string, data: any) {
  return api<any>(`assets/${id}`, 'PUT', data);
}

export async function deleteAsset(id: string) {
  return api<{ deleted: string }>(`assets/${id}`, 'DELETE');
}

export async function fetchAssetUsage(id: string) {
  return api<{ usage: { type: string; id: string; name: string }[] }>(`assets/${id}/usage`);
}
