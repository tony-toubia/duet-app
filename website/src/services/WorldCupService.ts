import { ref, onValue, off } from 'firebase/database';
import { firebaseDb } from './firebase';

export interface MatchScore {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'IN_PLAY' | 'FINISHED' | 'TIMED' | 'PAUSED';
  startTime: number;
  minute?: number;
}

export class WorldCupService {
  /**
   * Subscribes to the live World Cup match data node synced via Firebase functions.
   */
  static subscribeLiveMatches(onUpdate: (matches: MatchScore[]) => void): () => void {
    const matchesRef = ref(firebaseDb, 'worldcup/matches');

    const unsubscribe = onValue(
      matchesRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val) {
          onUpdate([]);
          return;
        }

        const parsed: MatchScore[] = Object.keys(val).map((key) => ({
          id: key,
          ...val[key],
        }));

        // Sort in-play matches to the top
        parsed.sort((a, b) => {
          if (a.status === 'IN_PLAY' && b.status !== 'IN_PLAY') return -1;
          if (b.status === 'IN_PLAY' && a.status !== 'IN_PLAY') return 1;
          return a.startTime - b.startTime;
        });

        onUpdate(parsed);
      },
      (error) => {
        console.warn('[WorldCupService] Match subscription failed:', error);
      }
    );

    return () => off(matchesRef, 'value', unsubscribe);
  }
}
