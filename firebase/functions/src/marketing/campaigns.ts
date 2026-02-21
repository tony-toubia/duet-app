import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { Resend } from 'resend';
import type { Campaign } from './types';
import { campaignEmailHtml, baseEmailLayout } from './templates';

export async function executeCampaign(
  campaignId: string,
  resendApiKey: string,
  unsubSecret: string
): Promise<void> {
  const db = getDatabase();
  const messaging = getMessaging();
  const campaignRef = db.ref(`marketing/campaigns/${campaignId}`);

  const snap = await campaignRef.once('value');
  const campaign = snap.val() as Campaign | null;
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status !== 'draft' && campaign.status !== 'queued') {
    throw new Error(`Campaign ${campaignId} is ${campaign.status}, not sendable`);
  }

  await campaignRef.update({ status: 'sending' });

  const segmentSnap = await db.ref(`marketing/segments/${campaign.segmentId}/members`).once('value');
  const members: Record<string, true> = segmentSnap.val() || {};
  const memberIds = Object.keys(members);

  if (memberIds.length === 0) {
    await campaignRef.update({
      status: 'sent',
      sentAt: Date.now(),
      results: { totalTargeted: 0, emailsSent: 0, emailsFailed: 0, pushSent: 0, pushFailed: 0 },
    });
    return;
  }

  const resend = new Resend(resendApiKey);
  const sendEmail = campaign.channels.includes('email') && campaign.email;
  const sendPush = campaign.channels.includes('push') && campaign.push;

  let emailsSent = 0;
  let emailsFailed = 0;
  let pushSent = 0;
  let pushFailed = 0;

  // Process in batches of 10 to avoid overwhelming APIs
  const BATCH_SIZE = 10;
  for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
    const batch = memberIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (userId) => {
      const userSnap = await db.ref(`users/${userId}`).once('value');
      const user = userSnap.val();
      if (!user) return;

      // Send email
      if (sendEmail && campaign.email && user.profile?.email) {
        const emailStateSnap = await db.ref(`emailState/${userId}/unsubscribed`).once('value');
        if (emailStateSnap.val()) {
          // Skip unsubscribed users
        } else {
          try {
            const html = campaignEmailHtml(
              campaign.email.body,
              userId,
              unsubSecret,
              campaign.email.includeUnsub
            );
            const { error } = await resend.emails.send({
              from: 'Duet <hello@e.getduet.app>',
              to: user.profile.email,
              subject: campaign.email.subject,
              html,
            });
            if (error) {
              console.error(`[Campaign] Email error for ${userId}:`, error);
              emailsFailed++;
            } else {
              emailsSent++;
            }
          } catch (err) {
            console.error(`[Campaign] Email exception for ${userId}:`, err);
            emailsFailed++;
          }
        }
      }

      // Send push
      if (sendPush && campaign.push && user.pushToken) {
        try {
          await messaging.send({
            token: user.pushToken,
            notification: {
              title: campaign.push.title,
              body: campaign.push.body,
            },
            data: campaign.push.data || undefined,
            android: {
              priority: 'high' as const,
              notification: { channelId: 'duet_notifications', priority: 'high' as const },
            },
            apns: {
              payload: {
                aps: {
                  alert: { title: campaign.push.title, body: campaign.push.body },
                  sound: 'default',
                },
              },
            },
          });
          pushSent++;
        } catch (err: any) {
          if (
            err.code === 'messaging/invalid-registration-token' ||
            err.code === 'messaging/registration-token-not-registered'
          ) {
            await db.ref(`users/${userId}/pushToken`).remove();
          }
          pushFailed++;
        }
      }

      // Log send
      await db.ref('marketing/sendLog').push({
        userId,
        channel: sendEmail && sendPush ? 'email' : sendEmail ? 'email' : 'push',
        source: 'campaign',
        sourceId: campaignId,
        sentAt: Date.now(),
        success: true,
        error: null,
      });
    });

    await Promise.all(promises);
  }

  await campaignRef.update({
    status: 'sent',
    sentAt: Date.now(),
    results: {
      totalTargeted: memberIds.length,
      emailsSent,
      emailsFailed,
      pushSent,
      pushFailed,
    },
  });

  console.log(`[Campaign] ${campaignId} sent. Email: ${emailsSent}/${emailsSent + emailsFailed}, Push: ${pushSent}/${pushSent + pushFailed}`);
}

export function previewCampaignEmail(bodyHtml: string, includeUnsub: boolean): string {
  if (includeUnsub) {
    return baseEmailLayout(
      `${bodyHtml}<p style="margin:16px 0 0;text-align:center;font-size:11px;color:rgba(255,255,255,0.25);"><a href="#" style="color:rgba(255,255,255,0.25);text-decoration:underline;">Unsubscribe from Duet emails</a></p>`
    );
  }
  return baseEmailLayout(bodyHtml);
}
