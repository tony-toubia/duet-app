import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.database();
const messaging = admin.messaging();

/**
 * Clean up stale rooms older than 24 hours
 * Runs every hour
 */
export const cleanupStaleRooms = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

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

      return null;
    } catch (error) {
      console.error('Error cleaning up rooms:', error);
      throw error;
    }
  });

/**
 * Send push notification when a partner leaves the room
 * Triggered when a member is removed from a room
 */
export const onMemberLeft = functions.database
  .ref('/rooms/{roomCode}/members/{memberId}')
  .onDelete(async (snapshot, context) => {
    const { roomCode, memberId } = context.params;

    try {
      // Get the room to find the other member
      const roomSnapshot = await db.ref(`/rooms/${roomCode}`).once('value');
      const room = roomSnapshot.val();

      if (!room || !room.members) {
        console.log(`Room ${roomCode} no longer exists or has no members`);
        return null;
      }

      // Find remaining members
      const remainingMemberIds = Object.keys(room.members).filter(
        (id) => id !== memberId
      );

      if (remainingMemberIds.length === 0) {
        console.log(`No remaining members in room ${roomCode}`);
        return null;
      }

      // Send notification to each remaining member
      const notifications = remainingMemberIds.map(async (remainingMemberId) => {
        // Get the user's push token
        const userSnapshot = await db
          .ref(`/users/${remainingMemberId}`)
          .once('value');
        const userData = userSnapshot.val();

        if (!userData?.pushToken) {
          console.log(`No push token for user ${remainingMemberId}`);
          return;
        }

        const message: admin.messaging.Message = {
          token: userData.pushToken,
          notification: {
            title: 'Partner Disconnected',
            body: 'Your duet partner has left the room.',
          },
          data: {
            type: 'partner_left',
            roomCode,
          },
          // Platform-specific options
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
          // Handle invalid tokens
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
      return null;
    } catch (error) {
      console.error('Error in onMemberLeft:', error);
      throw error;
    }
  });

/**
 * Clean up room when all members leave — but only if the room is old enough.
 * A short grace period prevents deleting rooms when the host briefly backgrounds
 * the app (e.g. to share the room code), which fires onDisconnect and empties members.
 */
export const onRoomEmpty = functions.database
  .ref('/rooms/{roomCode}/members')
  .onWrite(async (change, context) => {
    const { roomCode } = context.params;

    // If members node was deleted or is empty, check room age before deleting
    if (!change.after.exists() || !change.after.hasChildren()) {
      const roomSnap = await db.ref(`/rooms/${roomCode}`).once('value');
      const room = roomSnap.val();

      if (!room) return null;

      const createdAt = room.createdAt || 0;
      const ageMs = Date.now() - createdAt;
      const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

      if (ageMs > GRACE_PERIOD_MS) {
        console.log(`Room ${roomCode} is empty and ${Math.round(ageMs / 1000)}s old, cleaning up`);
        await db.ref(`/rooms/${roomCode}`).remove();
      } else {
        console.log(`Room ${roomCode} is empty but only ${Math.round(ageMs / 1000)}s old, keeping for grace period`);
      }
    }

    return null;
  });

/**
 * Send push notification when a friend request is created
 */
export const onFriendRequestCreated = functions.database
  .ref('/friends/{userId}/{friendId}')
  .onCreate(async (snapshot, context) => {
    const { userId, friendId } = context.params;
    const friendData = snapshot.val();

    // Only notify the recipient (the user who didn't initiate)
    if (friendData.initiatedBy === userId) {
      // The friend entry was written TO userId's list BY friendId (the initiator)
      // So userId is the recipient
      try {
        const userSnapshot = await db.ref(`/users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData?.pushToken) {
          console.log(`No push token for user ${userId}`);
          return null;
        }

        const message: admin.messaging.Message = {
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

    return null;
  });

/**
 * Send push notification when a room invitation is created
 */
export const onInvitationCreated = functions.database
  .ref('/invitations/{invitationId}')
  .onCreate(async (snapshot, context) => {
    const invitation = snapshot.val();

    if (!invitation?.toUid) {
      return null;
    }

    try {
      const userSnapshot = await db.ref(`/users/${invitation.toUid}`).once('value');
      const userData = userSnapshot.val();

      if (!userData?.pushToken) {
        console.log(`No push token for user ${invitation.toUid}`);
        return null;
      }

      const message: admin.messaging.Message = {
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
      await snapshot.ref.remove();
    } catch (error) {
      console.error('Error sending room invitation notification:', error);
    }

    return null;
  });
