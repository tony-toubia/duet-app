/**
 * TheSportsDB Syndication Source
 *
 * Fetches upcoming sports events from TheSportsDB API.
 * Free API key: '123' (no signup required)
 * Docs: https://www.thesportsdb.com/api.php
 *
 * Free v1 endpoints used:
 * - eventsnextleague.php?id={leagueId} — next 15 events for a league
 * - eventsseason.php?id={leagueId}&s={season} — events by season
 *
 * Note: livescore.php is premium-only (v2). We skip it on the free tier.
 */

import { type RawSyndicatedItem } from '../normalizer';

// ─── League IDs (TheSportsDB) ────────────────────────────────────────
// Full list: https://www.thesportsdb.com/api/v1/json/3/all_leagues.php

export const LEAGUE_IDS: Record<string, string> = {
  'English Premier League': '4328',
  'MLS': '4346',
  'NFL': '4391',
  'NBA': '4387',
  'FIFA World Cup': '4429',
  'UEFA Champions League': '4480',
  'La Liga': '4335',
  'Serie A': '4332',
  'Bundesliga': '4331',
};

const DEFAULT_LEAGUES = ['4429', '4346', '4391', '4387', '4328'];

interface SportsDBEvent {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strThumb?: string;
  strBanner?: string;
  strPoster?: string;
  strSquare?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strStatus?: string;
  strVideo?: string;
  strTVStation?: string;
  intHomeScore?: string;
  intAwayScore?: string;
}

/** Free API key — no signup required */
const FREE_API_KEY = '123';

interface SportsDBConfig {
  apiKey?: string;
  leagues?: string[];
}

// ─── Fetch helpers ───────────────────────────────────────────────────

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SportsDB API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch live events across all sports.
 * Note: livescore.php requires a premium (v2) API key.
 * On the free tier this will return empty — that's expected.
 */
async function fetchLiveEvents(apiKey: string): Promise<SportsDBEvent[]> {
  // livescore is v2/premium only — skip on free key
  if (apiKey === FREE_API_KEY) {
    console.log('[SportsDB] Skipping livescore (premium-only on free key)');
    return [];
  }
  try {
    const data = await fetchJSON(
      `https://www.thesportsdb.com/api/v2/json/${apiKey}/livescore.php?s=Soccer`
    );
    return data?.events || [];
  } catch (e) {
    console.warn('[SportsDB] Failed to fetch live events:', e);
    return [];
  }
}

/**
 * Fetch next upcoming events for a specific league.
 */
async function fetchUpcomingByLeague(
  apiKey: string,
  leagueId: string
): Promise<SportsDBEvent[]> {
  try {
    const data = await fetchJSON(
      `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsnextleague.php?id=${leagueId}`
    );
    return data?.events || [];
  } catch (e) {
    console.warn(`[SportsDB] Failed to fetch league ${leagueId}:`, e);
    return [];
  }
}

// ─── Transform ───────────────────────────────────────────────────────

function eventToItem(event: SportsDBEvent, isLive: boolean): RawSyndicatedItem {
  const title = isLive
    ? `🔴 LIVE: ${event.strHomeTeam} vs ${event.strAwayTeam}`
    : `${event.strHomeTeam} vs ${event.strAwayTeam}`;

  const description = isLive
    ? `${event.strLeague} — ${event.intHomeScore ?? 0} - ${event.intAwayScore ?? 0}`
    : `${event.strLeague} — ${event.dateEvent || 'TBD'}`;

  // Build the best image: prefer square, then thumb, then poster
  const image =
    event.strSquare ||
    event.strThumb ||
    event.strPoster ||
    event.strBanner ||
    '';

  // Deep link: prefer video link, then TV station search, then generic search
  let deepLink = '';
  if (event.strVideo) {
    deepLink = event.strVideo;
  } else if (event.strTVStation) {
    deepLink = `https://www.google.com/search?q=${encodeURIComponent(
      `${event.strHomeTeam} vs ${event.strAwayTeam} ${event.strTVStation} live stream`
    )}`;
  } else {
    deepLink = `https://www.google.com/search?q=${encodeURIComponent(
      `${event.strHomeTeam} vs ${event.strAwayTeam} live stream`
    )}`;
  }

  // Expiry: live events expire in 4 hours, upcoming in 48 hours
  const now = Date.now();
  const expiresAt = isLive ? now + 4 * 60 * 60 * 1000 : now + 48 * 60 * 60 * 1000;

  return {
    sourceId: `sportsdb_${event.idEvent}`,
    type: 'live_stream',
    title,
    description,
    deepLink,
    image,
    league: event.strLeague,
    tags: ['sports', event.strLeague?.toLowerCase().replace(/\s+/g, '-') || 'other'],
    expiresAt,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Fetch all sports content from TheSportsDB.
 */
export async function fetchSportsContent(
  config: SportsDBConfig
): Promise<RawSyndicatedItem[]> {
  const { apiKey = FREE_API_KEY, leagues = DEFAULT_LEAGUES } = config;
  const items: RawSyndicatedItem[] = [];

  // 1. Fetch live events
  console.log('[SportsDB] Fetching live events...');
  const liveEvents = await fetchLiveEvents(apiKey);
  for (const event of liveEvents) {
    items.push(eventToItem(event, true));
  }
  console.log(`[SportsDB] Found ${liveEvents.length} live events`);

  // 2. Fetch upcoming events per league
  for (const leagueId of leagues) {
    console.log(`[SportsDB] Fetching upcoming for league ${leagueId}...`);
    const upcoming = await fetchUpcomingByLeague(apiKey, leagueId);
    // Take top 5 per league to avoid flooding
    for (const event of upcoming.slice(0, 5)) {
      items.push(eventToItem(event, false));
    }
    console.log(`[SportsDB] Found ${upcoming.length} upcoming for league ${leagueId}`);
  }

  return items;
}
