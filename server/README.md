# Duet TURN Server Deployment

This directory contains configuration for deploying your own TURN server using coturn.

## Why You Need a TURN Server

STUN servers help peers discover their public IP, but they don't relay traffic. When both peers are behind symmetric NATs or restrictive firewalls, they cannot establish a direct connection. A TURN server relays the traffic in these cases.

## Quick Deployment

### 1. Server Requirements

- A server with a public IP address
- Open firewall ports:
  - 3478 (UDP/TCP) - STUN/TURN
  - 5349 (TCP) - TURN over TLS
  - 49152-65535 (UDP) - Media relay range

### 2. Configure

Edit `turnserver.conf`:

```bash
# Replace with your server's public IP
external-ip=YOUR_SERVER_PUBLIC_IP

# Replace with your domain
realm=turn.yourdomain.com

# Generate a strong password
# openssl rand -hex 32
user=duet:YOUR_STRONG_PASSWORD
```

### 3. Deploy

```bash
# Start the TURN server
docker-compose up -d

# Check logs
docker logs -f duet-turn

# Test TURN server
# Use https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
```

### 4. Update App Configuration

In `src/services/WebRTCService.ts`, update the ICE servers:

```typescript
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.yourdomain.com:3478',
      username: 'duet',
      credential: 'YOUR_STRONG_PASSWORD',
    },
    {
      urls: 'turn:turn.yourdomain.com:5349?transport=tcp',
      username: 'duet',
      credential: 'YOUR_STRONG_PASSWORD',
    },
  ],
};
```

## Production Recommendations

### TLS/SSL

For production, enable TLS:

1. Obtain certificates (Let's Encrypt recommended):
   ```bash
   certbot certonly --standalone -d turn.yourdomain.com
   ```

2. Copy certs to `./certs/`:
   ```bash
   cp /etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem ./certs/
   cp /etc/letsencrypt/live/turn.yourdomain.com/privkey.pem ./certs/
   ```

3. Uncomment TLS lines in `turnserver.conf`

### Time-Limited Credentials

For better security, use time-limited credentials:

1. Set a shared secret in `turnserver.conf`:
   ```
   use-auth-secret
   static-auth-secret=YOUR_SHARED_SECRET
   ```

2. Generate credentials in your backend:
   ```javascript
   const crypto = require('crypto');

   function generateTurnCredentials(secret, userId) {
     const timestamp = Math.floor(Date.now() / 1000) + 24 * 3600; // 24h validity
     const username = `${timestamp}:${userId}`;
     const hmac = crypto.createHmac('sha1', secret);
     hmac.update(username);
     const credential = hmac.digest('base64');
     return { username, credential };
   }
   ```

### Monitoring

Monitor your TURN server:

```bash
# Connection count
docker exec duet-turn turnadmin -l

# Bandwidth usage
docker stats duet-turn
```

## Cost Estimation

TURN servers relay media traffic, so costs depend on usage:

- **Bandwidth**: ~50-100 Kbps per active audio stream
- **Monthly estimate**: For 100 daily active pairs, ~50GB/month
- **Server**: A small VPS ($5-10/month) can handle ~100 concurrent connections

## Alternatives

If you don't want to self-host:

- [Twilio TURN](https://www.twilio.com/stun-turn) - Pay per GB
- [Xirsys](https://xirsys.com/) - Free tier available
- [Metered](https://www.metered.ca/) - Free tier (currently used as fallback)
