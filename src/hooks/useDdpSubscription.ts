import { useEffect } from 'react';
import { ddpPool } from '../lib/ddp/ddpSubPool';

export function useDdpSubscription(pubName: string | null | undefined, ...params: any[]) {
  useEffect(() => {
    if (!pubName) return;
    ddpPool.subscribe(pubName, ...params);
  }, [pubName, JSON.stringify(params)]);
}