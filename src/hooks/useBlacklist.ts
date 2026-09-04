import { useState, useEffect, useCallback } from 'react';
import { ddpPool } from '../lib/ddp/ddpSubPool';
import { DDP_CONFIG } from '../config/ddpConfig';
import { useAuth } from './useAuth';

export function useBlacklist() {
  const { isLoggedIn } = useAuth();
  const [blacklist, setBlacklist] = useState<string[]>([]);

  const fetchCloudBlacklist = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await ddpPool.call<{ blockedUsers?: string[] }>(DDP_CONFIG.METHODS.GET_MY_ASSET_SETTINGS);
      if (res && Array.isArray(res.blockedUsers)) {
        setBlacklist(res.blockedUsers);
      }
    } catch (err) {
      console.warn('[Blacklist] 获取云端黑名单失败:', err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchCloudBlacklist();
  }, [fetchCloudBlacklist]);

  const addToBlacklist = async (account: string) => {
    const clean = account.trim().toLowerCase();
    if (!clean || blacklist.includes(clean)) return;

    setBlacklist(prev => [...prev, clean]);
    if (isLoggedIn) {
      try {
        await ddpPool.call(DDP_CONFIG.METHODS.TOGGLE_ACCOUNT_BLACKLIST, clean, true);
      } catch (err) {
        console.error('[Blacklist] 添加黑名单失败:', err);
      }
    }
  };

  const removeFromBlacklist = async (account: string) => {
    const clean = account.trim().toLowerCase();
    setBlacklist(prev => prev.filter(a => a !== clean));
    if (isLoggedIn) {
      try {
        await ddpPool.call(DDP_CONFIG.METHODS.TOGGLE_ACCOUNT_BLACKLIST, clean, false);
      } catch (err) {
        console.error('[Blacklist] 移除黑名单失败:', err);
      }
    }
  };

  const isBlacklisted = (account: string): boolean => {
    return blacklist.includes(account.trim().toLowerCase());
  };

  return {
    blacklist,
    addToBlacklist,
    removeFromBlacklist,
    isBlacklisted,
    reloadBlacklist: fetchCloudBlacklist
  };
}