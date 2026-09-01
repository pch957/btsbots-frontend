import React from 'react';
import { useI18n } from '../lib/i18n';
import type { OAuthChallengeData } from '../types/wallet';

interface OAuthModalProps {
  isOpen: boolean;
  data: OAuthChallengeData | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OAuthModal: React.FC<OAuthModalProps> = ({
  isOpen,
  data,
  onConfirm,
  onCancel
}) => {
  const { t } = useI18n();

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
        <div className="h-12 w-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3 font-bold">
          🔐
        </div>
        <h3 className="text-md font-extrabold text-gray-900 dark:text-white mb-2">
          {t.oauthTitle}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          {t.oauthSiteDesc}: <b className="text-blue-500 font-mono break-all">{data.site}</b><br />
          {t.oauthClientIp}: <b className="text-blue-500 font-mono">{data.ip}</b>
        </p>

        <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 mb-5 text-[11px] font-mono text-left text-gray-400 break-all select-all">
          Token: {data.token}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl text-xs flex-1 transition cursor-pointer"
          >
            {t.oauthReject}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs flex-1 transition shadow-md cursor-pointer"
          >
            {t.oauthAgree}
          </button>
        </div>
      </div>
    </div>
  );
};