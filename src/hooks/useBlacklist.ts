import { useState, useEffect } from 'react';

const BLACKLIST_STORAGE_KEY = 'btsbots_wallet_account_blacklist';

export function useBlacklist() {
  const [blacklist, setBlacklist] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem(BLACKLIST_STORAGE_KEY);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(blacklist));
  }, [blacklist]);

  const addToBlacklist = (account: string) => {
    const clean = account.trim().toLowerCase();
    if (!clean) return;
    if (!blacklist.includes(clean)) {
      setBlacklist(prev => [...prev, clean]);
    }
  };

  const removeFromBlacklist = (account: string) => {
    const clean = account.trim().toLowerCase();
    setBlacklist(prev => prev.filter(a => a !== clean));
  };

  const isBlacklisted = (account: string): boolean => {
    return blacklist.includes(account.trim().toLowerCase());
  };

  return {
    blacklist,
    addToBlacklist,
    removeFromBlacklist,
    isBlacklisted
  };
}