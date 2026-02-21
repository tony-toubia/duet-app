import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueWritten, onValueDeleted, onValueCreated } from 'firebase-functions/v2/database';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import type { Message } from 'firebase-admin/messaging';
import { Resend } from 'resend';

// Marketing module imports
import {
  generateUnsubToken,
  unsubscribePage,
  welcomeEmailHtml,
  tipsEmailHtml,
  reengagementEmailHtml,
} from './marketing/templates';
import { computeAllSegments } from './marketing/segments';
export { marketingApi } from './marketing/admin-api';

initializeApp();

const db = getDatabase();
const messaging = getMessaging();
const resendApiKey = defineSecret('RESEND_API_KEY');
const unsubSecret = defineSecret('UNSUB_HMAC_SECRET');

// ─── Email helpers ────────────────────────────────────────────────────

async function sendEmail(
  resend: Resend,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: 'Duet <hello@e.getduet.app>',
      to,
      subject,
      html,
    });
    if (error) {
      console.error('[Email] Resend error:', error);
      return false;
    }
    console.log(`[Email] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send:', err);
    return false;
  }
}

/**
 * Clean up stale rooms older than 24 hours.
 * Runs every hour.
 */
export const cleanupStaleRooms = onSchedule('every 1 hours', async () => {
  const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const snapshot = await db
      .ref('rooms')
      .orderByChild('createdAt')
      .endAt(cutoffTime)
      .once('value');

    const deletions: Promise<void>[] = [];
    snapshot.forEach((child) => {
      console.log(`Deleting stale room: ${child.key}`);
      deletions.push(child.ref.remove());
    });

    await Promise.all(deletions);
    console.log(`Cleaned up ${deletions.length} stale rooms`);
  } catch (error) {
    console.error('Error cleaning up rooms:', error);
    throw error;
  }
});

/**
 * Send push notification when a partner leaves the room.
 * Triggered when a member is removed from a room.
 */
export const onMemberLeft = onValueDeleted(
  { ref: '/rooms/{roomCode}/members/{memberId}', region: 'us-central1' },
  async (event) => {
    const roomCode = event.params.roomCode;
    const memberId = event.params.memberId;

    try {
      const roomSnapshot = await db.ref(`/rooms/${roomCode}`).once('value');
      const room = roomSnapshot.val();

      if (!room || !room.members) {
        console.log(`Room ${roomCode} no longer exists or has no members`);
        return;
      }

      const remainingMemberIds = Object.keys(room.members).filter(
        (id) => id !== memberId
      );

      if (remainingMemberIds.length === 0) {
        console.log(`No remaining members in room ${roomCode}`);
        return;
      }

      const notifications = remainingMemberIds.map(async (remainingMemberId) => {
        const userSnapshot = await db
          .ref(`/users/${remainingMemberId}`)
          .once('value');
        const userData = userSnapshot.val();

        if (!userData?.pushToken) {
          console.log(`No push token for user ${remainingMemberId}`);
          return;
        }

        const message: Message = {
          token: userData.pushToken,
          notification: {
            title: 'Partner Disconnected',
            body: 'Your duet partner has left the room.',
          },
          data: {
            type: 'partner_left',
            roomCode,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'duet_notifications',
              priority: 'high',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: 'Partner Disconnected',
                  body: 'Your duet partner has left the room.',
                },
                sound: 'default',
                badge: 1,
              },
            },
          },
        };

        try {
          await messaging.send(message);
          console.log(`Notification sent to ${remainingMemberId}`);
        } catch (error: any) {
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            console.log(`Removing invalid token for user ${remainingMemberId}`);
            await db.ref(`/users/${remainingMemberId}/pushToken`).remove();
          } else {
            console.error(`Error sending notification to ${remainingMemberId}:`, error);
          }
        }
      });

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error in onMemberLeft:', error);
      throw error;
    }
  }
);

/**
 * Clean up room when all members leave — but only if the room is old enough.
 */
export const onRoomEmpty = onValueWritten(
  { ref: '/rooms/{roomCode}/members', region: 'us-central1' },
  async (event) => {
    const roomCode = event.params.roomCode;

    if (!event.data.after.exists() || !event.data.after.hasChildren()) {
      const roomSnap = await db.ref(`/rooms/${roomCode}`).once('value');
      const room = roomSnap.val();

      if (!room) return;

      const createdAt = room.createdAt || 0;
      const ageMs = Date.now() - createdAt;
      const GRACE_PERIOD_MS = 5 * 60 * 1000;

      if (ageMs > GRACE_PERIOD_MS) {
        console.log(`Room ${roomCode} is empty and ${Math.round(ageMs / 1000)}s old, cleaning up`);
        await db.ref(`/rooms/${roomCode}`).remove();
      } else {
        console.log(`Room ${roomCode} is empty but only ${Math.round(ageMs / 1000)}s old, keeping for grace period`);
      }
    }
  }
);

/**
 * Send push notification when a friend request is created.
 */
export const onFriendRequestCreated = onValueCreated(
  { ref: '/friends/{userId}/{friendId}', region: 'us-central1' },
  async (event) => {
    const userId = event.params.userId;
    const friendId = event.params.friendId;
    const friendData = event.data.val();

    if (friendData.initiatedBy === userId) {
      try {
        const userSnapshot = await db.ref(`/users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData?.pushToken) {
          console.log(`No push token for user ${userId}`);
          return;
        }

        const message: Message = {
          token: userData.pushToken,
          notification: {
            title: 'Friend Request',
            body: `${friendData.displayName} wants to be your friend!`,
          },
          data: {
            type: 'friend_request',
            fromUid: friendId,
            fromDisplayName: friendData.displayName || 'Someone',
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'duet_notifications',
              priority: 'high',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: 'Friend Request',
                  body: `${friendData.displayName} wants to be your friend!`,
                },
                sound: 'default',
              },
            },
          },
        };

        await messaging.send(message);
        console.log(`Friend request notification sent to ${userId}`);
      } catch (error) {
        console.error('Error sending friend request notification:', error);
      }
    }
  }
);

/**
 * Send push notification when a room invitation is created.
 */
export const onInvitationCreated = onValueCreated(
  { ref: '/invitations/{invitationId}', region: 'us-central1' },
  async (event) => {
    const invitation = event.data.val();

    if (!invitation?.toUid) return;

    try {
      const userSnapshot = await db.ref(`/users/${invitation.toUid}`).once('value');
      const userData = userSnapshot.val();

      if (!userData?.pushToken) {
        console.log(`No push token for user ${invitation.toUid}`);
        return;
      }

      const message: Message = {
        token: userData.pushToken,
        notification: {
          title: 'Room Invitation',
          body: `${invitation.fromDisplayName} invited you to join their room!`,
        },
        data: {
          type: 'room_invite',
          roomCode: invitation.roomCode,
          fromUid: invitation.fromUid,
          fromDisplayName: invitation.fromDisplayName || 'Someone',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'duet_notifications',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Room Invitation',
                body: `${invitation.fromDisplayName} invited you to join their room!`,
              },
              sound: 'default',
            },
          },
        },
      };

      await messaging.send(message);
      console.log(`Room invitation notification sent to ${invitation.toUid}`);

      // Clean up invitation after sending
      await event.data.ref.remove();
    } catch (error) {
      console.error('Error sending room invitation notification:', error);
    }
  }
);

// ─── Unsubscribe endpoint ─────────────────────────────────────────────

/**
 * HTTPS endpoint for email unsubscribe. Validates HMAC token to prevent abuse.
 */
export const unsubscribe = onRequest(
  { region: 'us-central1', secrets: [unsubSecret] },
  async (req, res) => {
    const uid = req.query.uid as string | undefined;
    const token = req.query.t as string | undefined;

    if (!uid || !token) {
      res.status(400).send(unsubscribePage('Invalid unsubscribe link.', false));
      return;
    }

    const expected = generateUnsubToken(uid, unsubSecret.value());
    if (token !== expected) {
      res.status(403).send(unsubscribePage('Invalid unsubscribe link.', false));
      return;
    }

    try {
      await db.ref(`/emailState/${uid}/unsubscribed`).set(true);
      console.log(`[Unsub] User ${uid} unsubscribed`);
      res.status(200).send(unsubscribePage('You\'ve been unsubscribed from Duet promotional emails.', true));
    } catch (error) {
      console.error(`[Unsub] Error for ${uid}:`, error);
      res.status(500).send(unsubscribePage('Something went wrong. Please try again.', false));
    }
  }
);

// ─── Scheduled segment computation ───────────────────────────────────

/**
 * Recompute all marketing segments every 6 hours.
 */
export const computeSegments = onSchedule('every 6 hours', async () => {
  const counts = await computeAllSegments();
  console.log('[Segments] Scheduled refresh complete:', JSON.stringify(counts));
});

// ─── Email welcome journey ───────────────────────────────────────────

/**
 * Send welcome email when a new user profile is created (non-anonymous).
 */
export const onUserProfileCreated = onValueCreated(
  {
    ref: '/users/{userId}/profile',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    const userId = event.params.userId;
    const profile = event.data.val();

    if (profile.authProvider === 'anonymous') {
      console.log(`[Email] Skipping anonymous user ${userId}`);
      return;
    }

    if (!profile.email) {
      console.log(`[Email] No email for user ${userId}, skipping`);
      return;
    }

    // Dedup: check if welcome was already sent
    const existingSnap = await db.ref(`/emailState/${userId}/welcomeSentAt`).once('value');
    if (existingSnap.exists()) {
      console.log(`[Email] Welcome already sent to ${userId}`);
      return;
    }

    await db.ref(`/emailState/${userId}`).set({
      welcomeSentAt: Date.now(),
      hasCreatedRoom: false,
      unsubscribed: false,
    });

    const resend = new Resend(resendApiKey.value());
    const displayName = profile.displayName || 'there';
    const sent = await sendEmail(
      resend,
      profile.email,
      `Welcome to Duet, ${displayName}!`,
      welcomeEmailHtml(displayName)
    );

    if (!sent) {
      // Allow retry by removing the timestamp
      await db.ref(`/emailState/${userId}/welcomeSentAt`).remove();
    }
  }
);

/**
 * Send welcome email when a guest upgrades to an authenticated account.
 */
export const onAuthProviderUpgraded = onValueWritten(
  {
    ref: '/users/{userId}/profile/authProvider',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    const userId = event.params.userId;
    const before = event.data.before.val();
    const after = event.data.after.val();

    if (before !== 'anonymous' || after === 'anonymous') return;

    console.log(`[Email] Auth upgrade for ${userId}: ${before} -> ${after}`);

    const existingSnap = await db.ref(`/emailState/${userId}/welcomeSentAt`).once('value');
    if (existingSnap.exists()) {
      console.log(`[Email] Welcome already sent to ${userId}, skipping`);
      return;
    }

    const profileSnap = await db.ref(`/users/${userId}/profile`).once('value');
    const profile = profileSnap.val();

    if (!profile?.email) {
      console.log(`[Email] No email for upgraded user ${userId}`);
      return;
    }

    await db.ref(`/emailState/${userId}`).set({
      welcomeSentAt: Date.now(),
      hasCreatedRoom: false,
      unsubscribed: false,
    });

    const resend = new Resend(resendApiKey.value());
    const displayName = profile.displayName || 'there';
    const sent = await sendEmail(
      resend,
      profile.email,
      `Welcome to Duet, ${displayName}!`,
      welcomeEmailHtml(displayName)
    );

    if (!sent) {
      await db.ref(`/emailState/${userId}/welcomeSentAt`).remove();
    }
  }
);

/**
 * Track when a user creates their first room (for re-engagement email logic).
 */
export const onRoomCreatedTracker = onValueCreated(
  { ref: '/rooms/{roomCode}', region: 'us-central1' },
  async (event) => {
    const createdBy = event.data.val()?.createdBy;
    if (!createdBy) return;

    try {
      await db.ref(`/emailState/${createdBy}/hasCreatedRoom`).set(true);
      console.log(`[Email] Marked hasCreatedRoom for ${createdBy}`);
    } catch (error) {
      console.error(`[Email] Failed to mark hasCreatedRoom for ${createdBy}:`, error);
    }
  }
);

/**
 * Hourly job: send tips email (24h after signup) and re-engagement (7d, no room).
 */
export const processEmailQueue = onSchedule(
  {
    schedule: 'every 1 hours',
    secrets: [resendApiKey, unsubSecret],
  },
  async () => {
    const resend = new Resend(resendApiKey.value());
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const snapshot = await db
      .ref('emailState')
      .orderByChild('welcomeSentAt')
      .endAt(now - TWENTY_FOUR_HOURS)
      .once('value');

    if (!snapshot.exists()) {
      console.log('[Email Queue] No candidates for follow-up emails');
      return;
    }

    let tipsSent = 0;
    let reengagementSent = 0;
    const promises: Promise<void>[] = [];

    snapshot.forEach((child) => {
      const userId = child.key!;
      const state = child.val();

      if (state.unsubscribed) return;

      // Tips email: 24h after welcome, not yet sent
      if (!state.tipsSentAt && state.welcomeSentAt) {
        promises.push(
          (async () => {
            const profileSnap = await db.ref(`/users/${userId}/profile`).once('value');
            const profile = profileSnap.val();
            if (!profile?.email) return;

            const displayName = profile.displayName || 'there';
            const sent = await sendEmail(
              resend,
              profile.email,
              '3 ways to get the most out of Duet',
              tipsEmailHtml(displayName, userId, unsubSecret.value())
            );

            if (sent) {
              await db.ref(`/emailState/${userId}/tipsSentAt`).set(now);
              tipsSent++;
            }
          })()
        );
      }

      // Re-engagement: 7d after welcome, tips sent, no room created
      if (
        state.tipsSentAt &&
        !state.reengagementSentAt &&
        !state.hasCreatedRoom &&
        state.welcomeSentAt <= now - SEVEN_DAYS
      ) {
        promises.push(
          (async () => {
            const profileSnap = await db.ref(`/users/${userId}/profile`).once('value');
            const profile = profileSnap.val();
            if (!profile?.email) return;

            const displayName = profile.displayName || 'there';
            const sent = await sendEmail(
              resend,
              profile.email,
              `Still there, ${displayName}? Your friends are waiting`,
              reengagementEmailHtml(displayName, userId, unsubSecret.value())
            );

            if (sent) {
              await db.ref(`/emailState/${userId}/reengagementSentAt`).set(now);
              reengagementSent++;
            }
          })()
        );
      }
    });

    await Promise.all(promises);
    console.log(`[Email Queue] Done. Tips: ${tipsSent}, Re-engagement: ${reengagementSent}`);
  }
);
