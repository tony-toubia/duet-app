export interface Campaign {
  name: string;
  channels: ('email' | 'push')[];
  segmentId: string;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
  email: {
    subject: string;
    body: string;
    includeUnsub: boolean;
  } | null;
  push: {
    title: string;
    body: string;
    data: Record<string, string> | null;
  } | null;
  createdAt: number;
  updatedAt: number;
  sentAt: number | null;
  results: {
    totalTargeted: number;
    emailsSent: number;
    emailsFailed: number;
    pushSent: number;
    pushFailed: number;
  } | null;
}

export interface Segment {
  name: string;
  description: string;
  lastComputedAt: number;
  memberCount: number;
  members: Record<string, true>;
}

export interface Journey {
  name: string;
  trigger: 'user_created' | 'room_created' | 'manual';
  enabled: boolean;
  steps: Record<string, JourneyStep>;
}

export interface JourneyStep {
  channel: 'email' | 'push';
  delayMs: number;
  templateId: string;
  condition: string | null;
}

export interface JourneyState {
  startedAt: number;
  currentStep: number;
  lastStepAt: number;
  completed: boolean;
}

export interface SendLogEntry {
  userId: string;
  channel: 'email' | 'push';
  source: 'campaign' | 'journey';
  sourceId: string;
  sentAt: number;
  success: boolean;
  error: string | null;
}

export interface SegmentDefinition {
  id: string;
  name: string;
  description: string;
  compute: (ctx: SegmentContext) => Set<string>;
}

export interface SegmentContext {
  users: Record<string, any>;
  emailStates: Record<string, any>;
  statuses: Record<string, any>;
  now: number;
}
