import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../lib/i18n';
import { useBlacklist } from '../../../hooks/useBlacklist';
import { DDP_CONFIG } from '../../../config/ddpConfig';
import { ddpPool } from '../../../lib/ddp/ddpSubPool';
import { PinLockManager } from '../../../lib/crypto/pinLock';

export const SettingsView: React.FC = () => {
  const { t } = useI18n();
  const [newWhiteAsset, setNewWhiteAsset] = useState('');
  const [newBlackAsset, setNewBlackAsset] = useState('');
  const [newBlackUser, setNewBlackUser] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [hasPin, setHasPin] = useState(PinLockManager.hasPinSet());

  const [allowedAssets, setAllowedAssets] = useState<string[]>([]);
  const [hiddenAssets, setHiddenAssets] = useState<string[]>([]);
  const { blacklist, addToBlacklist, removeFromBlacklist } = useBlacklist();

  // 主动通过 RPC 获取用户配置
  const fetchSettings = async () => {
    try {
      const res = await ddpPool.call(DDP_CONFIG.METHODS.GET_MY_ASSET_SETTINGS);
      if (res) {
        setAllowedAssets(res.allowedAssets || []);
        setHiddenAssets(res.hiddenAssets || []);
      }
    } catch (err) {
      console.warn('[Settings] 加载设置失败:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhiteAsset.trim()) return;
    await ddpPool.call(DDP_CONFIG.METHODS.SET_ASSET_VISIBILITY, newWhiteAsset.toUpperCase().trim(), 1);
    setNewWhiteAsset('');
    fetchSettings();
  };

  const handleAddAssetBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlackAsset.trim()) return;
    await ddpPool.call(DDP_CONFIG.METHODS.SET_ASSET_VISIBILITY, newBlackAsset.toUpperCase().trim(), -1);
    setNewBlackAsset('');
    fetchSettings();
  };

  const handleRemoveAssetSetting = async (asset: string) => {
    await ddpPool.call(DDP_CONFIG.METHODS.SET_ASSET_VISIBILITY, asset, 0);
    fetchSettings();
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlackUser.trim()) return;
    await addToBlacklist(newBlackUser.trim());
    setNewBlackUser('');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await PinLockManager.setPin(pinInput);
      setPinInput('');
      setHasPin(true);
      alert('本地 PIN 锁屏密码设置成功！');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemovePin = async () => {
    if (confirm('确定要清除本设备的锁屏 PIN 密码吗？')) {
      await PinLockManager.removePin();
      setHasPin(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in text-sm pb-16 md:pb-0">
      
      {/* 1. 账号黑名单 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">🚫 {t.accountBlacklist}</h3>
        <p className="text-xs text-gray-500 mb-4">{t.blacklistDesc}</p>

        <form onSubmit={handleAddBlacklist} className="flex gap-2 mb-4 max-w-md">
          <input
            type="text"
            placeholder="输入要屏蔽的 BitShares 账号名..."
            value={newBlackUser}
            onChange={(e) => setNewBlackUser(e.target.value)}
            className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-2xl text-xs transition cursor-pointer"
          >
            {t.addBtn}
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {blacklist.length === 0 ? (
            <p className="text-xs text-gray-400">暂无拉黑账号</p>
          ) : (
            blacklist.map(user => (
              <div key={user} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1.5 rounded-xl text-xs font-mono">
                <span>👤 {user}</span>
                <button
                  type="button"
                  onClick={() => removeFromBlacklist(user)}
                  className="font-bold ml-1 cursor-pointer hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. 本地 PIN 锁屏管理 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">🛡️ {t.pinSetupTitle}</h3>
        <p className="text-xs text-gray-500 mb-4">{t.pinSetupDesc}</p>
        
        <form onSubmit={handleSavePin} className="space-y-3 max-w-sm">
          <input
            type="password"
            maxLength={6}
            placeholder={t.pinPlaceholder}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-center text-lg font-bold font-mono focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {hasPin ? t.changePin : t.setPin}
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={handleRemovePin}
                className="bg-red-500/10 text-red-500 font-bold px-3 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                {t.clearPin}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 3. 资产白名单 & 资产黑名单 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* 白名单 */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">⚙️ {t.assetWhitelist}</h3>
          <p className="text-xs text-gray-500 mb-4">{t.whitelistDesc}</p>
          
          <form onSubmit={handleAddWhitelist} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. USDT"
              value={newWhiteAsset}
              onChange={(e) => setNewWhiteAsset(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3.5 py-2 text-xs font-mono uppercase focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-2xl text-xs transition cursor-pointer"
            >
              {t.addBtn}
            </button>
          </form>

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {allowedAssets.map(asset => (
              <div key={asset} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 px-3 py-1.5 rounded-xl text-xs font-mono">
                <span>{asset}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAssetSetting(asset)}
                  className="text-red-500 font-bold ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 黑名单 */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">🚫 {t.assetBlacklist}</h3>
          <p className="text-xs text-gray-500 mb-4">{t.assetBlacklistDesc}</p>

          <form onSubmit={handleAddAssetBlacklist} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. SCAM.TOKEN"
              value={newBlackAsset}
              onChange={(e) => setNewBlackAsset(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3.5 py-2 text-xs font-mono uppercase focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-2xl text-xs transition cursor-pointer"
            >
              {t.addBtn}
            </button>
          </form>

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {hiddenAssets.map(asset => (
              <div key={asset} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1.5 rounded-xl text-xs font-mono">
                <span>{asset}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAssetSetting(asset)}
                  className="text-red-500 font-bold ml-1 cursor-pointer hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
