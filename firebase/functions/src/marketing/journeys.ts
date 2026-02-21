import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { Resend } from 'resend';
import type {
  Journey,
  JourneyState,
  JourneyFlow,
  FlowJourneyState,
  FlowNode,
  FlowEdge,
  ActionData,
  ConditionData,
  DelayData,
} from './types';
import {
  welcomeEmailHtml,
  tipsEmailHtml,
  reengagementEmailHtml,
} from './templates';
import { logEvent, hasEventSince } from './events';

// ─── Template registry (for legacy + flow action nodes) ─────────────

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

// ─── Legacy condition evaluator ─────────────────────────────────────

function evaluateLegacyCondition(
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
      console.warn(`[Journeys] Unknown condition: ${condition}`);
      return false;
  }
}

// ─── Flow condition evaluator ───────────────────────────────────────

async function evaluateFlowCondition(
  condition: ConditionData,
  userId: string,
  user: any,
  emailState: any,
  enteredAt: number
): Promise<boolean> {
  switch (condition.conditionType) {
    case 'event_occurred': {
      if (!condition.eventType) return false;
      const since = condition.sinceTrigger ? enteredAt : 0;
      return hasEventSince(userId, condition.eventType, since);
    }

    case 'user_property': {
      if (!condition.field || !condition.operator) return false;
      // Resolve field value from user or emailState
      let source: any;
      if (condition.field.startsWith('preferences.') || condition.field.startsWith('profile.') || condition.field === 'pushToken' || condition.field === 'platform') {
        source = user;
      } else {
        source = emailState;
      }
      const value = getNestedValue(source, condition.field);
      return evaluateOperator(condition.operator, value, condition.value);
    }

    case 'time_elapsed': {
      // This is handled by the delay node, not typically used in conditions
      return true;
    }

    default:
      return false;
  }
}

function getNestedValue(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function evaluateOperator(operator: string, fieldValue: any, compareValue: any): boolean {
  switch (operator) {
    case 'equals': return fieldValue === compareValue;
    case 'not_equals': return fieldValue !== compareValue;
    case 'is_true': return fieldValue === true;
    case 'is_false': return fieldValue === false || fieldValue === undefined || fieldValue === null;
    case 'exists': return fieldValue !== undefined && fieldValue !== null;
    case 'not_exists': return fieldValue === undefined || fieldValue === null;
    case 'contains': return typeof fieldValue === 'string' && typeof compareValue === 'string' && fieldValue.includes(compareValue);
    case 'greater_than': return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue > compareValue;
    case 'less_than': return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue < compareValue;
    default: return false;
  }
}

// ─── Send helpers (shared by legacy + flow) ─────────────────────────

async function sendEmail(
  resend: Resend,
  userId: string,
  user: any,
  templateId: string,
  unsubSecret: string,
  customSubject?: string,
  customBody?: string
): Promise<boolean> {
  if (!user.profile?.email) return false;

  let subject: string;
  let html: string;
  const displayName = user.profile?.displayName || 'there';

  if (customSubject && customBody) {
    subject = customSubject;
    html = customBody;
  } else {
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) return false;
    const result = template(displayName, userId, unsubSecret);
    subject = result.subject;
    html = result.html;
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Duet <hello@e.getduet.app>',
      to: user.profile.email,
      subject,
      html,
    });
    if (error) {
      console.error(`[Journeys] Email error for ${userId}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Journeys] Email exception for ${userId}:`, err);
    return false;
  }
}

async function sendPush(
  messaging: ReturnType<typeof getMessaging>,
  db: ReturnType<typeof getDatabase>,
  userId: string,
  user: any,
  templateId: string,
  customTitle?: string,
  customBody?: string,
  imageUrl?: string | null,
  actionUrl?: string | null
): Promise<boolean> {
  if (!user.pushToken) return false;

  let title: string;
  let body: string;
  const displayName = user.profile?.displayName || 'there';

  if (customTitle && customBody) {
    title = customTitle;
    body = customBody;
  } else {
    const template = PUSH_TEMPLATES[templateId];
    if (!template) return false;
    const result = template(displayName);
    title = result.title;
    body = result.body;
  }

  try {
    const pushData: Record<string, string> = {};
    if (actionUrl) pushData.actionUrl = actionUrl;

    await messaging.send({
      token: user.pushToken,
      notification: {
        title,
        body,
        imageUrl: imageUrl || undefined,
      },
      data: Object.keys(pushData).length > 0 ? pushData : undefined,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'duet_notifications',
          priority: 'high' as const,
          imageUrl: imageUrl || undefined,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            ...(imageUrl ? { 'mutable-content': 1 } : {}),
          },
        },
        fcmOptions: imageUrl ? { imageUrl } : undefined,
      },
    });
    return true;
  } catch (err: any) {
    if (
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/registration-token-not-registered'
    ) {
      await db.ref(`users/${userId}/pushToken`).remove();
    }
    console.error(`[Journeys] Push error for ${userId}:`, err.code || err);
    return false;
  }
}

// ─── Legacy journey processor ───────────────────────────────────────

export async function processLegacyJourneys(
  resendApiKey: string,
  unsubSecret: string
): Promise<{ processed: number; sent: number; skipped: number }> {
  const db = getDatabase();
  const messaging = getMessaging();
  const resend = new Resend(resendApiKey);
  const now = Date.now();

  const journeysSnap = await db.ref('marketing/journeys').once('value');
  const journeysRaw = journeysSnap.val() || {};
  const legacyJourneys: (Journey & { id: string })[] = [];
  for (const [id, j] of Object.entries(journeysRaw) as [string, any][]) {
    // Legacy journeys have `steps`, flow-based have `flow`
    if (j.enabled && j.steps && !j.flow) legacyJourneys.push({ id, ...j });
  }

  if (legacyJourneys.length === 0) {
    return { processed: 0, sent: 0, skipped: 0 };
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const journey of legacyJourneys) {
    const statesSnap = await db.ref('marketing/journeyState').once('value');
    const allStates = statesSnap.val() || {};

    for (const [userId, userJourneys] of Object.entries(allStates) as [string, any][]) {
      const state = userJourneys?.[journey.id] as JourneyState | undefined;
      if (!state || state.completed) continue;

      processed++;

      const steps = journey.steps || {};
      const sortedStepKeys = Object.keys(steps).sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      const currentStepKey = sortedStepKeys[state.currentStep];
      if (!currentStepKey) {
        await db.ref(`marketing/journeyState/${userId}/${journey.id}`).update({
          completed: true,
        });
        continue;
      }

      const step = steps[currentStepKey];
      const lastAction = state.lastStepAt || state.startedAt;
      if (now - lastAction < step.delayMs) {
        skipped++;
        continue;
      }

      const [userSnap, emailStateSnap] = await Promise.all([
        db.ref(`users/${userId}`).once('value'),
        db.ref(`emailState/${userId}`).once('value'),
      ]);
      const user = userSnap.val();
      const emailState = emailStateSnap.val();

      if (!user) {
        await db.ref(`marketing/journeyState/${userId}/${journey.id}`).update({
          completed: true,
        });
        continue;
      }

      if (emailState?.unsubscribed && step.channel === 'email') {
        skipped++;
        await advanceLegacyStep(db, userId, journey.id, state, sortedStepKeys, now);
        continue;
      }

      if (!evaluateLegacyCondition(step.condition, user, emailState)) {
        skipped++;
        await advanceLegacyStep(db, userId, journey.id, state, sortedStepKeys, now);
        continue;
      }

      let success = false;
      if (step.channel === 'email') {
        success = await sendEmail(resend, userId, user, step.templateId, unsubSecret);
        if (success) await logEvent(userId, 'email_sent', { source: 'journey', sourceId: journey.id });
      } else if (step.channel === 'push') {
        success = await sendPush(messaging, db, userId, user, step.templateId);
        if (success) await logEvent(userId, 'push_received', { source: 'journey', sourceId: journey.id });
      }

      if (success) {
        sent++;
        await db.ref('marketing/sendLog').push({
          userId,
          channel: step.channel,
          source: 'journey',
          sourceId: journey.id,
          sentAt: now,
          success: true,
          error: null,
        });

        if (step.templateId === 'tips') {
          await db.ref(`emailState/${userId}/tipsSentAt`).set(now);
        } else if (step.templateId === 'reengagement') {
          await db.ref(`emailState/${userId}/reengagementSentAt`).set(now);
        }
      }

      await advanceLegacyStep(db, userId, journey.id, state, sortedStepKeys, now);
    }
  }

  if (processed > 0) {
    console.log(
      `[Journeys/Legacy] Done. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`
    );
  }
  return { processed, sent, skipped };
}

async function advanceLegacyStep(
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

// ─── Flow-based journey processor (DAG traversal) ───────────────────

export async function processJourneyFlows(
  resendApiKey: string,
  unsubSecret: string
): Promise<{ processed: number; sent: number; skipped: number }> {
  const db = getDatabase();
  const messaging = getMessaging();
  const resend = new Resend(resendApiKey);
  const now = Date.now();

  const journeysSnap = await db.ref('marketing/journeys').once('value');
  const journeysRaw = journeysSnap.val() || {};
  const flowJourneys: (JourneyFlow & { id: string })[] = [];
  for (const [id, j] of Object.entries(journeysRaw) as [string, any][]) {
    if (j.enabled && j.flow) flowJourneys.push({ id, ...j });
  }

  if (flowJourneys.length === 0) {
    return { processed: 0, sent: 0, skipped: 0 };
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const journey of flowJourneys) {
    const nodes = journey.flow.nodes || [];
    const edges = journey.flow.edges || [];

    // Build adjacency map: sourceId -> edges[]
    const adjacency = new Map<string, FlowEdge[]>();
    for (const edge of edges) {
      const existing = adjacency.get(edge.source) || [];
      existing.push(edge);
      adjacency.set(edge.source, existing);
    }

    // Build node lookup
    const nodeMap = new Map<string, FlowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Load all flow journey states
    const statesSnap = await db.ref('marketing/flowJourneyState').once('value');
    const allStates = statesSnap.val() || {};

    for (const [userId, userJourneys] of Object.entries(allStates) as [string, any][]) {
      const state = userJourneys?.[journey.id] as FlowJourneyState | undefined;
      if (!state || state.completed) continue;

      processed++;

      const currentNode = nodeMap.get(state.currentNodeId);
      if (!currentNode) {
        // Node was deleted from flow — mark complete
        await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
          completed: true,
          lastProcessedAt: now,
        });
        continue;
      }

      // Load user data
      const [userSnap, emailStateSnap] = await Promise.all([
        db.ref(`users/${userId}`).once('value'),
        db.ref(`emailState/${userId}`).once('value'),
      ]);
      const user = userSnap.val();
      const emailState = emailStateSnap.val();

      if (!user) {
        await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
          completed: true,
          lastProcessedAt: now,
        });
        continue;
      }

      switch (currentNode.type) {
        case 'trigger': {
          // Trigger node — immediately advance to next
          const nextNodeId = getNextNodeId(adjacency, currentNode.id);
          if (nextNodeId) {
            await advanceFlowNode(db, userId, journey.id, nextNodeId, now, state.path);
          } else {
            await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
              completed: true,
              lastProcessedAt: now,
            });
          }
          break;
        }

        case 'delay': {
          const delayData = currentNode.data as DelayData;
          const waitingSince = state.waitingSince || state.lastProcessedAt;
          if (now - waitingSince >= delayData.delayMs) {
            const nextNodeId = getNextNodeId(adjacency, currentNode.id);
            if (nextNodeId) {
              await advanceFlowNode(db, userId, journey.id, nextNodeId, now, state.path);
            } else {
              await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
                completed: true,
                lastProcessedAt: now,
              });
            }
          } else {
            skipped++;
            // Ensure waitingSince is set
            if (!state.waitingSince) {
              await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
                waitingSince: now,
              });
            }
          }
          break;
        }

        case 'condition': {
          const condData = currentNode.data as ConditionData;
          const result = await evaluateFlowCondition(
            condData,
            userId,
            user,
            emailState,
            state.enteredAt
          );
          // Find yes/no edge
          const outEdges = adjacency.get(currentNode.id) || [];
          const yesEdge = outEdges.find((e) => e.sourceHandle === 'yes');
          const noEdge = outEdges.find((e) => e.sourceHandle === 'no');
          const targetEdge = result ? yesEdge : noEdge;

          if (targetEdge) {
            await advanceFlowNode(db, userId, journey.id, targetEdge.target, now, state.path);
          } else {
            // No matching edge — complete
            await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
              completed: true,
              lastProcessedAt: now,
            });
          }
          break;
        }

        case 'action': {
          const actionData = currentNode.data as ActionData;

          // Check unsubscribed for email
          if (actionData.channel === 'email' && emailState?.unsubscribed) {
            skipped++;
            const nextNodeId = getNextNodeId(adjacency, currentNode.id);
            if (nextNodeId) {
              await advanceFlowNode(db, userId, journey.id, nextNodeId, now, state.path);
            } else {
              await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
                completed: true,
                lastProcessedAt: now,
              });
            }
            break;
          }

          let success = false;
          if (actionData.channel === 'email') {
            success = await sendEmail(
              resend,
              userId,
              user,
              actionData.templateId,
              unsubSecret,
              actionData.customSubject,
              actionData.customBody
            );
            if (success) await logEvent(userId, 'email_sent', { source: 'journey', sourceId: journey.id });
          } else if (actionData.channel === 'push') {
            success = await sendPush(
              messaging,
              db,
              userId,
              user,
              actionData.templateId,
              actionData.customTitle,
              actionData.customBody,
              actionData.pushImageUrl,
              actionData.pushActionUrl
            );
            if (success) await logEvent(userId, 'push_received', { source: 'journey', sourceId: journey.id });
          }

          if (success) {
            sent++;
            await db.ref('marketing/sendLog').push({
              userId,
              channel: actionData.channel,
              source: 'journey',
              sourceId: journey.id,
              sentAt: now,
              success: true,
              error: null,
            });
          }

          // Advance regardless of success
          const nextNodeId = getNextNodeId(adjacency, currentNode.id);
          if (nextNodeId) {
            await advanceFlowNode(db, userId, journey.id, nextNodeId, now, state.path);
          } else {
            await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
              completed: true,
              lastProcessedAt: now,
            });
          }
          break;
        }

        case 'exit': {
          await db.ref(`marketing/flowJourneyState/${userId}/${journey.id}`).update({
            completed: true,
            lastProcessedAt: now,
          });
          break;
        }

        default:
          skipped++;
      }
    }
  }

  if (processed > 0) {
    console.log(
      `[Journeys/Flow] Done. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`
    );
  }
  return { processed, sent, skipped };
}

function getNextNodeId(adjacency: Map<string, FlowEdge[]>, nodeId: string): string | null {
  const edges = adjacency.get(nodeId);
  if (!edges || edges.length === 0) return null;
  // For non-condition nodes, take the first (only) edge
  return edges[0].target;
}

async function advanceFlowNode(
  db: ReturnType<typeof getDatabase>,
  userId: string,
  journeyId: string,
  nextNodeId: string,
  now: number,
  currentPath: string[]
): Promise<void> {
  await db.ref(`marketing/flowJourneyState/${userId}/${journeyId}`).update({
    currentNodeId: nextNodeId,
    lastProcessedAt: now,
    waitingSince: null,
    path: [...(currentPath || []), nextNodeId],
  });
}

// ─── Combined processor (calls both legacy + flow) ──────────────────

export async function processAllJourneys(
  resendApiKey: string,
  unsubSecret: string
): Promise<{ processed: number; sent: number; skipped: number }> {
  const [legacy, flow] = await Promise.all([
    processLegacyJourneys(resendApiKey, unsubSecret),
    processJourneyFlows(resendApiKey, unsubSecret),
  ]);

  return {
    processed: legacy.processed + flow.processed,
    sent: legacy.sent + flow.sent,
    skipped: legacy.skipped + flow.skipped,
  };
}

// ─── Journey enrollment ─────────────────────────────────────────────

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

    if (journey.flow) {
      // Flow-based journey — find the trigger node
      const stateSnap = await db
        .ref(`marketing/flowJourneyState/${userId}/${journeyId}`)
        .once('value');
      if (stateSnap.exists()) continue;

      const nodes: FlowNode[] = journey.flow.nodes || [];
      const triggerNode = nodes.find((n: FlowNode) => n.type === 'trigger');
      if (!triggerNode) continue;

      const state: FlowJourneyState = {
        enteredAt: now,
        currentNodeId: triggerNode.id,
        lastProcessedAt: now,
        waitingSince: null,
        completed: false,
        path: [triggerNode.id],
      };
      await db.ref(`marketing/flowJourneyState/${userId}/${journeyId}`).set(state);
      console.log(`[Journeys] Enrolled ${userId} in flow journey ${journeyId}`);
    } else {
      // Legacy journey
      const stateSnap = await db
        .ref(`marketing/journeyState/${userId}/${journeyId}`)
        .once('value');
      if (stateSnap.exists()) continue;

      const state: JourneyState = {
        startedAt: now,
        currentStep: 0,
        lastStepAt: now,
        completed: false,
      };
      await db.ref(`marketing/journeyState/${userId}/${journeyId}`).set(state);
      console.log(`[Journeys] Enrolled ${userId} in legacy journey ${journeyId}`);
    }
  }
}

// ─── Seed welcome journey (flow format) ─────────────────────────────

export async function seedWelcomeJourney(): Promise<void> {
  const db = getDatabase();
  const JOURNEY_ID = 'welcome_flow';

  const existing = await db.ref(`marketing/journeys/${JOURNEY_ID}`).once('value');
  if (existing.exists()) {
    console.log('[Journeys] Welcome journey already exists, skipping seed');
    return;
  }

  const now = Date.now();
  const journey: JourneyFlow = {
    name: 'Welcome Flow',
    trigger: 'user_created',
    enabled: true,
    flow: {
      nodes: [
        { id: 'trigger_1', type: 'trigger', position: { x: 250, y: 0 }, data: { triggerType: 'user_created' } },
        { id: 'action_1', type: 'action', position: { x: 250, y: 120 }, data: { channel: 'email', templateId: 'welcome' } },
        { id: 'delay_1', type: 'delay', position: { x: 250, y: 240 }, data: { delayMs: 24 * 60 * 60 * 1000 } },
        { id: 'cond_1', type: 'condition', position: { x: 250, y: 360 }, data: { conditionType: 'event_occurred', eventType: 'room_created', sinceTrigger: true } },
        { id: 'exit_1', type: 'exit', position: { x: 450, y: 480 }, data: {} },
        { id: 'action_2', type: 'action', position: { x: 100, y: 480 }, data: { channel: 'email', templateId: 'tips' } },
        { id: 'delay_2', type: 'delay', position: { x: 100, y: 600 }, data: { delayMs: 7 * 24 * 60 * 60 * 1000 } },
        { id: 'cond_2', type: 'condition', position: { x: 100, y: 720 }, data: { conditionType: 'event_occurred', eventType: 'room_created', sinceTrigger: true } },
        { id: 'exit_2', type: 'exit', position: { x: 300, y: 840 }, data: {} },
        { id: 'action_3', type: 'action', position: { x: -50, y: 840 }, data: { channel: 'email', templateId: 'reengagement' } },
        { id: 'exit_3', type: 'exit', position: { x: -50, y: 960 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'action_1' },
        { id: 'e2', source: 'action_1', target: 'delay_1' },
        { id: 'e3', source: 'delay_1', target: 'cond_1' },
        { id: 'e4', source: 'cond_1', target: 'exit_1', sourceHandle: 'yes' },
        { id: 'e5', source: 'cond_1', target: 'action_2', sourceHandle: 'no' },
        { id: 'e6', source: 'action_2', target: 'delay_2' },
        { id: 'e7', source: 'delay_2', target: 'cond_2' },
        { id: 'e8', source: 'cond_2', target: 'exit_2', sourceHandle: 'yes' },
        { id: 'e9', source: 'cond_2', target: 'action_3', sourceHandle: 'no' },
        { id: 'e10', source: 'action_3', target: 'exit_3' },
      ],
    },
    createdAt: now,
    updatedAt: now,
  };

  await db.ref(`marketing/journeys/${JOURNEY_ID}`).set(journey);
  console.log('[Journeys] Seeded welcome journey (flow format)');
}
