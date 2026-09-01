import React, { useState } from 'react';
import { useI18n } from '../../../lib/i18n';
import { useCollection } from '../../../hooks/useCollection';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { parseMongoTime, type TransferDoc } from '../../../types/models';
import { signerInstance } from '../../../lib/crypto/signer';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';
import { PinLockManager } from '../../../lib/crypto/pinLock';

interface PayViewProps {
  currentAccount: string;
  toAccount: string;
  setToAccount: (s: string) => void;
  amount: string;
  setAmount: (s: string) => void;
  payAsset: string;
  setPayAsset: (s: string) => void;
  memo: string;
  setMemo: (s: string) => void;
  goodsName: string;
  setGoodsName: (s: string) => void;
  onOpenScanner: () => void;
}

export const PayView: React.FC<PayViewProps> = ({
  currentAccount,
  toAccount,
  setToAccount,
  amount,
  setAmount,
  payAsset,
  setPayAsset,
  memo,
  setMemo,
  goodsName,
  setGoodsName,
  onOpenScanner
}) => {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState('');
  const [error, setError] = useState('');

  // 弹窗 PIN 验证状态机
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingEnvelope, setPendingEnvelope] = useState<any>(null);

  // 近期联系人
  const allTransfers = useCollection<TransferDoc>(
    DDP_CONFIG.COLLECTIONS.TRANSFER,
    undefined,
    (a, b) => parseMongoTime(b.T) - parseMongoTime(a.T)
  );

  const recentRecipients = Array.from(new Set(
    allTransfers
      .filter(tx => tx.u?.[0] === currentAccount)
      .map(tx => tx.u[1])
  )).slice(0, 5);

  const startPaymentFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTxResult('');
    setError('');

    try {
      const envelope = await signerInstance.signTransactionIntent('transfer', {
        to_account: toAccount.toLowerCase().trim(),
        asset: payAsset.toUpperCase().trim(),
        amount: Number(amount),
        memo: memo.trim()
      });

      // 首次尝试发送请求给服务端 proxySign
      const res = await ddpPool.call(DDP_CONFIG.METHODS.REQUEST_PROXY_SIGN, envelope, goodsName);

      if (res && res.requirePin) {
        // 服务端要求提供 PIN 码
        setPendingEnvelope(envelope);
        setShowPinModal(true);
      } else {
        setTxResult(typeof res === 'string' ? res : '广播成功');
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || '交易签名失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // 本地 PIN 校验与加签转发
      const isValid = await PinLockManager.verifyPin(pinInput);
      if (!isValid) {
        throw new Error(t.pinError);
      }

      // 将 PIN 作为签名请求附加参数发给后端
      const res = await ddpPool.call(
        DDP_CONFIG.METHODS.REQUEST_PROXY_SIGN,
        pendingEnvelope,
        goodsName,
        pinInput
      );

      setShowPinModal(false);
      setPinInput('');
      setTxResult(typeof res === 'string' ? res : '广播成功');
      resetForm();
    } catch (err: any) {
      setError(err.message || 'PIN 码验证失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setToAccount('');
    setAmount('');
    setMemo('');
    setGoodsName('');
  };

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl animate-fade-in">
      
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700/50 pb-4">
        <h3 className="text-md font-extrabold text-blue-600 dark:text-blue-400">💸 {t.payView}</h3>
        <button
          type="button"
          onClick={onOpenScanner}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
        >
          📷 {t.scan}
        </button>
      </div>

      {goodsName && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex justify-between items-center text-xs">
          <span>🛒 商品: <b>{goodsName}</b></span>
          <button onClick={() => setGoodsName('')} className="text-red-500 font-bold px-2 py-1">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-2xl text-center">
          ⚠️ {error}
        </div>
      )}

      {txResult && (
        <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-2xl font-mono break-all">
          🎉 转账广播成功！单号: {txResult}
        </div>
      )}

      <form onSubmit={startPaymentFlow} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.address}</label>
          <input
            type="text"
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-500"
            placeholder="接收方 BitShares 账号名"
            required
          />
        </div>

        {recentRecipients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recentRecipients.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setToAccount(name)}
                className="text-xs bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-lg text-blue-500 font-mono"
              >
                ＋ {name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.amount}</label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-lg font-bold font-mono focus:outline-none focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.asset}</label>
            <input
              type="text"
              value={payAsset}
              onChange={(e) => setPayAsset(e.target.value.toUpperCase())}
              disabled={isSubmitting}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-lg font-black uppercase text-center text-blue-600 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.memo}</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder="可选交易备注"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg mt-2 text-sm cursor-pointer"
        >
          {isSubmitting ? '正在处理...' : t.submit}
        </button>
      </form>

      {/* PIN 验证确认弹窗 */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-xs w-full border border-gray-200 dark:border-gray-700 text-center shadow-2xl">
            <h4 className="text-md font-bold text-gray-900 dark:text-white mb-2">🔐 {t.pinInputPrompt}</h4>
            <p className="text-xs text-gray-400 mb-4">输入本地安全 PIN 码以完成签名广播</p>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-center text-xl font-mono focus:outline-none focus:border-blue-500"
                autoFocus
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 py-3 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-bold shadow-md"
                >
                  确认授权
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};