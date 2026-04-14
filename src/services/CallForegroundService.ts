import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidColor, AndroidForegroundServiceType } from '@notifee/react-native';

class CallForegroundService {
  private isRunning = false;
  private readonly CHANNEL_ID = 'duet_call_service';

  async start(): Promise<void> {
    if (Platform.OS !== 'android') return;
    if (this.isRunning) return;

    try {
      await notifee.createChannel({
        id: this.CHANNEL_ID,
        name: 'Duet Active Call',
        importance: AndroidImportance.LOW, // Low importance to prevent sound interruption, but shows in status bar
      });

      await notifee.displayNotification({
        title: 'Duet In Progress',
        body: 'You are connected to a room. Tap to return.',
        android: {
          channelId: this.CHANNEL_ID,
          asForegroundService: true,
          color: AndroidColor.WHITE,
          colorized: true,
          ongoing: true,
          foregroundServiceTypes: [AndroidForegroundServiceType.MICROPHONE],
          pressAction: {
            id: 'default',
          },
        },
      });

      this.isRunning = true;
      console.log('[CallForegroundService] started');
    } catch (error) {
      console.error('[CallForegroundService] Failed to start:', error);
    }
  }

  async stop(): Promise<void> {
    if (Platform.OS !== 'android') return;
    if (!this.isRunning) return;

    try {
      await notifee.stopForegroundService();
      this.isRunning = false;
      console.log('[CallForegroundService] stopped');
    } catch (error) {
      console.error('[CallForegroundService] Failed to stop:', error);
    }
  }
}

export const callForegroundService = new CallForegroundService();
