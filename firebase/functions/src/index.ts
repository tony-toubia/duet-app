import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueWritten, onValueDeleted, onValueCreated } from 'firebase-functions/v2/database';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import type { Message } from 'firebase-admin/messaging';

initializeApp();

const db = getDatabase();
const messaging = getMessaging();

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
