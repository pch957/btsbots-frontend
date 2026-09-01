import { useState, useEffect, useCallback } from 'react';
import { ddpPool } from '../lib/ddp/ddpSubPool';
import { DDP_CONFIG } from '../config/ddpConfig';
import { useAuth } from './useAuth';

const FAV_STORAGE_KEY = 'btsbots_user_favorites';

export interface FavoritesStore {
  markets: string[];
  assets: string[];
  users: string[];
}

export function useFavorites() {
  const { isLoggedIn } = useAuth();
  const [favs, setFavs] = useState<FavoritesStore>(() => {
    try {
      const val = localStorage.getItem(FAV_STORAGE_KEY);
      return val ? JSON.parse(val) : {
        markets: ['BTS_CNY', 'BTS_USD'],
        assets: ['BTS', 'CNY', 'USD'],
        users: []
      };
    } catch {
      return {
        markets: ['BTS_CNY', 'BTS_USD'],
        assets: ['BTS', 'CNY', 'USD'],
        users: []
      };
    }
  });

  // 1. 登录后从服务器拉取云端收藏并对齐
  const syncServerFavorites = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const serverFavs = await ddpPool.call<FavoritesStore>('getFavorites');
      if (serverFavs) {
        setFavs(prev => {
          const merged: FavoritesStore = {
            markets: Array.from(new Set([...(prev.markets || []), ...(serverFavs.markets || [])])),
            assets: Array.from(new Set([...(prev.assets || []), ...(serverFavs.assets || [])])),
            users: Array.from(new Set([...(prev.users || []), ...(serverFavs.users || [])]))
          };
          localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('[Favorites] 同步云端收藏失败:', err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    syncServerFavorites();
  }, [syncServerFavorites]);

  // 2. 本地持久化缓存
  useEffect(() => {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs));
  }, [favs]);

  // 3. 切换收藏状态（本地即时响应 + 云端 RPC 同步）
  const toggleFavorite = async (type: 'markets' | 'assets' | 'users', item: string) => {
    const cleanItem = type === 'markets' 
      ? item.toUpperCase().replace('/', '_') 
      : (type === 'assets' ? item.toUpperCase() : item.toLowerCase());

    const list = favs[type] || [];
    const exists = list.includes(cleanItem);
    const nextList = exists ? list.filter(i => i !== cleanItem) : [...list, cleanItem];

    setFavs(prev => ({ ...prev, [type]: nextList }));

    if (isLoggedIn) {
      const rpcMethod = exists ? DDP_CONFIG.METHODS.REMOVE_FAVORITE : DDP_CONFIG.METHODS.ADD_FAVORITE;
      try {
        await ddpPool.call(rpcMethod, type, cleanItem);
      } catch (err) {
        console.warn(`[Favorites] 远程同步 ${rpcMethod} 失败:`, err);
      }
    }
  };

  const isFavorite = (type: 'markets' | 'assets' | 'users', item: string): boolean => {
    const cleanItem = type === 'markets' 
      ? item.toUpperCase().replace('/', '_') 
      : (type === 'assets' ? item.toUpperCase() : item.toLowerCase());
    return (favs[type] || []).includes(cleanItem);
  };

  return {
    favs,
    toggleFavorite,
    isFavorite,
    reloadFavorites: syncServerFavorites
  };
}