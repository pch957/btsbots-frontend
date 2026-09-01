import { useState, useEffect } from 'react';
import { ddpPool } from '../lib/ddp/ddpSubPool';

/**
 * 响应式监听 Minimongo 集合数据并支持灵活过滤与排序
 */
export function useCollection<T = any>(
  collectionName: string,
  filterFn?: (item: T) => boolean,
  sortFn?: (a: T, b: T) => number
): T[] {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const unsub = ddpPool.onCollectionChange((changedColl) => {
      if (changedColl === collectionName) {
        setVersion(v => v + 1);
      }
    });
    return unsub;
  }, [collectionName]);

  const coll = ddpPool.getCollection(collectionName);
  let list: T[] = coll ? (coll.fetch() || []) : [];

  if (filterFn) {
    list = list.filter(filterFn);
  }
  if (sortFn) {
    list = [...list].sort(sortFn);
  }

  return list;
}