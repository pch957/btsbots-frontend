import { useEffect, useRef } from 'react';
import { PinLockManager, AUTO_LOCK_TIMEOUT_MS } from '../lib/crypto/pinLock';

interface AutoLockProviderProps {
  onLock: () => void;
}

export function AutoLockProvider({ onLock }: AutoLockProviderProps) {
  const timerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const checkTimeout = () => {
      if (!PinLockManager.hasPinSet()) return false;
      const elapsed = Date.now() - PinLockManager.getLastActivity();
      if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
        PinLockManager.setLocked(true);
        onLock();
        return true;
      }
      return false;
    };

    const resetTimer = () => {
      if (!PinLockManager.hasPinSet()) return;
      PinLockManager.updateActivity();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (PinLockManager.hasPinSet()) {
          PinLockManager.setLocked(true);
          onLock();
        }
      }, AUTO_LOCK_TIMEOUT_MS);
    };

    const handleWakeup = () => {
      if (!checkTimeout()) {
        resetTimer();
      }
    };

    // 1. 用户活动事件监听
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    
    // 2. 页面可见性与聚焦
    window.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);

    // 3. 增加定期心跳检查（每 5 秒轮询，确保挂起唤醒后及时触发锁定）
    intervalRef.current = setInterval(checkTimeout, 5000);

    // 初始化检查
    if (!checkTimeout()) {
      resetTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
      window.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
    };
  }, [onLock]);

  return null;
}