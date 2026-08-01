/**
 * Minimal in-memory stand-in for the Firebase Realtime Database client.
 *
 * The global jest mock returns a single inert ref, which is enough to assert
 * "was set() called" but can't model two clients talking through shared state.
 * This fake stores a real tree and re-evaluates listeners after every write,
 * so signaling handshakes can be driven end to end in a test.
 *
 * Deliberately not supported: queries/ordering, transactions, priorities.
 */

type ListenerEvent = 'value' | 'child_added' | 'child_changed';

interface Listener {
  path: string;
  event: ListenerEvent;
  cb: (snap: FakeSnapshot) => void;
  handle: object;
  lastEmitted?: string;
  seenChildren?: Map<string, string>;
}

export interface FakeSnapshot {
  key: string | null;
  val: () => any;
  exists: () => boolean;
  hasChildren: () => boolean;
  forEach: (fn: (child: FakeSnapshot) => void) => void;
  child: (path: string) => FakeSnapshot;
}

const SERVER_TIMESTAMP = { '.sv': 'timestamp' };

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function clone<T>(v: T): T {
  return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v));
}

function isPlainObject(v: any): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Replace server-value sentinels with a concrete timestamp, as the server would. */
function resolveServerValues(value: any, now: number): any {
  if (value === SERVER_TIMESTAMP) return now;
  if (isPlainObject(value)) {
    if (value['.sv'] === 'timestamp') return now;
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveServerValues(v, now);
    return out;
  }
  return value;
}

export class FakeRtdb {
  private data: any = {};
  private listeners: Listener[] = [];
  private pushCounter = 0;
  private connected = true;
  /** Registered onDisconnect operations, keyed by path. */
  private disconnectOps = new Map<string, 'remove'>();
  /** Every path written, in order — useful for asserting write ordering. */
  public writeLog: string[] = [];

  // ── Raw tree access (test-side helpers) ──

  getRaw(path: string): any {
    let node = this.data;
    for (const seg of segments(path)) {
      if (!isPlainObject(node) || !(seg in node)) return null;
      node = node[seg];
    }
    return clone(node);
  }

  setRaw(path: string, value: any): void {
    const segs = segments(path);
    if (segs.length === 0) {
      this.data = clone(value) ?? {};
      this.flush();
      return;
    }
    let node = this.data;
    for (const seg of segs.slice(0, -1)) {
      if (!isPlainObject(node[seg])) node[seg] = {};
      node = node[seg];
    }
    const last = segs[segs.length - 1];
    const resolved = resolveServerValues(value, Date.now());
    if (resolved === null || resolved === undefined) {
      delete node[last];
    } else {
      node[last] = clone(resolved);
    }
    this.writeLog.push(path);
    this.flush();
  }

  /**
   * Fire every registered onDisconnect handler, as the server does when a
   * client's socket closes. A crashed client's handlers may never run — model
   * that by simply not calling this.
   */
  triggerOnDisconnect(pathPrefix?: string): void {
    for (const [path, op] of Array.from(this.disconnectOps.entries())) {
      if (pathPrefix && !path.startsWith(pathPrefix)) continue;
      if (op === 'remove') this.setRaw(path, null);
      this.disconnectOps.delete(path);
    }
  }

  hasOnDisconnect(path: string): boolean {
    return this.disconnectOps.has(path);
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ── Listener plumbing ──

  private register(listener: Listener): void {
    this.listeners.push(listener);
    this.emitFor(listener, true);
  }

  private unregister(path: string, event: ListenerEvent, handle: object): void {
    const i = this.listeners.findIndex(
      (l) => l.path === path && l.event === event && l.handle === handle
    );
    if (i >= 0) this.listeners.splice(i, 1);
  }

  /** Re-evaluate every listener; emit only where the relevant state changed. */
  private flush(): void {
    for (const listener of [...this.listeners]) {
      if (!this.listeners.includes(listener)) continue; // removed mid-flush
      this.emitFor(listener, false);
    }
  }

  private emitFor(listener: Listener, initial: boolean): void {
    const value = this.getRaw(listener.path);

    if (listener.event === 'value') {
      const fingerprint = JSON.stringify(value ?? null);
      if (!initial && listener.lastEmitted === fingerprint) return;
      listener.lastEmitted = fingerprint;
      listener.cb(this.snapshot(listener.path, value));
      return;
    }

    // child_added / child_changed
    const children = isPlainObject(value) ? value : {};
    const seen = listener.seenChildren!;
    for (const [key, childValue] of Object.entries(children)) {
      const fingerprint = JSON.stringify(childValue ?? null);
      const previous = seen.get(key);
      const isNew = previous === undefined;
      seen.set(key, fingerprint);
      if (listener.event === 'child_added' && isNew) {
        listener.cb(this.snapshot(`${listener.path}/${key}`, childValue));
      } else if (listener.event === 'child_changed' && !isNew && previous !== fingerprint) {
        listener.cb(this.snapshot(`${listener.path}/${key}`, childValue));
      }
    }
    for (const key of Array.from(seen.keys())) {
      if (!(key in children)) seen.delete(key);
    }
  }

  private snapshot(path: string, value: any): FakeSnapshot {
    const segs = segments(path);
    return {
      key: segs.length ? segs[segs.length - 1] : null,
      val: () => clone(value),
      exists: () => value !== null && value !== undefined,
      hasChildren: () => isPlainObject(value) && Object.keys(value).length > 0,
      forEach: (fn) => {
        if (!isPlainObject(value)) return;
        for (const [k, v] of Object.entries(value)) fn(this.snapshot(`${path}/${k}`, v));
      },
      child: (childPath: string) => {
        let node = value;
        for (const seg of segments(childPath)) {
          node = isPlainObject(node) && seg in node ? node[seg] : null;
        }
        return this.snapshot(`${path}/${childPath}`, node);
      },
    };
  }

  // ── The database() surface consumed by app code ──

  ref(path = ''): FakeRef {
    return new FakeRef(this, path);
  }

  goOffline(): void {
    this.connected = false;
    this.setRaw('.info/connected', false);
  }

  goOnline(): void {
    this.connected = true;
    this.setRaw('.info/connected', true);
  }

  _internal() {
    return {
      register: (l: Listener) => this.register(l),
      unregister: (p: string, e: ListenerEvent, h: object) => this.unregister(p, e, h),
      nextPushKey: () => `-fake${(this.pushCounter++).toString().padStart(4, '0')}`,
      snapshot: (p: string, v: any) => this.snapshot(p, v),
      registerDisconnect: (p: string) => this.disconnectOps.set(p, 'remove'),
      cancelDisconnect: (p: string) => this.disconnectOps.delete(p),
    };
  }
}

export class FakeRef {
  constructor(private db: FakeRtdb, private path: string) {}

  child(childPath: string): FakeRef {
    return new FakeRef(this.db, `${this.path}/${childPath}`.replace(/\/+/g, '/'));
  }

  async set(value: any): Promise<void> {
    this.db.setRaw(this.path, value);
  }

  async update(values: Record<string, any>): Promise<void> {
    const current = this.db.getRaw(this.path);
    const merged = isPlainObject(current) ? { ...current } : {};
    for (const [k, v] of Object.entries(values)) merged[k] = v;
    this.db.setRaw(this.path, merged);
  }

  async remove(): Promise<void> {
    this.db.setRaw(this.path, null);
  }

  async push(value?: any): Promise<FakeRef> {
    const key = this.db._internal().nextPushKey();
    const childRef = this.child(key);
    if (value !== undefined) await childRef.set(value);
    return childRef;
  }

  async once(_event: 'value'): Promise<FakeSnapshot> {
    return this.db._internal().snapshot(this.path, this.db.getRaw(this.path));
  }

  on(event: ListenerEvent, cb: (snap: FakeSnapshot) => void): (snap: FakeSnapshot) => void {
    this.db._internal().register({
      path: this.path,
      event,
      cb,
      handle: cb,
      seenChildren: event === 'value' ? undefined : new Map(),
    });
    // RTDB returns the callback so it can be passed back to off()
    return cb;
  }

  off(event: ListenerEvent, cb: (snap: FakeSnapshot) => void): void {
    this.db._internal().unregister(this.path, event, cb);
  }

  onDisconnect() {
    const path = this.path;
    const internal = this.db._internal();
    return {
      remove: async () => internal.registerDisconnect(path),
      cancel: async () => internal.cancelDisconnect(path),
      set: async () => internal.registerDisconnect(path),
    };
  }
}

/**
 * Build a `database`-shaped callable backed by one shared FakeRtdb, matching
 * how the app imports it: `database().ref(...)` plus `database.ServerValue`.
 */
export function createDatabaseMock(db: FakeRtdb) {
  const databaseFn: any = () => ({
    ref: (path?: string) => db.ref(path),
    goOffline: () => db.goOffline(),
    goOnline: () => db.goOnline(),
  });
  databaseFn.ServerValue = { TIMESTAMP: SERVER_TIMESTAMP };
  databaseFn.default = databaseFn;
  return databaseFn;
}
