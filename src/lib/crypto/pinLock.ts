/**
 * 本地 PIN 锁屏管理器
 */

const PIN_STORAGE_KEY = 'btsbots_local_pin_hash';
const LOCK_STATE_KEY = 'btsbots_is_wallet_locked';
const LAST_ACTIVE_KEY = 'btsbots_last_activity_time';
export const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5分钟超时

async function sha256Hash(plainText: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(plainText);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const PinLockManager = {
  hasPinSet(): boolean {
    return !!localStorage.getItem(PIN_STORAGE_KEY);
  },

  async setPin(newPin: string): Promise<boolean> {
    const cleanPin = newPin.trim().replace(/\D/g, '');
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      throw new Error('PIN 码必须为 4-6 位纯数字');
    }
    const hashed = await sha256Hash(cleanPin);
    localStorage.setItem(PIN_STORAGE_KEY, hashed);
    this.updateActivity();
    return true;
  },

  async removePin(): Promise<void> {
    localStorage.removeItem(PIN_STORAGE_KEY);
    localStorage.removeItem(LOCK_STATE_KEY);
  },

  async verifyPin(inputPin: string): Promise<boolean> {
    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (!savedHash) {
      // 未设置 PIN 码则无需校验
      return false;
    }
    const inputHash = await sha256Hash(inputPin.trim());
    return inputHash === savedHash;
  },

  isLocked(): boolean {
    if (!this.hasPinSet()) return false;
    
    // 显式标记锁定
    if (localStorage.getItem(LOCK_STATE_KEY) === 'true') {
      return true;
    }
    
    // 检查超时
    const elapsed = Date.now() - this.getLastActivity();
    if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
      this.setLocked(true);
      return true;
    }
    return false;
  },

  setLocked(locked: boolean): void {
    if (!this.hasPinSet()) return;
    localStorage.setItem(LOCK_STATE_KEY, locked ? 'true' : 'false');
    if (!locked) {
      this.updateActivity();
    }
  },

  updateActivity(): void {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  },

  getLastActivity(): number {
    const val = localStorage.getItem(LAST_ACTIVE_KEY);
    return val ? parseInt(val, 10) : Date.now();
  }
};