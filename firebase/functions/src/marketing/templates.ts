import { createHmac } from 'crypto';

// ─── HMAC helpers ────────────────────────────────────────────────────

export function generateUnsubToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 16);
}

export function generateClickToken(userId: string, url: string, secret: string): string {
  return createHmac('sha256', secret).update(`${userId}:${url}`).digest('hex').slice(0, 16);
}

export function generateOpenToken(userId: string, sourceId: string, secret: string): string {
  return createHmac('sha256', secret).update(`open:${userId}:${sourceId}`).digest('hex').slice(0, 16);
}

export function clickTrackUrl(
  userId: string,
  destination: string,
  source: string,
  sourceId: string,
  secret: string
): string {
  const token = generateClickToken(userId, destination, secret);
  const params = new URLSearchParams({ uid: userId, url: destination, src: source, sid: sourceId, t: token });
  return `https://us-central1-duet-33cf5.cloudfunctions.net/emailClick?${params.toString()}`;
}

export function openTrackPixel(
  userId: string,
  source: string,
  sourceId: string,
  secret: string
): string {
  const token = generateOpenToken(userId, sourceId, secret);
  const params = new URLSearchParams({ uid: userId, src: source, sid: sourceId, t: token });
  return `<img src="https://us-central1-duet-33cf5.cloudfunctions.net/emailOpen?${params.toString()}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}

export function unsubscribeUrl(userId: string, secret: string): string {
  const token = generateUnsubToken(userId, secret);
  return `https://us-central1-duet-33cf5.cloudfunctions.net/unsubscribe?uid=${userId}&t=${token}`;
}

export function unsubscribeFooter(userId: string, secret: string): string {
  const url = unsubscribeUrl(userId, secret);
  return `<p style="margin:16px 0 0;text-align:center;font-size:11px;color:rgba(255,255,255,0.25);"><a href="${url}" style="color:rgba(255,255,255,0.25);text-decoration:underline;">Unsubscribe from Duet emails</a></p>`;
}

// ─── Email layout ────────────────────────────────────────────────────

export function baseEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Duet</title></head>
<body style="margin:0;padding:0;background-color:#1a293d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a293d;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#243447;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="padding:32px 24px 16px;">
  <img src="https://getduet.app/duet-logo-white.png" alt="Duet" width="64" height="64" style="display:block;"/>
</td></tr>
<tr><td style="padding:0 32px 32px;color:#f4dbc8;font-size:16px;line-height:1.6;">
${content}
</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
  <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;">Duet &mdash; Always-on voice for the people who matter most.</p>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.3);font-size:11px;"><a href="https://getduet.app" style="color:rgba(255,255,255,0.3);text-decoration:underline;">getduet.app</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
<tr><td align="center" style="background-color:#e8734a;border-radius:12px;">
  <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${text}</a>
</td></tr></table>`;
}

// ─── Journey email templates ─────────────────────────────────────────

export function welcomeEmailHtml(displayName: string): string {
  return baseEmailLayout(`
<h1 style="margin:0 0 16px;color:#ffffff;font-size:24px;font-weight:700;">Welcome to Duet, ${displayName}!</h1>
<p style="margin:0 0 12px;">You just joined the easiest way to stay connected with the people who matter most.</p>
<p style="margin:0 0 12px;">Duet gives you always-on voice rooms that stay open in the background &mdash; like being in the same room, even when you&rsquo;re miles apart. Keep your music on, go about your day, and talk when the moment hits.</p>
<p style="margin:0 0 4px;">Here&rsquo;s how to get started:</p>
<ol style="margin:8px 0 0;padding-left:20px;">
  <li style="margin-bottom:6px;">Tap <strong>Create Room</strong> to start a voice room</li>
  <li style="margin-bottom:6px;">Share the 6-character code with a friend, partner, or study buddy</li>
  <li style="margin-bottom:6px;">Talk while you drive, explore, study, or just hang out</li>
</ol>
${ctaButton('Create Your First Room', 'https://getduet.app/app')}
<p style="margin:0;text-align:center;font-size:14px;color:rgba(244,219,200,0.6);">
  Also available on <a href="https://play.google.com/store/apps/details?id=com.duet.app" style="color:#e8734a;text-decoration:underline;">Google Play</a>
</p>`);
}

export function tipsEmailHtml(displayName: string, userId: string, secret: string): string {
  return baseEmailLayout(`
<h1 style="margin:0 0 16px;color:#ffffff;font-size:24px;font-weight:700;">3 ways to get the most out of Duet</h1>
<p style="margin:0 0 16px;">Hey ${displayName}, here are a few ideas to try this week:</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
  <strong style="color:#e8734a;font-size:18px;">1.</strong>
  <strong style="color:#ffffff;"> Drive with company</strong><br/>
  <span style="font-size:14px;color:rgba(244,219,200,0.7);">Create a room before your commute or next rideshare shift. Share the code and keep a friend on the line &mdash; no awkward speakerphone needed.</span>
</td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
  <strong style="color:#e8734a;font-size:18px;">2.</strong>
  <strong style="color:#ffffff;"> Stay close while you explore</strong><br/>
  <span style="font-size:14px;color:rgba(244,219,200,0.7);">Heading out with someone? Keep your own headphones in and music playing. Duet mixes your audio so you hear each other and your playlist.</span>
</td></tr>
<tr><td style="padding:12px 0;">
  <strong style="color:#e8734a;font-size:18px;">3.</strong>
  <strong style="color:#ffffff;"> Study or work side-by-side</strong><br/>
  <span style="font-size:14px;color:rgba(244,219,200,0.7);">Open a room with a friend while you both do your thing. It&rsquo;s like a casual voice room &mdash; talk when you want, quiet when you don&rsquo;t.</span>
</td></tr>
</table>
${ctaButton('Open Duet', 'https://getduet.app/app')}
${unsubscribeFooter(userId, secret)}`);
}

export function reengagementEmailHtml(displayName: string, userId: string, secret: string): string {
  return baseEmailLayout(`
<h1 style="margin:0 0 16px;color:#ffffff;font-size:24px;font-weight:700;">Your friends are waiting, ${displayName}</h1>
<p style="margin:0 0 12px;">It looks like you haven&rsquo;t created a room yet. Duet works best when you&rsquo;re connected with someone &mdash; and it only takes one tap to start.</p>
<p style="margin:0 0 12px;">Here&rsquo;s an idea: think of someone you&rsquo;d normally text throughout the day. A partner you commute separately from. A friend you study with. A sibling across the country. Send them the app link and try leaving a room open for an hour.</p>
<p style="margin:0 0 20px;padding:16px;background-color:rgba(232,115,74,0.15);border-left:3px solid #e8734a;border-radius:4px;font-size:14px;color:rgba(244,219,200,0.8);">
  Duet users keep rooms open for hours &mdash; driving, studying, cooking. It&rsquo;s like being together without trying to be.
</p>
${ctaButton('Create a Room Now', 'https://getduet.app/app')}
<p style="margin:0;text-align:center;font-size:13px;color:rgba(244,219,200,0.5);">Need help getting started? Just reply to this email.</p>
${unsubscribeFooter(userId, secret)}`);
}

// ─── Link wrapping for click tracking ────────────────────────────────

export function wrapLinksWithClickTracking(
  html: string,
  userId: string,
  source: string,
  sourceId: string,
  secret: string
): string {
  const unsubDomain = 'cloudfunctions.net/unsubscribe';
  return html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => {
      // Don't wrap unsubscribe links or click track links (avoid double-wrapping)
      if (url.includes(unsubDomain) || url.includes('emailClick')) return `href="${url}"`;
      const tracked = clickTrackUrl(userId, url, source, sourceId, secret);
      return `href="${tracked}"`;
    }
  );
}

// ─── Campaign email wrapper ──────────────────────────────────────────

export function campaignEmailHtml(
  bodyHtml: string,
  userId: string,
  secret: string,
  includeUnsub: boolean,
  source?: string,
  sourceId?: string
): string {
  const unsub = includeUnsub ? unsubscribeFooter(userId, secret) : '';
  let content = `${bodyHtml}${unsub}`;
  // Wrap links with click tracking and add open tracking pixel when source info is provided
  if (source && sourceId) {
    content = wrapLinksWithClickTracking(content, userId, source, sourceId, secret);
    content += openTrackPixel(userId, source, sourceId, secret);
  }
  return baseEmailLayout(content);
}

// ─── Unsubscribe confirmation page ───────────────────────────────────

export function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Duet - Unsubscribe</title></head>
<body style="margin:0;padding:60px 20px;background-color:#1a293d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
<img src="https://getduet.app/duet-logo-white.png" alt="Duet" width="48" height="48" style="display:inline-block;margin-bottom:24px;"/>
<h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">${success ? 'Unsubscribed' : 'Error'}</h1>
<p style="color:#f4dbc8;font-size:16px;margin:0 0 24px;">${message}</p>
<a href="https://getduet.app" style="color:#e8734a;font-size:14px;text-decoration:underline;">Back to Duet</a>
</body></html>`;
}
