import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n';
import { useDdpSubscription } from '../../../hooks/useDdpSubscription';
import { useCollection } from '../../../hooks/useCollection';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { parseMongoId, parseMongoTime, type GlobalPropertyDoc, type TransferDoc, type FillOrderDoc, type OrderHistoryDoc, type TopRankingsData } from '../../../types/models';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';

export const Home: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  // 1. 订阅全局出块心跳、首页聚合数据与核心流水
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.CHAIN_BLOCK_HEAD_STREAM);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.HOME_PAGE);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.TRANSFER);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.FILL_ORDER);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.ORDER_HISTORY);

  const blockHeadList = useCollection<GlobalPropertyDoc>(
    DDP_CONFIG.COLLECTIONS.GLOBAL_PROPERTIES,
    undefined,
    (a, b) => (b.B || 0) - (a.B || 0)
  );

  const transfers = useCollection<TransferDoc>(
    DDP_CONFIG.COLLECTIONS.TRANSFER,
    undefined,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  ).slice(0, 40);

  const trades = useCollection<FillOrderDoc>(
    DDP_CONFIG.COLLECTIONS.FILL_ORDER,
    undefined,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  ).slice(0, 40);

  const orderHistory = useCollection<OrderHistoryDoc>(
    DDP_CONFIG.COLLECTIONS.ORDER_HISTORY,
    undefined,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  ).slice(0, 40);

  // 定时拉取服务端 RPC 排行榜
  const [rankings, setRankings] = useState<TopRankingsData>({
    topAssets: [],
    topMarkets: [],
    topTraders: []
  });

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const res = await ddpPool.call(DDP_CONFIG.METHODS.GET_RANKINGS);
        if (res) setRankings(res);
      } catch {}
    };
    fetchRankings();
    const interval = setInterval(fetchRankings, 30000);
    return () => clearInterval(interval);
  }, []);

  // 🌟 心跳响应式计时器：每秒更新当前时间戳
  const [nowTime, setNowTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🌟 核心提炼最新高度与时间：优先 global_properties，若为空则自动从最新成交/转账中实时提取
  const latestBlockDoc = blockHeadList[0];
  const latestTradeDoc = trades[0];
  const latestTxDoc = transfers[0];

  const latestBlockNum = latestBlockDoc?.B || latestTradeDoc?.B || latestTxDoc?.B || '-------';
  
  const blockTimeMs = latestBlockDoc?.T 
    ? parseMongoTime(latestBlockDoc.T) 
    : (latestTradeDoc?.T ? parseMongoTime(latestTradeDoc.T) : (latestTxDoc?.T ? parseMongoTime(latestTxDoc.T) : 0));

  const timeDiffSec = blockTimeMs > 0 ? Math.floor((nowTime - blockTimeMs) / 1000) : 999;
  const isHealthy = blockTimeMs > 0 && timeDiffSec <= 30;

  return (
    <div className="space-y-6 animate-fade-in pb-16 md:pb-0">
      
      {/* 顶部出块心跳诊断状态条 (秒级实时联动) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}
            />
            <span className={`font-bold ${isHealthy ? 'text-emerald-500' : 'text-red-500'}`}>
              {isHealthy ? t.liveSync : t.delayed} {timeDiffSec >= 0 && timeDiffSec < 3600 && `(${timeDiffSec}s)`}
            </span>
          </span>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span>{t.blockNumber}: <strong className="font-mono text-blue-500">#{latestBlockNum}</strong></span>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span className="text-gray-400 font-mono">
            ⏱️ {blockTimeMs ? new Date(blockTimeMs).toLocaleTimeString() : '--:--:--'}
          </span>
        </div>
      </div>

      {/* 排行榜网格 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Top Assets */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-emerald-500 mb-3 uppercase tracking-wider">🏆 {t.topAssets}</h3>
          <div className="space-y-2">
            {rankings.topAssets.map((asset, i) => (
              <div key={parseMongoId(asset._id) || i} className="flex justify-between items-center text-xs py-1">
                <Link to={`/asset/${asset.a}`} className="font-bold text-blue-500 hover:underline">🪙 {asset.a}</Link>
                <span className="font-mono font-bold text-emerald-500">¥ {asset.v?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Markets */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-red-500 mb-3 uppercase tracking-wider">🔥 {t.topMarkets}</h3>
          <div className="space-y-2">
            {rankings.topMarkets.map((mkt, i) => (
              <div key={parseMongoId(mkt._id) || i} className="flex justify-between items-center text-xs py-1">
                <Link to="/market" state={{ jumpPair: `${mkt.a?.[0]}_${mkt.a?.[1]}` }} className="font-bold text-blue-500 hover:underline">
                  ⚡ {mkt.a?.[0]}/{mkt.a?.[1]}
                </Link>
                <span className="font-mono font-bold text-red-500">¥ {mkt.v?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Traders */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">📈 {t.topTraders}</h3>
          <div className="space-y-2">
            {rankings.topTraders.map((trader, i) => (
              <div key={parseMongoId(trader._id) || i} className="flex justify-between items-center text-xs py-1">
                <Link to={`/user/${trader.u}`} className="font-bold text-blue-500 hover:underline">👤 {trader.u}</Link>
                <span className="font-mono font-bold text-amber-500">¥ {trader.v?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 实时交易流网格 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 全网转账 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-emerald-500 mb-3 uppercase tracking-wider">💸 {t.transfers}</h3>
          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-4">{t.sender}</span>
            <span className="col-span-4">{t.receiver}</span>
            <span className="col-span-4 text-right">{t.amount}</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {transfers.map(tx => (
              <div key={parseMongoId(tx._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                <Link to={`/user/${tx.u?.[0]}`} className="col-span-4 truncate text-blue-500 hover:underline">{tx.u?.[0]}</Link>
                <Link to={`/user/${tx.u?.[1]}`} className="col-span-4 truncate text-gray-400 hover:underline">➔ {tx.u?.[1]}</Link>
                <span className="col-span-4 text-right text-emerald-500 font-bold">{tx.b} <Link to={`/asset/${tx.a}`} className="hover:underline">{tx.a}</Link></span>
              </div>
            ))}
          </div>
        </div>

        {/* 最新撮合成交 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-blue-500 mb-3 uppercase tracking-wider">🛒 {t.recentMatches}</h3>
          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-5">{t.pair}</span>
            <span className="col-span-4 text-right">{t.price}</span>
            <span className="col-span-3 text-right">{t.amount}</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {trades.map(tr => {
              const pairName = tr.a?.join('/') || tr.m?.replace('_', '/') || '---';
              const routePair = tr.a ? `${tr.a[0]}_${tr.a[1]}` : (tr.m || '');
              return (
                <div key={parseMongoId(tr._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                  <button
                    onClick={() => navigate('/market', { state: { jumpPair: routePair } })}
                    className="col-span-5 text-left text-blue-500 hover:underline truncate cursor-pointer font-bold"
                  >
                    {pairName}
                  </button>
                  <span className="col-span-4 text-right font-bold text-red-500">{tr.p?.toFixed(4)}</span>
                  <span className="col-span-3 text-right text-gray-400">{tr.b?.[0]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 全网委托记录 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">📋 {t.orderIntents}</h3>
          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-4">{t.trader}</span>
            <span className="col-span-3 text-center">{t.action}</span>
            <span className="col-span-5 text-right">{t.pair}</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {orderHistory.map(oh => {
              const routePair = oh.m || (Array.isArray(oh.a) ? `${oh.a[0]}_${oh.a[1]}` : '');
              return (
                <div key={parseMongoId(oh._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                  <Link to={`/user/${oh.u}`} className="col-span-4 truncate text-blue-500 hover:underline">{oh.u}</Link>
                  <span className={`col-span-3 text-center font-bold ${oh.t === 1 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {oh.t === 1 ? t.placeOrder : t.cancelOrder}
                  </span>
                  <button
                    onClick={() => navigate('/market', { state: { jumpPair: routePair } })}
                    className="col-span-5 text-right text-gray-400 hover:text-blue-500 truncate cursor-pointer hover:underline"
                  >
                    {oh.m?.replace('_', '/')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};