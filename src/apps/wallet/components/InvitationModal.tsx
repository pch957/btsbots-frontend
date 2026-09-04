import React, { useState, useEffect } from 'react';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { formatFullDateTime, type InvitationDoc } from '../../../types/models';

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: string;
  isVip: boolean;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  isOpen,
  onClose,
  currentAccount,
  isVip
}) => {
  const [invitations, setInvitations] = useState<InvitationDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'unused' | 'used'>('unused');
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchInvitations = async () => {
    if (!currentAccount) return;
    try {
      setLoading(true);
      const list = await ddpPool.call<InvitationDoc[]>(DDP_CONFIG.METHODS.LIST_INVITATIONS, currentAccount);
      if (Array.isArray(list)) {
        setInvitations(list);
      }
    } catch (err: any) {
      console.warn('[Invitation] 拉取邀请码失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
      setStatusMsg('');
    }
  }, [isOpen, currentAccount]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVip) {
      alert('抱歉，仅 BitShares 终生会员 (Lifetime Member) 有权限生成邀请码！');
      return;
    }

    try {
      setLoading(true);
      setStatusMsg('');
      const res = await ddpPool.call(DDP_CONFIG.METHODS.GENERATE_INVITATION, currentAccount, generateCount);
      setStatusMsg(res?.message || '邀请码生成成功！');
      await fetchInvitations();
    } catch (err: any) {
      alert(`生成失败: ${err.message || err.reason}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`确定要删除未使用的邀请码 ${code} 吗？`)) return;

    try {
      setLoading(true);
      await ddpPool.call(DDP_CONFIG.METHODS.DELETE_INVITATION, currentAccount, code);
      setInvitations(prev => prev.filter(item => item.code !== code));
    } catch (err: any) {
      alert(`删除失败: ${err.message || err.reason}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`已复制邀请码: ${text}`);
  };

  if (!isOpen) return null;

  const unusedList = invitations.filter(i => i.status === 'unused');
  const usedList = invitations.filter(i => i.status === 'used');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in text-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* 头部 */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎟️</span>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                邀请码管理中心
              </h3>
              <p className="text-xs text-gray-500">
                邀请好友注册可永久获取其交易手续费分红
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 终生会员身份控制条 */}
        <div className="my-4 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/60 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${isVip ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-gray-500/10 text-gray-400'}`}>
              {isVip ? '👑 终生会员 (VIP)' : '普通会员'}
            </span>
            <span className="text-xs text-gray-500">
              未用数量: <b className="text-blue-500 font-mono">{unusedList.length}</b> / 20
            </span>
          </div>

          {isVip ? (
            <form onSubmit={handleGenerate} className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={Math.max(1, 20 - unusedList.length)}
                value={generateCount}
                onChange={(e) => setGenerateCount(parseInt(e.target.value, 10) || 1)}
                className="w-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1 text-center font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading || unusedList.length >= 20}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold px-3 py-1 rounded-xl text-xs transition cursor-pointer"
              >
                + 生成
              </button>
            </form>
          ) : (
            <span className="text-xs text-amber-500 font-medium">⚠️ 仅终生会员可生成新码</span>
          )}
        </div>

        {statusMsg && (
          <div className="mb-3 p-2 bg-emerald-500/10 text-emerald-500 text-xs rounded-xl border border-emerald-500/20 text-center">
            {statusMsg}
          </div>
        )}

        {/* 🌟 4. 未使用与已使用 Tab 分开显示 */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 mb-3 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('unused')}
            className={`pb-2 transition border-b-2 ${
              activeTab === 'unused' 
                ? 'border-blue-500 text-blue-500' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🎟️ 未使用邀请码 ({unusedList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('used')}
            className={`pb-2 transition border-b-2 ${
              activeTab === 'used' 
                ? 'border-blue-500 text-blue-500' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📜 已使用历史 ({usedList.length})
          </button>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
          {activeTab === 'unused' ? (
            unusedList.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">
                暂无未使用的邀请码
              </div>
            ) : (
              unusedList.map((item) => (
                <div
                  key={item.code}
                  className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
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
                      onClick={() => copyToClipboard(item.code)}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition"
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.code)}
                      disabled={loading}
                      className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            // 🌟 5. 已使用的邀请码：展示使用人、使用时间，无复制按钮与删除按钮
            usedList.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">
                暂无已被使用的邀请码
              </div>
            ) : (
              usedList.map((item) => (
                <div
                  key={item.code}
                  className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs opacity-80"
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

        {/* 底部按钮 */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold px-5 py-2 rounded-2xl text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            关闭
          </button>
        </div>

      </div>
    </div>
  );
};