import React from 'react';
import { useI18n } from '../../../lib/i18n';

export const DividendView: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16 md:pb-0">
      
      {/* 分红总览卡片 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-md font-bold text-blue-600 dark:text-blue-400 mb-2">🎁 {t.dividendTitle}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          持有特定生态资产可定期按链上快照领取 BTS / CNY 交易手续费分红收益。
        </p>

        {/* 待领积分看板 */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <span className="text-xs text-gray-400 block font-medium mb-1">{t.claimableDividend}</span>
            <span className="text-2xl font-black text-emerald-500 font-mono">0.00 <span className="text-xs text-gray-400">BTS</span></span>
          </div>
          <button
            disabled
            className="bg-gray-300 dark:bg-gray-700 text-gray-500 font-bold px-6 py-3 rounded-2xl text-xs transition cursor-not-allowed"
          >
            {t.claimBtn}
          </button>
        </div>

        {/* 提示条 */}
        <div className="text-xs text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
          ℹ️ {t.noDividend}
        </div>
      </div>

      {/* 历史领取记录 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4">📜 {t.dividendHistory}</h3>
        <p className="text-xs text-gray-400 text-center py-8">{t.noDividendHistory}</p>
      </div>

    </div>
  );
};