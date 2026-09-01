import { useEffect, useRef } from 'react';
import { PinLockManager, AUTO_LOCK_TIMEOUT_MS } from '../lib/crypto/pinLock';

interface AutoLockProviderProps {
  onLock: () => void;
}

export function AutoLockProvider({ onLock }: AutoLockProviderProps) {
  const timerRef = useRef<any>(null);

  useEffect(() => {
    // 1. 检查是否已经超时 (解决手机息屏、锁屏切回、切到后台的问题)
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

    // 2. 重置前台倒计时与活跃时间戳
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

    const handleVisibilityOrFocus = () => {
      if (!checkTimeout()) {
        resetTimer();
      }
    };

    // 绑定前台用户操作事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    
    // 绑定唤醒/切换到前台事件
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 初始化运行检查
    if (!checkTimeout()) {
      resetTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [onLock]);

  return null;
}