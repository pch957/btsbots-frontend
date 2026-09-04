import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n';
import { useFavorites } from '../../../hooks/useFavorites';
import { useDdpSubscription } from '../../../hooks/useDdpSubscription';
import { useCollection } from '../../../hooks/useCollection';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { parseMongoId, parseMongoTime, formatFullDateTime, type BalanceDoc, type TransferDoc, type FillOrderDoc, type AssetRankingsData } from '../../../types/models';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';

export const AssetDetail: React.FC = () => {
  const { assetName } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { favs, toggleFavorite, isFavorite } = useFavorites();

  const cleanedAsset = assetName ? assetName.trim().toUpperCase() : 'BTS';
  const [assetSearch, setAssetSearch] = useState('');

  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.BALANCE, {'a': cleanedAsset});
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.TRANSFER, {'a': cleanedAsset});
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.FILL_ORDER, {'a': cleanedAsset});

  const holders = useCollection<BalanceDoc>(
    DDP_CONFIG.COLLECTIONS.BALANCE,
    b => b.a === cleanedAsset,
    (a, b) => (b.b || 0) - (a.b || 0)
  );

  const transfers = useCollection<TransferDoc>(
    DDP_CONFIG.COLLECTIONS.TRANSFER,
    tx => tx.a === cleanedAsset,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );

  const trades = useCollection<FillOrderDoc>(
    DDP_CONFIG.COLLECTIONS.FILL_ORDER,
    tr => tr.a?.includes(cleanedAsset),
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );

  // 🌟 核心新增：调用 RPC 拉取该资产交易量最高的用户与关联资产对
  const [assetRankings, setAssetRankings] = useState<AssetRankingsData>({
    topTraders: [],
    topRelatedAssets: []
  });

  useEffect(() => {
    const fetchAssetRankings = async () => {
      try {
        const res = await ddpPool.call(DDP_CONFIG.METHODS.GET_ASSET_RANKINGS, cleanedAsset);
        if (res) setAssetRankings(res);
      } catch {}
    };
    fetchAssetRankings();
  }, [cleanedAsset]);

  const isFav = isFavorite('assets', cleanedAsset);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (assetSearch.trim()) {
      navigate(`/asset/${assetSearch.trim().toUpperCase()}`);
      setAssetSearch('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 md:pb-0">
      
      {/* 头部控制栏 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 md:p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-amber-500 flex items-center gap-2">
            <span>🪙 {cleanedAsset}</span>
            <button
              onClick={() => toggleFavorite('assets', cleanedAsset)}
              className={`text-xl cursor-pointer transition ${isFav ? 'text-amber-500' : 'text-gray-400'}`}
              title="收藏资产"
            >
              {isFav ? '★' : '☆'}
            </button>
          </h2>

          <select
            value={cleanedAsset}
            onChange={(e) => navigate(`/asset/${e.target.value}`)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-bold font-mono outline-none"
          >
            {Array.from(new Set(['BTS', 'CNY', 'USD', ...favs.assets])).map(symbol => (
              <option key={symbol} value={symbol}>
                {isFavorite('assets', symbol) ? '★' : '•'} {symbol}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder={t.searchAssetPlaceholder}
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 uppercase"
          />
          <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer">
            {t.searchBtn}
          </button>
        </form>
      </div>

      {/* 🌟 核心新增：本资产交易量最高用户 & 最高关联资产对 (RPC驱动) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 最高交易用户 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-blue-500 mb-3 uppercase tracking-wider">🏆 本资产交易量最高用户</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {assetRankings.topTraders.length === 0 ? <p className="text-xs text-gray-400 py-3">{t.noData}</p> : assetRankings.topTraders.map(item => (
              <div key={item.username} className="flex justify-between items-center text-xs py-1 font-mono border-b border-gray-100 dark:border-gray-800/40">
                <Link to={`/user/${item.username}`} className="text-blue-500 hover:underline">👤 {item.username}</Link>
                <b className="text-emerald-500">{item.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} {cleanedAsset}</b>
              </div>
            ))}
          </div>
        </div>

        {/* 最高关联资产对 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">🔥 与本资产关联最高交易资产</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {assetRankings.topRelatedAssets.length === 0 ? <p className="text-xs text-gray-400 py-3">{t.noData}</p> : assetRankings.topRelatedAssets.map(item => (
              <div key={item.asset} className="flex justify-between items-center text-xs py-1 font-mono border-b border-gray-100 dark:border-gray-800/40">
                <Link to="/market" state={{ jumpPair: `${cleanedAsset}_${item.asset}` }} className="text-amber-500 hover:underline">⚡ {cleanedAsset}/{item.asset}</Link>
                <b className="text-blue-500">{item.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} {cleanedAsset}</b>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 大户持仓、转账、撮合成交 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 大户持仓 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-blue-500 mb-3 uppercase tracking-wider">📊 {t.richList}</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {holders.map(h => (
              <div key={parseMongoId(h._id)} className="flex justify-between items-center text-xs py-1 font-mono">
                <Link to={`/user/${h.u}`} className="text-blue-500 hover:underline">{h.u}</Link>
                <b>{h.b?.toLocaleString()}</b>
              </div>
            ))}
          </div>
        </div>

        {/* 转账流水 (完整时间 hover 提示) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-emerald-500 mb-3 uppercase tracking-wider">💸 {t.transfers}</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {transfers.map(tx => (
              <div key={parseMongoId(tx._id)} className="flex justify-between items-center text-xs py-1 font-mono" title={formatFullDateTime(tx.T)}>
                <span className="truncate max-w-[120px]">{tx.u?.[0]} ➔ {tx.u?.[1]}</span>
                <b className="text-emerald-500">{tx.b}</b>
              </div>
            ))}
          </div>
        </div>

        {/* 撮合成交 (完整时间 hover 提示) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-red-500 mb-3 uppercase tracking-wider">🛒 {t.recentMatches} ({trades.length})</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {trades.map(tr => (
              <div key={parseMongoId(tr._id)} className="flex justify-between items-center text-xs py-1 font-mono" title={formatFullDateTime(tr.T)}>
                <Link to="/market" state={{ jumpPair: tr.m }} className="text-gray-400 hover:underline hover:text-blue-500">{tr.a?.join('/')}</Link>
                <b className="text-red-500">{tr.p?.toFixed(4)}</b>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
