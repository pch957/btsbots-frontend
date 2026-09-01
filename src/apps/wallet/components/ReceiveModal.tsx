import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../../../lib/i18n';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: string;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
  isOpen,
  onClose,
  currentAccount
}) => {
  const { t } = useI18n();
  const [qrAsset, setQrAsset] = useState('');
  const [qrAmount, setQrAmount] = useState('');
  const [qrMemo, setQrMemo] = useState('');
  const [qrGoods, setQrGoods] = useState('');

  if (!isOpen) return null;

  const buildUri = () => {
    const params = new URLSearchParams();
    params.append('to', currentAccount);
    if (qrAsset) params.append('asset', qrAsset.toUpperCase().trim());
    if (qrAmount) params.append('amount', qrAmount.trim());
    if (qrMemo) params.append('memo', qrMemo.trim());
    if (qrGoods) params.append('goods', qrGoods.trim());
    return `btsbots://transfer?${params.toString()}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col items-center">
        
        <div className="flex justify-between items-center w-full mb-4">
          <h3 className="text-md font-bold text-gray-900 dark:text-white">📥 {t.receive}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold px-2 py-1 cursor-pointer">✕</button>
        </div>

        <div className="bg-white p-4 rounded-2xl mb-4 shadow-md border border-gray-100">
          <QRCodeSVG value={buildUri()} size={190} />
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-xl w-full text-center select-all border border-gray-200 dark:border-gray-800 mb-4">
          {currentAccount}
        </p>

        <div className="w-full border-t border-gray-100 dark:border-gray-700/60 pt-4 space-y-3">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t.qrOpt}</h4>
          
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder={t.optAsset}
              value={qrAsset}
              onChange={(e) => setQrAsset(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              step="any"
              placeholder={t.optAmt}
              value={qrAmount}
              onChange={(e) => setQrAmount(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <input
            type="text"
            placeholder={t.optMemo}
            value={qrMemo}
            onChange={(e) => setQrMemo(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
          />

          <input
            type="text"
            placeholder={t.optGoods}
            value={qrGoods}
            onChange={(e) => setQrGoods(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

      </div>
    </div>
  );
};