import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../lib/i18n';
import { useAuth } from '../../../hooks/useAuth';
import { useDdpSubscription } from '../../../hooks/useDdpSubscription';
import { useCollection } from '../../../hooks/useCollection';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { 
  parseMongoId, 
  parseMongoTime, 
  formatFullDateTime, 
  formatVestingId,
  type VestingDoc, 
  type VestingWithdrawDoc, 
  type AccountDoc,
  type InvitationDoc
} from '../../../types/models';
import { signerInstance } from '../../../lib/crypto/signer';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';

const VESTING_TYPE_NAMES: Record<number, { label: string; color: string }> = {
  0: { label: '待定分红', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  1: { label: '交易返现', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  2: { label: '工人预算', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  3: { label: '见证人出块', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  4: { label: '手续费分成', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' }
};

export const DividendView: React.FC = () => {
  const { t } = useI18n();
  const { currentAccount } = useAuth();

  // 当前主 Tab：'vesting' (分红与流水) | 'invitations' (邀请码与裂变)
  const [activeMainTab, setActiveMainTab] = useState<'vesting' | 'invitations'>('vesting');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLifetimeMember, setIsLifetimeMember] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 邀请码板块内部状态
  const [invitations, setInvitations] = useState<InvitationDoc[]>([]);
  const [inviteTab, setInviteTab] = useState<'unused' | 'used'>('unused');
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatusMsg, setInviteStatusMsg] = useState('');

  // 1. 订阅可领分红 (vesting)、领取历史 (vesting_withdraw)
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.VESTING, { u: currentAccount });
  useDdpSubscription(DDP_CONFIG.PUBLICATIONS.VESTING_WITHDRAW, { u: currentAccount });

  const vestings = useCollection<VestingDoc>(
    DDP_CONFIG.COLLECTIONS.VESTING,
    v => v.u === currentAccount
  );

  const withdraws = useCollection<VestingWithdrawDoc>(
    DDP_CONFIG.COLLECTIONS.VESTING_WITHDRAW,
    w => w.u === currentAccount,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );

  // 使用 RPC 获取当前用户 VIP / 终生会员状态
  useEffect(() => {
    const checkVipStatus = async () => {
      if (!currentAccount) return;
      try {
        const doc = await ddpPool.call<AccountDoc>(DDP_CONFIG.METHODS.GET_ACCOUNT_BY_SYMBOL, currentAccount);
        setIsLifetimeMember(!!doc?.v);
      } catch (err) {
        console.warn('[DividendView] 查询 VIP 状态失败:', err);
      }
    };
    checkVipStatus();
  }, [currentAccount]);

  // 拉取邀请码列表
  const fetchInvitations = async () => {
    if (!currentAccount) return;
    try {
      setInviteLoading(true);
      const list = await ddpPool.call<InvitationDoc[]>(DDP_CONFIG.METHODS.LIST_INVITATIONS, currentAccount);
      if (Array.isArray(list)) {
        setInvitations(list);
      }
    } catch (err: any) {
      console.warn('[DividendView] 拉取邀请码失败:', err);
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'invitations') {
      fetchInvitations();
      setInviteStatusMsg('');
    }
  }, [activeMainTab, currentAccount]);

  // 生成邀请码
  const handleGenerateInvitations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLifetimeMember) {
      alert('抱歉，仅 BitShares 终生会员 (Lifetime Member) 有权限生成邀请码！');
      return;
    }

    try {
      setInviteLoading(true);
      setInviteStatusMsg('');
      const res = await ddpPool.call(DDP_CONFIG.METHODS.GENERATE_INVITATION, currentAccount, generateCount);
      setInviteStatusMsg(res?.message || '邀请码生成成功！');
      await fetchInvitations();
    } catch (err: any) {
      alert(`生成失败: ${err.message || err.reason}`);
    } finally {
      setInviteLoading(false);
    }
  };

  // 删除未使用的邀请码
  const handleDeleteInvitation = async (code: string) => {
    if (!confirm(`确定要删除未使用的邀请码 ${code} 吗？`)) return;

    try {
      setInviteLoading(true);
      await ddpPool.call(DDP_CONFIG.METHODS.DELETE_INVITATION, currentAccount, code);
      setInvitations(prev => prev.filter(item => item.code !== code));
    } catch (err: any) {
      alert(`删除失败: ${err.message || err.reason}`);
    } finally {
      setInviteLoading(false);
    }
  };

  // 🌟 统一固定指向生产域名 https://btsbots.com，完美兼容 Web、Capacitor App 与 Tauri 桌面端
  const copyInviteGuideUrl = (code: string) => {
    const inviteUrl = `https://btsbots.com/docs/register_guide.html?invite=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(inviteUrl);
    alert(`🎉 已复制专属邀请注册链接：\n\n${inviteUrl}\n\n好友打开即可查看教程并使用该邀请码完成注册！`);
  };

  // 提现单笔分红
  const handleClaimSingle = async (item: VestingDoc) => {
    const vestingId = formatVestingId(item._id || item.id);
    const claimableAmount = (item.b || 0) * (item.p !== undefined ? item.p : 1.0);

    if (claimableAmount <= 0) {
      alert('当前可领取金额为 0');
      return;
    }

    if (!confirm(`确认领取 ${claimableAmount.toFixed(4)} ${item.a} 分红收益吗？`)) return;

    setIsSubmitting(true);
    setSuccessMsg('');
    try {
      const envelope = await signerInstance.signTransactionIntent('withdraw_vesting', {
        vesting_balance: vestingId,
        owner: currentAccount,
        amount: claimableAmount,
        asset: item.a
      });

      await ddpPool.call(DDP_CONFIG.METHODS.REQUEST_PROXY_SIGN, envelope);
      setSuccessMsg(`🎉 分红提取指令已广播！对象 ID: ${vestingId}`);
    } catch (err: any) {
      alert(`领取失败: ${err.message || err.reason}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unusedInviteList = invitations.filter(i => i.status === 'unused');
  const usedInviteList = invitations.filter(i => i.status === 'used');

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16 md:pb-0 text-sm">
      
      {/* 顶部双 Tab 导航条 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-base md:text-lg font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <span>🎁 {t.dividendTitle}</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            持有生态资产、参与交易返还或邀请好友共享手续费终生分红
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 text-xs font-bold w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveMainTab('vesting')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMainTab === 'vesting'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span>💎</span>
            <span>待领分红与记录 ({vestings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('invitations')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMainTab === 'invitations'
                ? 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span>🎟️</span>
            <span>邀请码管理</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-2xl font-mono">
          {successMsg}
        </div>
      )}

      {/* 视图 A：待领分红卡片与历史流水 */}
      {activeMainTab === 'vesting' && (
        <>
          {/* 待领分红明细 */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
              💎 待领分红明细 ({vestings.length})
            </h3>

            {vestings.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-10 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                ℹ️ {t.noDividend}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vestings.map((item) => {
                  const vestingId = formatVestingId(item._id || item.id);
                  const percent = item.p !== undefined ? Math.round(item.p * 100) : 100;
                  const claimableAmt = (item.b || 0) * (item.p !== undefined ? item.p : 1.0);
                  const typeInfo = VESTING_TYPE_NAMES[item.t] || VESTING_TYPE_NAMES[0];

                  return (
                    <div
                      key={vestingId}
                      className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-4 flex flex-col justify-between gap-3 transition hover:border-blue-500/40"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-black text-base text-gray-900 dark:text-white">
                              {item.a}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 font-mono">
                            链上对象: {vestingId}
                          </span>
                        </div>

                        <span className="text-xs font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">
                          可领比例: {percent}%
                        </span>
                      </div>

                      <div className="flex justify-between items-end pt-2 border-t border-gray-100 dark:border-gray-800">
                        <div>
                          <span className="text-[10px] text-gray-400 block">待领金额</span>
                          <span className="text-base font-black text-emerald-500 font-mono">
                            {claimableAmt.toLocaleString(undefined, { maximumFractionDigits: 5 })} <span className="text-xs text-gray-400">{item.a}</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleClaimSingle(item)}
                          disabled={isSubmitting || claimableAmt <= 0}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer"
                        >
                          领取
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 历史领取记录流水 */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
              📜 {t.dividendHistory} ({withdraws.length})
            </h3>

            {withdraws.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">{t.noDividendHistory}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs text-gray-700 dark:text-gray-300">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 font-bold">
                      <th className="py-2.5">资产</th>
                      <th className="py-2.5">领取数量</th>
                      <th className="py-2.5">区块高度</th>
                      <th className="py-2.5 text-right">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                    {withdraws.map((tx) => (
                      <tr key={parseMongoId(tx._id || tx.id)} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                        <td className="py-2.5 font-bold text-gray-900 dark:text-white">
                          🪙 {tx.a}
                        </td>
                        <td className="py-2.5 text-emerald-500 font-bold">
                          +{tx.b?.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-gray-400 text-[11px]">
                          #{tx.B}
                        </td>
                        <td className="py-2.5 text-right text-gray-400 text-[11px]" title={formatFullDateTime(tx.T)}>
                          {new Date(parseMongoTime(tx.T)).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 视图 B：邀请码管理 */}
      {activeMainTab === 'invitations' && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
          
          <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700/60">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🎟️ 终生会员专属邀请码</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                点击复制按钮将生成包含专属邀请码的注册教程链接，好友注册后您将永久获得交易手续费分红
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-xl font-bold ${isLifetimeMember ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-gray-500/10 text-gray-400'}`}>
                {isLifetimeMember ? '👑 终生会员 (VIP)' : '普通会员'}
              </span>
            </div>
          </div>

          {/* 生成控制栏 */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-700/60 flex flex-wrap justify-between items-center gap-4">
            <div className="text-xs text-gray-500">
              当前未使用邀请码: <b className="text-blue-500 font-mono text-sm">{unusedInviteList.length}</b> / 20 上限
            </div>

            {isLifetimeMember ? (
              <form onSubmit={handleGenerateInvitations} className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, 20 - unusedInviteList.length)}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-center font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={inviteLoading || unusedInviteList.length >= 20}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer"
                >
                  {inviteLoading ? '正在生成...' : '+ 生成邀请码'}
                </button>
              </form>
            ) : (
              <span className="text-xs text-amber-500 font-medium">⚠️ 仅终生会员 (Lifetime Member) 拥有生成新邀请码权限</span>
            )}
          </div>

          {inviteStatusMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-500 text-xs rounded-xl border border-emerald-500/20 text-center font-mono">
              {inviteStatusMsg}
            </div>
          )}

          {/* 未使用与已使用分类 Tab */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => setInviteTab('unused')}
              className={`pb-2.5 transition border-b-2 cursor-pointer ${
                inviteTab === 'unused' 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              🎟️ 未使用邀请码 ({unusedInviteList.length})
            </button>
            <button
              type="button"
              onClick={() => setInviteTab('used')}
              className={`pb-2.5 transition border-b-2 cursor-pointer ${
                inviteTab === 'used' 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              📜 已使用历史 ({usedInviteList.length})
            </button>
          </div>

          {/* 列表渲染 */}
          <div className="space-y-2">
            {inviteTab === 'unused' ? (
              unusedInviteList.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
                  暂无未使用的邀请码，点击上方按钮即可一键生成
                </div>
              ) : (
                unusedInviteList.map((item) => (
                  <div
                    key={item.code}
                    className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-gray-900 dark:text-white tracking-wide">
                          {item.code}
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold">
                          可使用
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono">
                        创建时间: {formatFullDateTime(item.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyInviteGuideUrl(item.code)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1"
                        title="复制带有邀请码的专属注册教程链接"
                      >
                        <span>🔗</span>
                        <span>复制专属链接</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInvitation(item.code)}
                        disabled={inviteLoading}
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              usedInviteList.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
                  暂无已被使用的邀请码记录
                </div>
              ) : (
                usedInviteList.map((item) => (
                  <div
                    key={item.code}
                    className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs opacity-85"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-gray-500 dark:text-gray-300 tracking-wide line-through">
                          {item.code}
                        </span>
                        <span className="bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold">
                          已注册
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 space-y-0.5">
                        <p>使用者账号: <b className="text-blue-500 font-mono">{item.usedBy || '未知'}</b></p>
                        <p className="font-mono">使用时间: {item.usedAt ? formatFullDateTime(item.usedAt) : '--'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

        </div>
      )}

    </div>
  );
};