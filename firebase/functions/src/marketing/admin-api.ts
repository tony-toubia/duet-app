import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { computeAllSegments } from './segments';
import { executeCampaign, previewCampaignEmail } from './campaigns';
import type { Campaign } from './types';

const resendApiKey = defineSecret('RESEND_API_KEY');
const unsubSecret = defineSecret('UNSUB_HMAC_SECRET');

// Admin UIDs — comma-separated. Update this with your Firebase Auth UID.
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);

async function verifyAdmin(req: any): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No auth token');
  const token = authHeader.split('Bearer ')[1];
  const decoded = await getAuth().verifyIdToken(token);
  if (ADMIN_UIDS.length > 0 && !ADMIN_UIDS.includes(decoded.uid)) {
    throw new Error('Not authorized');
  }
  return decoded.uid;
}

function cors(res: any): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res: any, status: number, data: any): void {
  res.status(status).json(data);
}

export const marketingApi = onRequest(
  {
    region: 'us-central1',
    secrets: [resendApiKey, unsubSecret],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
      await verifyAdmin(req);
    } catch (err: any) {
      json(res, 401, { error: err.message });
      return;
    }

    const db = getDatabase();
    const path = req.path.replace(/^\/+|\/+$/g, '');
    const method = req.method;

    try {
      // ── Segments ─────────────────────────────────────────────
      if (path === 'segments' && method === 'GET') {
        const snap = await db.ref('marketing/segments').once('value');
        const segments = snap.val() || {};
        // Strip members from the list response for performance
        const list = Object.entries(segments).map(([id, s]: [string, any]) => ({
          id,
          name: s.name,
          description: s.description,
          memberCount: s.memberCount || 0,
          lastComputedAt: s.lastComputedAt || 0,
        }));
        json(res, 200, { segments: list });
        return;
      }

      if (path === 'segments/refresh' && method === 'POST') {
        const counts = await computeAllSegments();
        json(res, 200, { counts });
        return;
      }

      // ── Campaigns ────────────────────────────────────────────
      if (path === 'campaigns' && method === 'GET') {
        const snap = await db.ref('marketing/campaigns').orderByChild('createdAt').once('value');
        const campaigns: any[] = [];
        snap.forEach((child) => {
          const val = child.val();
          campaigns.push({ id: child.key, ...val });
        });
        campaigns.reverse(); // newest first
        json(res, 200, { campaigns });
        return;
      }

      if (path === 'campaigns' && method === 'POST') {
        const body = req.body;
        const now = Date.now();
        const campaign: Campaign = {
          name: body.name || 'Untitled Campaign',
          channels: body.channels || ['email'],
          segmentId: body.segmentId || 'all_authenticated',
          status: 'draft',
          email: body.email || null,
          push: body.push || null,
          createdAt: now,
          updatedAt: now,
          sentAt: null,
          results: null,
        };
        const ref = await db.ref('marketing/campaigns').push(campaign);
        json(res, 201, { id: ref.key, ...campaign });
        return;
      }

      // Campaign by ID routes
      const campaignMatch = path.match(/^campaigns\/([^/]+)$/);
      if (campaignMatch) {
        const campaignId = campaignMatch[1];

        if (method === 'GET') {
          const snap = await db.ref(`marketing/campaigns/${campaignId}`).once('value');
          if (!snap.exists()) { json(res, 404, { error: 'Not found' }); return; }
          json(res, 200, { id: campaignId, ...snap.val() });
          return;
        }

        if (method === 'PUT') {
          const body = req.body;
          body.updatedAt = Date.now();
          await db.ref(`marketing/campaigns/${campaignId}`).update(body);
          const snap = await db.ref(`marketing/campaigns/${campaignId}`).once('value');
          json(res, 200, { id: campaignId, ...snap.val() });
          return;
        }
      }

      // Campaign send
      const sendMatch = path.match(/^campaigns\/([^/]+)\/send$/);
      if (sendMatch && method === 'POST') {
        const campaignId = sendMatch[1];
        await executeCampaign(campaignId, resendApiKey.value(), unsubSecret.value());
        const snap = await db.ref(`marketing/campaigns/${campaignId}`).once('value');
        json(res, 200, { id: campaignId, ...snap.val() });
        return;
      }

      // ── Preview ──────────────────────────────────────────────
      if (path === 'preview' && method === 'POST') {
        const { body: bodyHtml, includeUnsub } = req.body;
        const html = previewCampaignEmail(bodyHtml || '', includeUnsub !== false);
        json(res, 200, { html });
        return;
      }

      // ── Journeys ─────────────────────────────────────────────
      if (path === 'journeys' && method === 'GET') {
        const snap = await db.ref('marketing/journeys').once('value');
        const journeys: any[] = [];
        snap.forEach((child) => {
          journeys.push({ id: child.key, ...child.val() });
        });
        json(res, 200, { journeys });
        return;
      }

      const journeyMatch = path.match(/^journeys\/([^/]+)$/);
      if (journeyMatch && method === 'PUT') {
        const journeyId = journeyMatch[1];
        await db.ref(`marketing/journeys/${journeyId}`).update(req.body);
        const snap = await db.ref(`marketing/journeys/${journeyId}`).once('value');
        json(res, 200, { id: journeyId, ...snap.val() });
        return;
      }

      // ── Stats ────────────────────────────────────────────────
      if (path === 'stats' && method === 'GET') {
        const [usersSnap, segmentsSnap, campaignsSnap] = await Promise.all([
          db.ref('users').once('value'),
          db.ref('marketing/segments').once('value'),
          db.ref('marketing/campaigns').orderByChild('status').equalTo('sent').once('value'),
        ]);

        const userCount = usersSnap.numChildren();
        const segments = segmentsSnap.val() || {};
        const sentCampaigns = campaignsSnap.numChildren();

        // Count today's email sends
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const logSnap = await db
          .ref('marketing/sendLog')
          .orderByChild('sentAt')
          .startAt(todayStart.getTime())
          .once('value');
        let emailsToday = 0;
        logSnap.forEach((child) => {
          if (child.val()?.channel === 'email') emailsToday++;
        });

        json(res, 200, {
          userCount,
          sentCampaigns,
          emailsToday,
          emailDailyLimit: 100,
          segmentSummary: Object.entries(segments).map(([id, s]: [string, any]) => ({
            id,
            name: s.name,
            memberCount: s.memberCount || 0,
          })),
        });
        return;
      }

      json(res, 404, { error: `Route not found: ${method} /${path}` });
    } catch (err: any) {
      console.error('[MarketingAPI] Error:', err);
      json(res, 500, { error: err.message });
    }
  }
);
