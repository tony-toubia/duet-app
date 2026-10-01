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

# Shared secret for time-limited credentials (same value as the Firebase
# secret TURN_SHARED_SECRET). Generate with: openssl rand -hex 32
use-auth-secret
static-auth-secret=REPLACE_WITH_TURN_SHARED_SECRET
```

There is deliberately no static `user=` account: a shared password ends up
in every app build and in the public web bundle.

### 3. Deploy

```bash
# Start the TURN server
docker-compose up -d

# Check logs
docker logs -f duet-turn
```

### 4. Point the app at it

The app and website never contain relay credentials. They call the
`getTurnCredentials` Cloud Function (`firebase/functions/src/userApi.ts`),
which returns per-user credentials valid for 24 hours:

```bash
# From firebase/functions/ — paste the same secret as static-auth-secret
firebase functions:secrets:set TURN_SHARED_SECRET

# firebase/functions/.env (gitignored)
TURN_HOST=YOUR_SERVER_PUBLIC_IP
# TURN_TLS_HOST=turn.yourdomain.com   # only with a valid TLS certificate
```

Then `firebase deploy --only functions`.

To test, sign in to the web app, call the function from the browser console
or the app logs, and paste the returned URL/username/credential into
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ —
a `relay` candidate means it works.

## Migrating a server that still uses a static `user=` account

Older app builds have the static password built in. To move without
breaking anyone mid-release:

1. **Bridge mode.** Set the secret (above), and in `firebase/functions/.env`:
   ```
   TURN_HOST=YOUR_SERVER_PUBLIC_IP
   TURN_AUTH_MODE=static
   TURN_STATIC_USERNAME=duet
   TURN_STATIC_PASSWORD=<current static password>
   ```
   Deploy functions. New app builds and the website now fetch the relay
   credential from the function instead of bundling it.
2. **Release** the new app builds and website.
3. **Cut over** (a few minutes' relay outage for old builds only). SSH to the
   server and edit `/opt/duet-turn/turnserver.conf`: delete the `user=` and
   `lt-cred-mech` lines, add `use-auth-secret` and
   `static-auth-secret=<TURN_SHARED_SECRET>`, add the `no-loopback-peers` and
   `denied-peer-ip=` lines from this directory's `turnserver.conf`, then
   `docker restart duet-turn`. Immediately remove `TURN_AUTH_MODE` and the
   `TURN_STATIC_*` lines from `firebase/functions/.env` and redeploy
   functions. The old static password is now dead, which completes the
   rotation.
4. **Clean up**: delete the `TURN_SERVER_IP`, `TURN_USERNAME` and
   `TURN_PASSWORD` EAS environment variables and the `NEXT_PUBLIC_TURN_*`
   Vercel variables (no longer read).

Do not change the droplet via `terraform apply` for this: cloud-init only
runs on first boot, and a `user_data` change would recreate the droplet with
a new IP (`main.tf` now ignores `user_data` changes for that reason).

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
- [Metered](https://www.metered.ca/) - Free tier (not used: Duet relays audio only through its own TURN server)
