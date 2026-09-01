import React, { useState } from 'react';
import { PinLockManager } from '../lib/crypto/pinLock';
import { useI18n } from '../lib/i18n';

interface LockOverlayProps {
  isOpen: boolean;
  onUnlocked: () => void;
}

export const LockOverlay: React.FC<LockOverlayProps> = ({ isOpen, onUnlocked }) => {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const isValid = await PinLockManager.verifyPin(pin);
    if (isValid) {
      PinLockManager.setLocked(false);
      setPin('');
      onUnlocked();
    } else {
      setError(t.pinError);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 max-w-xs w-full shadow-2xl text-center">
        <div className="h-14 w-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-black">
          🔒
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {t.unlockTitle}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-mono">
          BTSBots Secure Device Lock
        </p>

        {error && (
          <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-center tracking-widest text-2xl font-black text-gray-900 dark:text-white"
            autoFocus
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg text-sm cursor-pointer"
          >
            {t.unlockBtn}
          </button>
        </form>
      </div>
    </div>
  );
};