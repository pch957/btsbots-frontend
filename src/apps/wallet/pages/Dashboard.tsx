import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../lib/i18n';
import { useAuth } from '../../../hooks/useAuth';
import { useDdpSubscription } from '../../../hooks/useDdpSubscription';
import { useCollection } from '../../../hooks/useCollection';
import { useBlacklist } from '../../../hooks/useBlacklist';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { parseMongoId, parseMongoTime, formatFullDateTime, type BalanceDoc, type TransferDoc, type WalletPaymentMetadataDoc } from '../../../types/models';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';

interface DashboardProps {
  onSelectCounterparty: (name: string) => void;
  onOpenReceive: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectCounterparty,
  onOpenReceive
}) => {
  const { t } = useI18n();
  const { currentAccount } = useAuth();
  const { isBlacklisted } = useBlacklist();

  // 挂载数据订阅
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.BALANCE, { u: currentAccount });
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.TRANSFER, { u: currentAccount });
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.MY_PAYMENT_METADATA);

  const rawBalances = useCollection<BalanceDoc>(DDP_CONFIG.COLLECTIONS.BALANCE, b => b.u === currentAccount);
  const metadataList = useCollection<WalletPaymentMetadataDoc>(DDP_CONFIG.COLLECTIONS.WALLET_PAYMENT_METADATA);
  const rawTransfers = useCollection<TransferDoc>(
    DDP_CONFIG.COLLECTIONS.TRANSFER,
    undefined,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );

  // 改用 RPC 拉取评级与用户资产设定
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({});
  const [allowedAssets, setAllowedAssets] = useState<string[]>([]);
  const [hiddenAssets, setHiddenAssets] = useState<string[]>([]);

  useEffect(() => {
    const fetchAssetData = async () => {
      try {
        const [trustList, settings] = await Promise.all([
          ddpPool.call<Array<{ asset: string; rating: number }>>(DDP_CONFIG.METHODS.GET_TRUST_ASSETS),
          ddpPool.call<{ allowedAssets?: string[]; hiddenAssets?: string[] }>(DDP_CONFIG.METHODS.GET_MY_ASSET_SETTINGS)
        ]);

        if (trustList) {
          const map: Record<string, number> = {};
          trustList.forEach(item => { map[item.asset.toUpperCase()] = Number(item.rating || 0); });
          setRatingMap(map);
        }

        if (settings) {
          setAllowedAssets(settings.allowedAssets || []);
          setHiddenAssets(settings.hiddenAssets || []);
        }
      } catch (e) {
        console.warn('[Dashboard] RPC 拉取资产设定失败:', e);
      }
    };
    fetchAssetData();
  }, []);

  const processedBalances = rawBalances
    .map(b => {
      const symbol = b.a.toUpperCase();
      return {
        ...b,
        rating: ratingMap[symbol] || 0,
        isForcedVisible: allowedAssets.includes(symbol),
        isManuallyHidden: hiddenAssets.includes(symbol)
      };
    })
    .filter(b => !b.isManuallyHidden && (b.rating > 0 || b.isForcedVisible))
    .sort((x, y) => y.rating - x.rating);

  const metadataMap: Record<string, { goods: string; memo: string }> = {};
  metadataList.forEach(m => {
    if (m.block) metadataMap[String(m.block)] = { goods: m.goods || '', memo: m.memo || '' };
  });

  const pairedTransfers = rawTransfers
    .map(tx => {
      if (!tx.u || !Array.isArray(tx.u) || tx.u.length < 2) return null;
      const [fromUser, toUser] = tx.u;
      const isOut = fromUser === currentAccount;
      const counterparty = isOut ? toUser : fromUser;

      if (isBlacklisted(counterparty)) {
        return null;
      }

      const matchKey = String(tx.B || '');
      const localMeta = metadataMap[matchKey] || null;

      return {
        ...tx,
        isOut,
        counterparty,
        plainGoods: localMeta?.goods || null,
        plainMemo: localMeta?.memo || null
      };
    })
    .filter(Boolean);

  const handleHideAsset = async (symbol: string) => {
    await ddpPool.call(DDP_CONFIG.METHODS.SET_ASSET_VISIBILITY, symbol, -1);
    setHiddenAssets(prev => [...prev, symbol.toUpperCase()]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in text-sm pb-16 md:pb-0">
      
      {/* 资产面板 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-blue-600 dark:text-blue-400">💰 {t.balance}</h3>
          <button
            onClick={onOpenReceive}
            className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20 cursor-pointer font-bold"
          >
            📥 {t.receive}
          </button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {processedBalances.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">{t.noAsset}</p>
          ) : processedBalances.map(b => (
            <div key={parseMongoId(b._id)} className="py-2.5 flex justify-between items-center">
              <span className="font-extrabold text-sm text-gray-900 dark:text-white font-mono">★ {b.a}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-gray-800 dark:text-gray-100">{b.f.toLocaleString()}</span>
                <button
                  onClick={() => handleHideAsset(b.a)}
                  className="text-[11px] text-red-500 bg-red-500/10 px-2 py-1 rounded cursor-pointer font-bold"
                >
                  {t.hide}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 历史流水面板 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-base font-bold mb-3 text-gray-800 dark:text-gray-200">📜 {t.history}</h3>
        
        {pairedTransfers.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">{t.noHistory}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-gray-700 dark:text-gray-300">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 font-bold">
                  <th className="py-2.5">Type</th>
                  <th className="py-2.5">Counterparty</th>
                  <th className="py-2.5">Amount</th>
                  <th className="py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {pairedTransfers.map(tx => (
                  <tr key={parseMongoId(tx!._id)} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                    <td className={`py-2.5 font-extrabold ${tx!.isOut ? 'text-red-500' : 'text-emerald-500'}`}>
                      {tx!.isOut ? 'OUT ➔' : 'IN 🠔'}
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectCounterparty(tx!.counterparty)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-left cursor-pointer"
                      >
                        {tx!.counterparty}
                      </button>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {tx!.plainMemo && (
                          <span className="text-[10px] font-sans bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                            🗒️ {tx!.plainMemo}
                          </span>
                        )}
                        {tx!.plainGoods && (
                          <span className="text-[10px] font-sans bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20">
                            🛒 {tx!.plainGoods}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 font-bold">{tx!.b} {tx!.a}</td>
                    <td className="py-2.5 text-right text-gray-400 text-[11px]" title={formatFullDateTime(tx!.T)}>
                      {new Date(parseMongoTime(tx!.T)).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};