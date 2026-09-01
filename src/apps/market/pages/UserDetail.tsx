import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n';
import { useAuth } from '../../../hooks/useAuth';
import { useFavorites } from '../../../hooks/useFavorites';
import { useDdpSubscription } from '../../../hooks/useDdpSubscription';
import { useCollection } from '../../../hooks/useCollection';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { parseMongoId, parseMongoTime, formatFullDateTime, type BalanceDoc, type TransferDoc, type FillOrderDoc, type OrderDoc, type OrderHistoryDoc, type PriceDoc, type UserAssetSettingsDoc, type TrustAssetDoc } from '../../../types/models';
import { signerInstance } from '../../../lib/crypto/signer';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';

export const UserDetail: React.FC = () => {
  const { username } = useParams();
  const { t } = useI18n();
  const { currentAccount } = useAuth();
  const navigate = useNavigate();
  const { favs, toggleFavorite, isFavorite } = useFavorites();

  const cleanedUser = username ? username.trim().toLowerCase() : (currentAccount || 'btsbots');
  const [userSearch, setUserSearch] = useState('');

  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.USER_PAGE, cleanedUser);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.TRUST_ASSETS);
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.MY_ASSET_SETTINGS);

  const rawBalances = useCollection<BalanceDoc>(DDP_CONFIG.COLLECTIONS.BALANCE, b => b.u === cleanedUser);
  const openOrders = useCollection<OrderDoc>(DDP_CONFIG.COLLECTIONS.ORDER, o => o.u === cleanedUser);
  const transfers = useCollection<TransferDoc>(
    DDP_CONFIG.COLLECTIONS.TRANSFER,
    tx => tx.u?.includes(cleanedUser),
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );
  const trades = useCollection<FillOrderDoc>(
    DDP_CONFIG.COLLECTIONS.FILL_ORDER,
    tr => tr.u?.includes(cleanedUser),
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );
  const orderHistory = useCollection<OrderHistoryDoc>(
    DDP_CONFIG.COLLECTIONS.ORDER_HISTORY,
    oh => oh.u === cleanedUser,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );
  const prices = useCollection<PriceDoc>(DDP_CONFIG.COLLECTIONS.PRICE);
  const trustAssets = useCollection<TrustAssetDoc>(DDP_CONFIG.COLLECTIONS.TRUST_ASSET);
  const settingsList = useCollection<UserAssetSettingsDoc>(DDP_CONFIG.COLLECTIONS.USER_ASSET_SETTINGS);

  const settings = settingsList[0];
  const hiddenAssets = settings?.hiddenAssets || [];
  const allowedAssets = settings?.allowedAssets || [];

  const ratingMap: Record<string, number> = {};
  trustAssets.forEach(item => { ratingMap[item.asset.toUpperCase()] = Number(item.rating || 0); });

  const priceMap: Record<string, number> = {};
  prices.forEach(p => { priceMap[p.a] = p.p || 0; });

  // 按照钱包逻辑过滤与排序余额
  const processedBalances = rawBalances
    .map(b => {
      const symbol = b.a.toUpperCase();
      const unitPrice = priceMap[symbol] || 0;
      const calculatedWorth = (b.b || 0) * unitPrice;
      return {
        ...b,
        rating: ratingMap[symbol] || 0,
        isForcedVisible: allowedAssets.includes(symbol),
        isManuallyHidden: hiddenAssets.includes(symbol),
        worthCNY: calculatedWorth
      };
    })
    .filter(b => !b.isManuallyHidden && (b.rating > 0 || b.isForcedVisible || (b.worthCNY && b.worthCNY > 0.1)))
    .sort((a, b) => (b.worthCNY || 0) - (a.worthCNY || 0));

  const totalWorth = processedBalances.reduce((sum, b) => sum + (b.worthCNY || 0), 0);

  // 损益汇总
  const assetFlowMap: Record<string, { volume: number; balance: number; value: number }> = {};
  let totalNetCnyProfit = 0;

  trades.forEach(tx => {
    if (!tx.a || !tx.b) return;
    const isTaker = tx.u[0] === cleanedUser;
    const factor = isTaker ? [-1, 1] : [1, -1];

    for (let i = 0; i < 2; i++) {
      const assetCode = tx.a[i];
      if (!assetFlowMap[assetCode]) {
        assetFlowMap[assetCode] = { volume: 0, balance: 0, value: 0 };
      }
      const tokenUnitPrice = priceMap[assetCode] || 0;
      assetFlowMap[assetCode].volume += tx.b[i];
      assetFlowMap[assetCode].balance += factor[i] * tx.b[i];
      assetFlowMap[assetCode].value += factor[i] * tx.b[i] * tokenUnitPrice;
      totalNetCnyProfit += factor[i] * tx.b[i] * tokenUnitPrice;
    }
  });

  const computedPnlRows = Object.keys(assetFlowMap).map(code => ({
    assetCode: code,
    ...assetFlowMap[code]
  }));

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('确定撤销此委托吗？')) return;
    try {
      const envelope = await signerInstance.signTransactionIntent('limit_order_cancel', { order_id: orderId });
      await ddpPool.call(DDP_CONFIG.METHODS.REQUEST_PROXY_SIGN, envelope);
      alert('撤单已发送');
    } catch (err: any) {
      alert(`撤单失败: ${err.message}`);
    }
  };

  const isFav = isFavorite('users', cleanedUser);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (userSearch.trim()) {
      navigate(`/user/${userSearch.trim().toLowerCase()}`);
      setUserSearch('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 md:pb-0">
      
      {/* 头部卡片 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 md:p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black flex items-center gap-2">
            <span>👤 {t.userPanel}: <span className="text-blue-500 font-mono">{cleanedUser}</span></span>
            <button
              onClick={() => toggleFavorite('users', cleanedUser)}
              className={`text-xl cursor-pointer transition ${isFav ? 'text-amber-500' : 'text-gray-400'}`}
              title="收藏用户"
            >
              {isFav ? '★' : '☆'}
            </button>
          </h2>

          <select
            value={cleanedUser}
            onChange={(e) => navigate(`/user/${e.target.value}`)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-bold font-mono outline-none"
          >
            {Array.from(new Set([cleanedUser, ...favs.users])).map(u => (
              <option key={u} value={u}>
                {isFavorite('users', u) ? '★' : '•'} {u}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            {t.totalValuation}: ¥ {totalWorth.toFixed(2)} CNY
          </span>

          <form onSubmit={handleSearch} className="flex gap-1.5">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer">
              Go
            </button>
          </form>
        </div>
      </div>

      {/* 第一行：持仓资产 & 当前活跃挂单 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* 资产明细 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
              💰 {t.myBalances} ({processedBalances.length})
            </h3>
            <span className="text-[11px] text-gray-400 font-mono">¥ {totalWorth.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-5">{t.asset}</span>
            <span className="col-span-3 text-right">{t.availableBal}</span>
            <span className="col-span-4 text-right">{t.valueCny}</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1">
            {processedBalances.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">{t.noAsset}</p>
            ) : processedBalances.map(b => (
              <div key={parseMongoId(b._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                <Link to={`/asset/${b.a}`} className="col-span-5 font-bold text-blue-500 hover:underline truncate">🪙 {b.a}</Link>
                <span className="col-span-3 text-right">{b.f?.toLocaleString()}</span>
                <span className="col-span-4 text-right text-emerald-500 font-bold">¥ {b.worthCNY?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 当前限价挂单 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider">
              ⏳ {t.userOrders} ({openOrders.length})
            </h3>
          </div>

          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-5">{t.pair}</span>
            <span className="col-span-3 text-right">{t.price}</span>
            <span className="col-span-4 text-right">{t.amount}</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1">
            {openOrders.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">{t.noData}</p>
            ) : openOrders.map(o => (
              <div key={parseMongoId(o._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                <Link to="/market" state={{ jumpPair: `${o.a?.s}_${o.a?.b}` }} className="col-span-5 text-blue-500 hover:underline truncate">
                  {o.a?.s}/{o.a?.b}
                </Link>
                <span className="col-span-3 text-right text-red-500 font-bold">{o.p?.toFixed(4)}</span>
                <div className="col-span-4 flex items-center justify-end gap-1.5">
                  <span>{o.b?.toFixed(2)}</span>
                  {cleanedUser === currentAccount && (
                    <button onClick={() => handleCancelOrder(parseMongoId(o._id))} className="text-red-500 font-bold hover:bg-red-500/10 px-1 rounded cursor-pointer">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 第二行：转账流水 & 历史成交 (时分秒显示，悬停显示完整年月日) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* 转账明细 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <h3 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">💸 {t.userTransfers} ({transfers.length})</h3>
          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-3">{t.time}</span>
            <span className="col-span-5">{t.trader}</span>
            <span className="col-span-4 text-right">{t.amount}</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1">
            {transfers.map(tx => {
              const isSender = tx.u?.[0] === cleanedUser;
              const counterparty = isSender ? tx.u?.[1] : tx.u?.[0];
              return (
                <div key={parseMongoId(tx._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                  <span className="col-span-3 text-gray-400 text-[11px] cursor-help" title={formatFullDateTime(tx.T)}>
                    {new Date(parseMongoTime(tx.T)).toLocaleTimeString()}
                  </span>
                  <Link to={`/user/${counterparty}`} className="col-span-5 text-blue-500 hover:underline truncate">{counterparty}</Link>
                  <span className={`col-span-4 text-right font-bold ${isSender ? 'text-red-500' : 'text-emerald-500'}`}>
                    {isSender ? '← ' : '➔ '}{tx.b} <Link to={`/asset/${tx.a}`} className="hover:underline">{tx.a}</Link>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 成交记录 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex flex-col h-full">
          <h3 className="text-xs font-bold text-red-500 mb-3 uppercase tracking-wider">📜 {t.userTrades} ({trades.length})</h3>
          <div className="grid grid-cols-12 text-[11px] text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
            <span className="col-span-3">{t.time}</span>
            <span className="col-span-5">{t.pair}</span>
            <span className="col-span-4 text-right">{t.price}</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1">
            {trades.map(tr => (
              <div key={parseMongoId(tr._id)} className="grid grid-cols-12 text-xs py-1 items-center border-b border-gray-100 dark:border-gray-800/40 font-mono">
                <span className="col-span-3 text-gray-400 text-[11px] cursor-help" title={formatFullDateTime(tr.T)}>
                  {new Date(parseMongoTime(tr.T)).toLocaleTimeString()}
                </span>
                <Link to="/market" state={{ jumpPair: tr.m }} className="col-span-5 text-blue-500 hover:underline truncate">{tr.a?.join('/')}</Link>
                <b className="col-span-4 text-right text-red-500">{tr.p?.toFixed(4)}</b>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 第三行：损益汇总 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
          <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider">📈 {t.recentSummary}</h3>
          <span className="text-xs font-mono font-bold">
            {t.netProfit}: <b className={totalNetCnyProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}>¥ {totalNetCnyProfit.toFixed(2)} CNY</b>
          </span>
        </div>

        <div className="grid grid-cols-4 text-xs font-bold text-gray-400 pb-2">
          <span>{t.asset}</span>
          <span className="text-right">{t.todayVolume}</span>
          <span className="text-right">净收支</span>
          <span className="text-right">{t.valueCny}</span>
        </div>

        <div className="space-y-1.5 font-mono text-xs">
          {computedPnlRows.map(row => (
            <div key={row.assetCode} className="grid grid-cols-4 py-1 border-b border-gray-100 dark:border-gray-800/40">
              <Link to={`/asset/${row.assetCode}`} className="font-bold text-blue-500">{row.assetCode}</Link>
              <span className="text-right">{row.volume.toFixed(2)}</span>
              <span className={`text-right font-bold ${row.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{row.balance.toFixed(2)}</span>
              <span className={`text-right font-bold ${row.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>¥ {row.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 第四行：委托日志 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">📋 {t.orderHistoryLogs} ({orderHistory.length})</h3>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 font-mono text-xs">
          {orderHistory.map(oh => (
            <div key={parseMongoId(oh._id)} className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800/40">
              <span className="text-gray-400 cursor-help" title={formatFullDateTime(oh.T)}>
                {new Date(parseMongoTime(oh.T)).toLocaleTimeString()}
              </span>
              <span className={`font-bold ${oh.t === 1 ? 'text-emerald-500' : 'text-red-500'}`}>
                {oh.t === 1 ? t.placeOrder : t.cancelOrder}
              </span>
              <span className="text-blue-500 font-bold">{oh.p?.toFixed(4)}</span>
              <Link to="/market" state={{ jumpPair: oh.m }} className="text-gray-400 hover:text-blue-500 hover:underline">{oh.m}</Link>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};