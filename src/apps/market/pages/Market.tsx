import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n';
import { useAuth } from '../../../hooks/useAuth';
import { useFavorites } from '../../../hooks/useFavorites';
import { useDdpSubscription } from '../../../hooks/useDdpSubscription';
import { useCollection } from '../../../hooks/useCollection';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { 
  parseMongoId, 
  parseMongoTime, 
  formatFullDateTime, 
  extractBitsharesOrderId,
  type OrderDoc, 
  type FillOrderDoc, 
  type BalanceDoc, 
  type MarketSummaryData 
} from '../../../types/models';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';
import { signerInstance } from '../../../lib/crypto/signer';

export const Market: React.FC = () => {
  const { t } = useI18n();
  const { currentAccount, isLoggedIn } = useAuth();
  const { favs, toggleFavorite, isFavorite } = useFavorites();
  const location = useLocation();

  const [currentPair, setCurrentPair] = useState<string>('BTS_CNY');
  const [searchInput, setSearchInput] = useState<string>('');
  const [baseAsset, quoteAsset] = currentPair.split('_');
  const databasePair = [baseAsset, quoteAsset].sort().join('_');

  const [buyPrice, setBuyPrice] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [summary, setSummary] = useState<MarketSummaryData>({
    price: 0, change: 0, high: 0, low: 0, volume: 0
  });

  useEffect(() => {
    if (location.state?.jumpPair) {
      setCurrentPair(location.state.jumpPair.replace('/', '_').toUpperCase());
    }
  }, [location.state]);

  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.ORDER_BOOK, baseAsset, quoteAsset);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.ORDER_BOOK, quoteAsset, baseAsset);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.FILL_ORDER, { m: databasePair });
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.LOGIN_BALANCE);

  // 1. 买卖盘口深度数据
  const rawAsks = useCollection<OrderDoc>(
    DDP_CONFIG.COLLECTIONS.ORDER,
    o => o.a?.s === baseAsset && o.a?.b === quoteAsset,
    (a, b) => (a.p || 0) - (b.p || 0)
  );

  const rawBids = useCollection<OrderDoc>(
    DDP_CONFIG.COLLECTIONS.ORDER,
    o => o.a?.s === quoteAsset && o.a?.b === baseAsset,
    (a, b) => (1 / (b.p || 1)) - (1 / (a.p || 1))
  );

  // 2. 撮合成交历史 (根据 Taker 属性与买卖方向区分红绿颜色)
  const rawTrades = useCollection<FillOrderDoc>(
    DDP_CONFIG.COLLECTIONS.FILL_ORDER,
    tr => tr.m === databasePair,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );

  const processedTrades = rawTrades.map(tr => {
    const isInverse = tr.a && tr.a[0] !== baseAsset;
    const unifiedPrice = (isInverse && tr.p > 0) ? (1 / tr.p) : (tr.p || 0);
    const amount = tr.a && tr.a[0] === baseAsset ? (tr.b?.[0] || 0) : (tr.b?.[1] || tr.b?.[0] || 0);

    // 📐 染色规则：如果 Taker 付出 Quote 买进 Base，则是主动买单(绿)；若付出 Base 则为主动卖单(红)
    const isBuyerTaker = tr.t_side === 'buy' || (tr.a && tr.a[0] === quoteAsset);

    return {
      ...tr,
      displayPrice: unifiedPrice,
      displayAmount: amount,
      isBuyerTaker
    };
  });

  const balances = useCollection<BalanceDoc>(DDP_CONFIG.COLLECTIONS.BALANCE, b => b.u === currentAccount);
  const baseBal = balances.find(b => b.a === baseAsset)?.f || 0;
  const quoteBal = balances.find(b => b.a === quoteAsset)?.f || 0;

  // 自动填充初始下单价
  useEffect(() => {
    if (rawAsks.length > 0 && !buyPrice) {
      const bestAsk = rawAsks[0].p;
      if (bestAsk) setBuyPrice(bestAsk.toFixed(4));
    }
    if (rawBids.length > 0 && !sellPrice) {
      const bestBid = rawBids[0].p ? (1 / rawBids[0].p) : 0;
      if (bestBid) setSellPrice(bestBid.toFixed(4));
    }
  }, [rawAsks, rawBids]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await ddpPool.call(DDP_CONFIG.METHODS.GET_MARKET_SUMMARY, databasePair);
        if (res) {
          if (databasePair !== currentPair && res.price) {
            setSummary({
              price: 1 / res.price,
              change: -res.change,
              high: res.low ? (1 / res.low) : 0,
              low: res.high ? (1 / res.high) : 0,
              volume: res.volume
            });
          } else {
            setSummary(res);
          }
        }
      } catch {}
    };
    fetchSummary();
  }, [databasePair, currentPair]);

  const handleSearchMarket = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase().replace('/', '_');
    if (clean.includes('_')) {
      setCurrentPair(clean);
      setSearchInput('');
    }
  };

  const handlePlaceOrder = async (action: 'buy' | 'sell') => {
    if (!isLoggedIn) {
      alert('请先登录交易账号');
      return;
    }
    const p = action === 'buy' ? Number(buyPrice) : Number(sellPrice);
    const b = action === 'buy' ? Number(buyAmount) : Number(sellAmount);

    if (isNaN(p) || p <= 0 || isNaN(b) || b <= 0) {
      alert('请输入有效的价格和数量');
      return;
    }

    setIsSubmitting(true);
    try {
      const envelope = await signerInstance.signTransactionIntent('limit_order_create', {
        sell_asset: action === 'buy' ? quoteAsset : baseAsset,
        amount: action === 'buy' ? b * p : b,
        receive_asset: action === 'buy' ? baseAsset : quoteAsset,
        price: action === 'buy' ? 1 / p : p,
        fill_or_kill: false
      });

      await ddpPool.call(DDP_CONFIG.METHODS.REQUEST_PROXY_SIGN, envelope);
      alert('🚀 限价委托已发送至代理');
      if (action === 'buy') setBuyAmount('');
      else setSellAmount('');
    } catch (err: any) {
      alert(`下单失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 彻底修复撤单 ID 解析
  const handleCancelOrder = async (orderDoc: any) => {
    const formattedOrderId = extractBitsharesOrderId(orderDoc);
    if (!formattedOrderId || !formattedOrderId.startsWith('1.7.')) {
      alert('无法解析该订单的有效 BitShares 链上 ID (1.7.X)');
      return;
    }

    if (!confirm(`确定撤销限价委托 ${formattedOrderId} 吗？`)) return;

    try {
      const envelope = await signerInstance.signTransactionIntent('limit_order_cancel', {
        order_id: formattedOrderId
      });
      await ddpPool.call(DDP_CONFIG.METHODS.REQUEST_PROXY_SIGN, envelope);
      alert(`撤单请求已发送: ${formattedOrderId}`);
    } catch (err: any) {
      alert(`撤单失败: ${err.message}`);
    }
  };

  const isCurrentFav = isFavorite('markets', currentPair);

  return (
    <div className="space-y-6 animate-fade-in pb-16 md:pb-0">
      
      {/* 市场概览 Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black flex items-center gap-2">
            <span>📊 {baseAsset} / {quoteAsset}</span>
            <button
              onClick={() => toggleFavorite('markets', currentPair)}
              className={`text-xl cursor-pointer transition ${isCurrentFav ? 'text-amber-500' : 'text-gray-400'}`}
              title="收藏该交易对"
            >
              {isCurrentFav ? '★' : '☆'}
            </button>
          </h2>

          <select
            value={currentPair}
            onChange={(e) => setCurrentPair(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-bold font-mono outline-none"
          >
            {Array.from(new Set(['BTS_CNY', 'BTS_USD', ...favs.markets])).map(pair => (
              <option key={pair} value={pair}>
                {isFavorite('markets', pair) ? '★' : '•'} {pair.replace('_', ' / ')}
              </option>
            ))}
          </select>

          <form onSubmit={handleSearchMarket} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder={t.searchMarketPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer">
              Go
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-4 md:gap-6 text-xs font-mono">
          <div><span className="text-gray-400 block">{t.lastPrice}</span><b className="text-blue-500 text-sm">{summary.price?.toFixed(4)}</b></div>
          <div><span className="text-gray-400 block">{t.change24h}</span><b className={summary.change >= 0 ? 'text-emerald-500' : 'text-red-500'}>{summary.change >= 0 ? '+' : ''}{summary.change?.toFixed(2)}%</b></div>
          <div><span className="text-gray-400 block">{t.high24h}</span><b>{summary.high?.toFixed(4)}</b></div>
          <div><span className="text-gray-400 block">{t.low24h}</span><b>{summary.low?.toFixed(4)}</b></div>
        </div>
      </div>

      {/* 下单面板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 买单 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-md font-bold text-emerald-500">🟢 {t.buyAsset} {baseAsset}</h4>
            <span className="text-xs text-gray-400">{t.balanceAvailable}: <b className="font-mono">{quoteBal.toFixed(2)}</b> {quoteAsset}</span>
          </div>
          <input
            type="number"
            placeholder={`${t.price} (${quoteAsset})`}
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            placeholder={`${t.quantity} (${baseAsset})`}
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => handlePlaceOrder('buy')}
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white font-bold py-3 rounded-2xl text-xs transition cursor-pointer"
          >
            {t.priceLimit} {t.buyAsset} {baseAsset}
          </button>
        </div>

        {/* 卖单 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-md font-bold text-red-500">🔴 {t.sellAsset} {baseAsset}</h4>
            <span className="text-xs text-gray-400">{t.balanceAvailable}: <b className="font-mono">{baseBal.toFixed(2)}</b> {baseAsset}</span>
          </div>
          <input
            type="number"
            placeholder={`${t.price} (${quoteAsset})`}
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            placeholder={`${t.quantity} (${baseAsset})`}
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => handlePlaceOrder('sell')}
            disabled={isSubmitting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold py-3 rounded-2xl text-xs transition cursor-pointer"
          >
            {t.priceLimit} {t.sellAsset} {baseAsset}
          </button>
        </div>

      </div>

      {/* 🌟 核心对齐重构：价格 40%、数量 35%、交易员 25% 黄金比例分布 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        
        {/* 买盘 (Bids) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase tracking-wider">{t.bidsBook} ({rawBids.length})</h4>
          
          <div className="flex justify-between text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="w-[40%]">{t.price} ({quoteAsset})</span>
            <span className="w-[35%] text-right">{t.quantity}</span>
            <span className="w-[25%] text-right">{t.trader}</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 flex-1">
            {rawBids.map(o => {
              const isMine = currentAccount && o.u === currentAccount;
              const priceVal = o.p ? (1 / o.p) : 0;
              const amountVal = o.p ? (o.b * o.p) : 0;
              return (
                <div key={parseMongoId(o.id || o._id)} className="flex items-center justify-between text-xs py-1 font-mono hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-1">
                  <div className="w-[40%] flex items-center gap-1.5 overflow-hidden">
                    <span className="text-emerald-500 font-bold">{priceVal.toFixed(4)}</span>
                    {isMine && (
                      <button
                        onClick={() => handleCancelOrder(o)}
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition shrink-0"
                        title="撤单"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="w-[35%] text-right text-gray-800 dark:text-gray-200">{amountVal.toFixed(2)}</span>
                  <span className="w-[25%] text-right text-gray-400 truncate text-[11px]" title={o.u}>{o.u}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 卖盘 (Asks) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <h4 className="text-xs font-bold text-red-500 mb-3 uppercase tracking-wider">{t.asksBook} ({rawAsks.length})</h4>
          
          <div className="flex justify-between text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="w-[40%]">{t.price} ({quoteAsset})</span>
            <span className="w-[35%] text-right">{t.quantity}</span>
            <span className="w-[25%] text-right">{t.trader}</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 flex-1">
            {rawAsks.map(o => {
              const isMine = currentAccount && o.u === currentAccount;
              return (
                <div key={parseMongoId(o.id || o._id)} className="flex items-center justify-between text-xs py-1 font-mono hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-1">
                  <div className="w-[40%] flex items-center gap-1.5 overflow-hidden">
                    <span className="text-red-500 font-bold">{o.p?.toFixed(4)}</span>
                    {isMine && (
                      <button
                        onClick={() => handleCancelOrder(o)}
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition shrink-0"
                        title="撤单"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="w-[35%] text-right text-gray-800 dark:text-gray-200">{o.b?.toFixed(2)}</span>
                  <span className="w-[25%] text-right text-gray-400 truncate text-[11px]" title={o.u}>{o.u}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 成交历史 (按买卖方向严格红绿染色) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <h4 className="text-xs font-bold text-blue-500 mb-3 uppercase tracking-wider">{t.tradeHistory} ({processedTrades.length})</h4>
          
          <div className="flex justify-between text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="w-[35%]">{t.time}</span>
            <span className="w-[35%] text-right">{t.price}</span>
            <span className="w-[30%] text-right">{t.amount}</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 flex-1 font-mono">
            {processedTrades.map(tr => (
              <div key={parseMongoId(tr.id || tr._id)} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 dark:border-gray-800/40">
                <span className="w-[35%] text-gray-400 cursor-help text-[11px]" title={formatFullDateTime(tr.T)}>
                  {new Date(parseMongoTime(tr.T)).toLocaleTimeString()}
                </span>
                <span className={`w-[35%] text-right font-bold ${tr.isBuyerTaker ? 'text-emerald-500' : 'text-red-500'}`}>
                  {tr.displayPrice?.toFixed(4)}
                </span>
                <span className="w-[30%] text-right text-gray-800 dark:text-gray-300">
                  {tr.displayAmount?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};