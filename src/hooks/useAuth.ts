import { useState, useEffect } from 'react';
import { ddpPool } from '../lib/ddp/ddpSubPool';
import { signerInstance } from '../lib/crypto/signer';

export function useAuth() {
  const [status, setStatus] = useState(ddpPool.getStatus());

  useEffect(() => {
    const unsub = ddpPool.onStatusChange(() => {
      setStatus(ddpPool.getStatus());
    });
    return unsub;
  }, []);

  const loginWithOtp = async (account: string, token: string) => {
    const cleanUser = account.trim().toLowerCase();
    const res = await ddpPool.loginWithOtp(cleanUser, token.trim());
    await signerInstance.initializeOrLoadKey();
    return res;
  };

  const logout = async () => {
    await ddpPool.logout();
  };

  return {
    isConnected: status.connected,
    isLoggedIn: !!status.userId,
    isResuming: status.isResuming,
    userId: status.userId,
    currentAccount: status.username || '',
    loginWithOtp,
    logout
  };
}