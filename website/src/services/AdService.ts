/**
 * Ad Service (Web Stub)
 *
 * No-op implementation. Web ads will be integrated later.
 * Maintains the same interface as mobile for compatibility.
 */

class AdService {
  private roomLeaveCount = 0;

  initialize(): void {
    console.log('[Ad] Web stub initialized');
  }

  willShowInterstitial(): boolean {
    return false;
  }

  async onRoomLeave(): Promise<void> {
    this.roomLeaveCount++;
  }

  async showRewarded(): Promise<boolean> {
    // No rewarded ads on web — always grant the reward
    return true;
  }

  get isRewardedReady(): boolean {
    return true;
  }
}

export const adService = new AdService();
