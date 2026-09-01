import simpleDDP from 'simpleddp';
import { DDP_CONFIG } from '../../config/ddpConfig';

interface PoolItem {
  subId: string;
  name: string;
  params: any[];
  paramsKey: string;
  lastUsed: number;
}

type CollectionChangeListener = (collectionName: string) => void;
type StatusListener = (connected: boolean, userId: string | null, isResuming: boolean) => void;

class DDPSubscriptionPool {
  public client: any;
  private pool: Map<string, PoolItem> = new Map();
  private maxPoolSize: number = DDP_CONFIG.MAX_SUBSCRIPTION_POOL_SIZE;
  private isConnected: boolean = false;
  private isResuming: boolean = !!localStorage.getItem(DDP_CONFIG.AUTH_TOKEN_KEY);
  private currentUserId: string | null = null;
  private currentUsername: string | null = localStorage.getItem('btsbots_cached_username') || null;
  private subCounter = 0;
  
  private collectionListeners: Set<CollectionChangeListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor() {
    this.initClient();
    if (typeof window !== 'undefined') {
      (window as any).ddp = this;
    }
  }

  private initClient() {
    this.client = new (simpleDDP as any)({
      endpoint: DDP_CONFIG.ENDPOINT,
      SocketConstructor: WebSocket,
      reconnectInterval: DDP_CONFIG.AUTO_RECONNECT_INTERVAL,
      autoConnect: true,
      autoReconnect: true
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on('connected', async () => {
      this.isConnected = true;
      await this.resumeSession();
      this.reSubAll();
      this.notifyStatus();
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      this.notifyStatus();
    });

    const notifyChange = (coll: string) => {
      this.collectionListeners.forEach(fn => fn(coll));
    };

    ['added', 'changed', 'removed'].forEach(evt => {
      this.client.on(evt, (data: any) => {
        if (data && data.collection) {
          notifyChange(data.collection);
        }
      });
    });
  }

  public async resumeSession(): Promise<any> {
    const token = localStorage.getItem(DDP_CONFIG.AUTH_TOKEN_KEY);
    if (!token) {
      this.isResuming = false;
      this.notifyStatus();
      return null;
    }

    this.isResuming = true;
    this.notifyStatus();

    try {
      const res = await this.client.call('login', { resume: token });
      if (res && res.id) {
        this.currentUserId = res.id;
        const userDoc = this.client.collection(DDP_CONFIG.COLLECTIONS.USERS)?.filter((u: any) => u._id === res.id).fetch()?.[0];
        this.currentUsername = userDoc?.username || localStorage.getItem('btsbots_cached_username') || null;
      }
    } catch (err) {
      console.warn('[DDP] 会话恢复失败或 Token 已失效:', err);
      localStorage.removeItem(DDP_CONFIG.AUTH_TOKEN_KEY);
      localStorage.removeItem('btsbots_cached_username');
      this.currentUserId = null;
      this.currentUsername = null;
    } finally {
      this.isResuming = false;
      this.notifyStatus();
    }
    return null;
  }

  private reSubAll() {
    for (const item of this.pool.values()) {
      this.rawSendSub(item.subId, item.name, item.params);
    }
  }

  public rawSendSub(id: string, name: string, params: any[]) {
    try {
      const socket = this.client?.ddpConnection?.socket;
      if (socket && socket.rawSocket && socket.rawSocket.readyState === WebSocket.OPEN) {
        socket.send({
          msg: 'sub',
          id: id,
          name: name,
          params: params
        });
      }
    } catch (e) {
      console.error('[DDP] 发送 sub 失败:', e);
    }
  }

  public rawSendUnsub(id: string) {
    try {
      const socket = this.client?.ddpConnection?.socket;
      if (socket && socket.rawSocket && socket.rawSocket.readyState === WebSocket.OPEN) {
        socket.send({
          msg: 'unsub',
          id: id
        });
      }
    } catch (e) {
      console.error('[DDP] 发送 unsub 失败:', e);
    }
  }

  public subscribe(name: string, ...params: any[]): string {
    const paramsKey = `${name}::${JSON.stringify(params)}`;
    const now = Date.now();

    if (this.pool.has(paramsKey)) {
      const item = this.pool.get(paramsKey)!;
      item.lastUsed = now;
      return item.subId;
    }

    if (this.pool.size >= this.maxPoolSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, item] of this.pool.entries()) {
        if (item.lastUsed < oldestTime) {
          oldestTime = item.lastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const itemToRemove = this.pool.get(oldestKey)!;
        this.rawSendUnsub(itemToRemove.subId);
        this.pool.delete(oldestKey);
      }
    }

    this.subCounter += 1;
    const subId = `sub_${Date.now()}_${this.subCounter}`;
    const newItem: PoolItem = {
      subId,
      name,
      params,
      paramsKey,
      lastUsed: now
    };

    this.pool.set(paramsKey, newItem);
    this.rawSendSub(subId, name, params);

    return subId;
  }

  public async call<T = any>(methodName: string, ...args: any[]): Promise<T> {
    return this.client.call(methodName, ...args);
  }

  public getCollection(collectionName: string) {
    return this.client.collection(collectionName);
  }

  public async loginWithOtp(account: string, token: string): Promise<any> {
    const cleanUser = account.trim().toLowerCase();
    const loginPayload = {
      otp: {
        account: cleanUser,
        token: token.trim(),
        clientType: 'web'
      }
    };

    const res = await this.client.call('login', loginPayload);
    if (res && res.token) {
      localStorage.setItem(DDP_CONFIG.AUTH_TOKEN_KEY, res.token);
      localStorage.setItem('btsbots_cached_username', cleanUser);
    }
    this.currentUserId = res?.id || null;
    this.currentUsername = cleanUser;
    this.isResuming = false;
    this.notifyStatus();
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.client.call('logout');
    } catch {}
    localStorage.removeItem(DDP_CONFIG.AUTH_TOKEN_KEY);
    localStorage.removeItem('btsbots_cached_username');
    this.currentUserId = null;
    this.currentUsername = null;
    this.isResuming = false;
    this.notifyStatus();
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      userId: this.currentUserId,
      username: this.currentUsername,
      isResuming: this.isResuming
    };
  }

  public onCollectionChange(listener: CollectionChangeListener) {
    this.collectionListeners.add(listener);
    return () => { this.collectionListeners.delete(listener); };
  }

  public onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }

  private notifyStatus() {
    this.statusListeners.forEach(fn => fn(this.isConnected, this.currentUserId, this.isResuming));
  }
}

export const ddpPool = new DDPSubscriptionPool();