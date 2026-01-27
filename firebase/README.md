# Duet Firebase Configuration

This directory contains Firebase security rules and Cloud Functions for the Duet app.

## Setup

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 2. Initialize Firebase Project

```bash
firebase init

# Select:
# - Realtime Database
# - Functions
# - Use existing project (or create new)
```

### 3. Deploy Security Rules

```bash
# Copy rules to firebase config location
cp database.rules.json ../database.rules.json

# Deploy
firebase deploy --only database
```

### 4. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Security Rules

The `database.rules.json` file contains security rules that:

1. **Validate room structure** - Ensures all room data has required fields
2. **Limit data sizes** - Prevents abuse by limiting SDP and candidate sizes
3. **Allow signaling** - Permits WebRTC offer/answer/ICE candidate exchange
4. **Protect user data** - Users can only access their own push tokens

## Cloud Functions

### `cleanupStaleRooms`
- Runs hourly via Cloud Scheduler
- Deletes rooms older than 24 hours
- Prevents database bloat from abandoned rooms

### `onMemberLeft`
- Triggered when a user leaves a room
- Sends push notification to remaining partner
- Handles invalid token cleanup

### `onRoomEmpty`
- Triggered when members collection changes
- Automatically deletes room when empty
- Ensures clean state

## Push Notifications

### Enable Push Notifications

1. **iOS**: Upload APNs key to Firebase Console > Project Settings > Cloud Messaging

2. **Android**: Download `google-services.json` and add to your app

### Register Push Tokens

The app should register push tokens on startup:

```typescript
// In your app initialization
import messaging from '@react-native-firebase/messaging';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

async function registerPushToken() {
  // Request permission (iOS)
  await messaging().requestPermission();

  // Get token
  const token = await messaging().getToken();

  // Save to database
  const userId = auth().currentUser?.uid;
  if (userId && token) {
    await database()
      .ref(`/users/${userId}`)
      .update({
        pushToken: token,
        platform: Platform.OS,
      });
  }
}
```

### Handle Notifications

```typescript
// Handle foreground notifications
messaging().onMessage(async (message) => {
  if (message.data?.type === 'partner_left') {
    // Show alert or navigate
    Alert.alert('Partner Disconnected', 'Your partner has left the room.');
  }
});

// Handle background/quit notifications
messaging().setBackgroundMessageHandler(async (message) => {
  console.log('Background message:', message);
});
```

## Environment Variables

For production, set these in Firebase:

```bash
firebase functions:config:set \
  app.environment="production"
```

## Monitoring

View function logs:

```bash
firebase functions:log

# Or in Firebase Console > Functions > Logs
```

## Cost Considerations

- **Realtime Database**: First 1GB storage and 10GB transfer free
- **Cloud Functions**: First 2M invocations free
- **Cloud Messaging**: Free (unlimited)

For a typical Duet deployment with 1000 DAU:
- Estimated cost: $0-5/month (likely within free tier)
