import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { Resend } from 'resend';
import type { Journey, JourneyState } from './types';
import {
  welcomeEmailHtml,
  tipsEmailHtml,
  reengagementEmailHtml,
} from './templates';

// ─── Template registry ───────────────────────────────────────────────

interface TemplateResult {
  subject: string;
  html: string;
}

type TemplateRenderer = (
  displayName: string,
  userId: string,
  unsubSecret: string
) => TemplateResult;

const EMAIL_TEMPLATES: Record<string, TemplateRenderer> = {
  welcome: (displayName) => ({
    subject: `Welcome to Duet, ${displayName}!`,
    html: welcomeEmailHtml(displayName),
  }),
  tips: (displayName, userId, secret) => ({
    subject: '3 ways to get the most out of Duet',
    html: tipsEmailHtml(displayName, userId, secret),
  }),
  reengagement: (displayName, userId, secret) => ({
    subject: `Still there, ${displayName}? Your friends are waiting`,
    html: reengagementEmailHtml(displayName, userId, secret),
  }),
};

const PUSH_TEMPLATES: Record<string, (displayName: string) => { title: string; body: string }> = {
  welcome_push: (displayName) => ({
    title: `Welcome to Duet, ${displayName}!`,
    body: 'Create your first room and invite a friend to stay connected.',
  }),
};

// ─── Condition evaluator ─────────────────────────────────────────────

function evaluateCondition(
  condition: string | null,
  user: any,
  emailState: any
): boolean {
  if (!condition) return true;
  switch (condition) {
    case '!hasCreatedRoom':
      return !emailState?.hasCreatedRoom;
    case 'hasCreatedRoom':
      return !!emailState?.hasCreatedRoom;
    case 'hasEmail':
      return !!user?.profile?.email;
    case 'hasPushToken':
      return !!user?.pushToken;
    default:
      // Unknown condition — skip step to be safe
      console.warn(`[Journeys] Unknown condition: ${condition}`);
      return false;
  }
}

// ─── Journey processor ───────────────────────────────────────────────

export async function processAllJourneys(
  resendApiKey: string,
  unsubSecret: string
): Promise<{ processed: number; sent: number; skipped: number }> {
  const db = getDatabase();
  const messaging = getMessaging();
  const resend = new Resend(resendApiKey);
  const now = Date.now();

  // Load all enabled journeys
  const journeysSnap = await db.ref('marketing/journeys').once('value');
  const journeysRaw = journeysSnap.val() || {};
  const enabledJourneys: (Journey & { id: string })[] = [];
  for (const [id, j] of Object.entries(journeysRaw) as [string, any][]) {
    if (j.enabled) enabledJourneys.push({ id, ...j });
  }

  if (enabledJourneys.length === 0) {
    console.log('[Journeys] No enabled journeys');
    return { processed: 0, sent: 0, skipped: 0 };
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const journey of enabledJourneys) {
    // Load all journey states for this journey
    const statesSnap = await db.ref('marketing/journeyState').once('value');
    const allStates = statesSnap.val() || {};

    for (const [userId, userJourneys] of Object.entries(allStates) as [string, any][]) {
      const state = userJourneys?.[journey.id] as JourneyState | undefined;
      if (!state || state.completed) continue;

      processed++;

      // Get sorted steps
      const steps = journey.steps || {};
      const sortedStepKeys = Object.keys(steps).sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      const currentStepKey = sortedStepKeys[state.currentStep];
      if (!currentStepKey) {
        // All steps done
        await db.ref(`marketing/journeyState/${userId}/${journey.id}`).update({
          completed: true,
        });
        continue;
      }

      const step = steps[currentStepKey];

      // Check if delay has elapsed since last step (or journey start)
      const lastAction = state.lastStepAt || state.startedAt;
      if (now - lastAction < step.delayMs) {
        skipped++;
        continue; // Not time yet
      }

      // Load user data
      const [userSnap, emailStateSnap] = await Promise.all([
        db.ref(`users/${userId}`).once('value'),
        db.ref(`emailState/${userId}`).once('value'),
      ]);
      const user = userSnap.val();
      const emailState = emailStateSnap.val();

      if (!user) {
        // User deleted — mark journey complete
        await db.ref(`marketing/journeyState/${userId}/${journey.id}`).update({
          completed: true,
        });
        continue;
      }

      // Check unsubscribed
      if (emailState?.unsubscribed && step.channel === 'email') {
        skipped++;
        // Advance past this step
        await advanceStep(db, userId, journey.id, state, sortedStepKeys, now);
        continue;
      }

      // Evaluate condition
      if (!evaluateCondition(step.condition, user, emailState)) {
        skipped++;
        await advanceStep(db, userId, journey.id, state, sortedStepKeys, now);
        continue;
      }

      // Send the message
      let success = false;
      const displayName = user.profile?.displayName || 'there';

      if (step.channel === 'email') {
        const template = EMAIL_TEMPLATES[step.templateId];
        if (template && user.profile?.email) {
          const { subject, html } = template(displayName, userId, unsubSecret);
          try {
            const { error } = await resend.emails.send({
              from: 'Duet <hello@e.getduet.app>',
              to: user.profile.email,
              subject,
              html,
            });
            if (error) {
              console.error(`[Journeys] Email error for ${userId}:`, error);
            } else {
              success = true;
            }
          } catch (err) {
            console.error(`[Journeys] Email exception for ${userId}:`, err);
          }
        }
      } else if (step.channel === 'push') {
        const template = PUSH_TEMPLATES[step.templateId];
        if (template && user.pushToken) {
          const { title, body } = template(displayName);
          try {
            await messaging.send({
              token: user.pushToken,
              notification: { title, body },
              android: {
                priority: 'high' as const,
                notification: { channelId: 'duet_notifications', priority: 'high' as const },
              },
              apns: {
                payload: { aps: { alert: { title, body }, sound: 'default' } },
              },
            });
            success = true;
          } catch (err: any) {
            if (
              err.code === 'messaging/invalid-registration-token' ||
              err.code === 'messaging/registration-token-not-registered'
            ) {
              await db.ref(`users/${userId}/pushToken`).remove();
            }
            console.error(`[Journeys] Push error for ${userId}:`, err.code || err);
          }
        }
      }

      if (success) {
        sent++;
        // Log the send
        await db.ref('marketing/sendLog').push({
          userId,
          channel: step.channel,
          source: 'journey',
          sourceId: journey.id,
          sentAt: now,
          success: true,
          error: null,
        });

        // Update emailState tracking fields for backward compatibility
        if (step.templateId === 'tips') {
          await db.ref(`emailState/${userId}/tipsSentAt`).set(now);
        } else if (step.templateId === 'reengagement') {
          await db.ref(`emailState/${userId}/reengagementSentAt`).set(now);
        }
      }

      // Advance to next step
      await advanceStep(db, userId, journey.id, state, sortedStepKeys, now);
    }
  }

  console.log(
    `[Journeys] Done. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`
  );
  return { processed, sent, skipped };
}

async function advanceStep(
  db: ReturnType<typeof getDatabase>,
  userId: string,
  journeyId: string,
  state: JourneyState,
  sortedStepKeys: string[],
  now: number
): Promise<void> {
  const nextStep = state.currentStep + 1;
  if (nextStep >= sortedStepKeys.length) {
    await db.ref(`marketing/journeyState/${userId}/${journeyId}`).update({
      currentStep: nextStep,
      lastStepAt: now,
      completed: true,
    });
  } else {
    await db.ref(`marketing/journeyState/${userId}/${journeyId}`).update({
      currentStep: nextStep,
      lastStepAt: now,
    });
  }
}

// ─── Journey enrollment ──────────────────────────────────────────────

export async function enrollUserInJourney(
  userId: string,
  trigger: 'user_created' | 'room_created'
): Promise<void> {
  const db = getDatabase();
  const now = Date.now();

  const journeysSnap = await db.ref('marketing/journeys').once('value');
  const journeys = journeysSnap.val() || {};

  for (const [journeyId, journey] of Object.entries(journeys) as [string, any][]) {
    if (!journey.enabled || journey.trigger !== trigger) continue;

    // Check if already enrolled
    const stateSnap = await db
      .ref(`marketing/journeyState/${userId}/${journeyId}`)
      .once('value');
    if (stateSnap.exists()) continue;

    // Enroll
    const state: JourneyState = {
      startedAt: now,
      currentStep: 0,
      lastStepAt: now,
      completed: false,
    };
    await db.ref(`marketing/journeyState/${userId}/${journeyId}`).set(state);
    console.log(`[Journeys] Enrolled ${userId} in journey ${journeyId}`);
  }
}

// ─── Seed welcome journey ────────────────────────────────────────────

export async function seedWelcomeJourney(): Promise<void> {
  const db = getDatabase();
  const JOURNEY_ID = 'welcome_flow';

  const existing = await db.ref(`marketing/journeys/${JOURNEY_ID}`).once('value');
  if (existing.exists()) {
    console.log('[Journeys] Welcome journey already exists, skipping seed');
    return;
  }

  const journey: Journey = {
    name: 'Welcome Flow',
    trigger: 'user_created',
    enabled: true,
    steps: {
      '0': {
        channel: 'email',
        delayMs: 0, // Immediately (welcome email is sent by trigger, this is a placeholder)
        templateId: 'welcome',
        condition: 'hasEmail',
      },
      '1': {
        channel: 'email',
        delayMs: 24 * 60 * 60 * 1000, // 24 hours
        templateId: 'tips',
        condition: 'hasEmail',
      },
      '2': {
        channel: 'email',
        delayMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        templateId: 'reengagement',
        condition: '!hasCreatedRoom',
      },
    },
  };

  await db.ref(`marketing/journeys/${JOURNEY_ID}`).set(journey);
  console.log('[Journeys] Seeded welcome journey');
}
