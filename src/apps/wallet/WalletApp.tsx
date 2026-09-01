import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { LockOverlay } from '../../components/LockOverlay';
import { AutoLockProvider } from '../../components/AutoLockProvider';
import { QRScannerModal } from '../../components/QRScannerModal';
import { OAuthModal } from '../../components/OAuthModal';
import { ReceiveModal } from './components/ReceiveModal';
import { Dashboard } from './pages/Dashboard';
import { PayView } from './pages/PayView';
import { SettingsView } from './pages/Settings';
import { DividendView } from './pages/DividendView';
import { Login } from './pages/Login';
import { useAuth } from '../../hooks/useAuth';
import { PinLockManager } from '../../lib/crypto/pinLock';
import { signerInstance } from '../../lib/crypto/signer';
import { ddpPool } from '../../lib/ddp/ddpSubPool';
import { DDP_CONFIG } from '../../config/ddpConfig';
import { useI18n } from '../../lib/i18n';
import type { OAuthChallengeData } from '../../types/wallet';

function WalletContent() {
  const { t } = useI18n();
  const { isLoggedIn, currentAccount, isResuming } = useAuth();
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(PinLockManager.isLocked());
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  const [oauthData, setOauthData] = useState<OAuthChallengeData | null>(null);

  // 支付表单数据
  const [toAccount, setToAccount] = useState('');
  const [payAsset, setPayAsset] = useState('BTS');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [goodsName, setGoodsName] = useState('');

  // 统一扫码处理
  const handleUniversalScan = (text: string) => {
    try {
      if (text.startsWith('btsbots://transfer') || text.includes('?to=') || text.includes('&to=')) {
        const clean = text.startsWith('btsbots://') ? text.replace('btsbots://', 'http://') : text;
        const url = new URL(clean);
        setToAccount(url.searchParams.get('to') || '');
        setPayAsset((url.searchParams.get('asset') || 'BTS').toUpperCase());
        setAmount(url.searchParams.get('amount') || '');
        setMemo(url.searchParams.get('memo') || '');
        setGoodsName(url.searchParams.get('goods') || '');
        navigate('/pay');
      } else if (text.includes('/oauth') || text.includes('client_id=') || text.includes('token=')) {
        const clean = text.startsWith('btsbots://') ? text.replace('btsbots://', 'http://') : text;
        const url = new URL(clean);
        const cid = url.searchParams.get('client_id');
        const token = url.searchParams.get('token');
        const site = url.searchParams.get('site');
        const ip = url.searchParams.get('ip') || '';
        const redirect = url.searchParams.get('redirect');

        if (cid && token && site) {
          setOauthData({ site, ip, clientId: cid, token, redirect });
        }
      } else {
        setToAccount(text.trim());
        navigate('/pay');
      }
    } catch {
      setToAccount(text.trim());
      navigate('/pay');
    }
  };

  const handleConfirmOAuth = async () => {
    if (!oauthData) return;
    try {
      const envelope = await signerInstance.signTransactionIntent('oauth_login', {
        client_id: oauthData.clientId,
        token: oauthData.token,
        site: oauthData.site,
        ip: oauthData.ip
      });

      await ddpPool.call(DDP_CONFIG.METHODS.SUBMIT_OAUTH_AUTHORIZATION, envelope);
      alert('🔐 身份所有权证书签署成功！');
      if (oauthData.redirect) {
        window.location.href = `${oauthData.redirect}?token=${oauthData.token}`;
      }
      setOauthData(null);
    } catch (err: any) {
      alert(`授权加签失败: ${err.message}`);
    }
  };

  if (isResuming) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center font-mono text-xs text-gray-400 gap-3">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>{t.securingSession}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors pb-16 md:pb-0">
      
      <AutoLockProvider onLock={() => setIsLocked(true)} />
      <LockOverlay isOpen={isLocked} onUnlocked={() => setIsLocked(false)} />

      {isLoggedIn && (
        <Navbar
          appType="wallet"
          onLockTrigger={() => setIsLocked(true)}
          onOpenScan={() => setIsScannerOpen(true)}
        />
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <Routes>
          <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <Login />} />
          
          <Route path="/" element={
            isLoggedIn ? (
              <Dashboard
                onSelectCounterparty={(acc) => { setToAccount(acc); navigate('/pay'); }}
                onOpenReceive={() => setIsReceiveOpen(true)}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          } />

          <Route path="/pay" element={
            isLoggedIn ? (
              <PayView
                currentAccount={currentAccount}
                toAccount={toAccount}
                setToAccount={setToAccount}
                amount={amount}
                setAmount={setAmount}
                payAsset={payAsset}
                setPayAsset={setPayAsset}
                memo={memo}
                setMemo={setMemo}
                goodsName={goodsName}
                setGoodsName={setGoodsName}
                onOpenScanner={() => setIsScannerOpen(true)}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          } />

          <Route path="/dividend" element={isLoggedIn ? <DividendView /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={isLoggedIn ? <SettingsView /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* 移动端底部专属 Tab 导航栏 */}
      {isLoggedIn && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex justify-around py-2 px-1 text-[11px] font-bold">
          <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center py-1 px-4 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span className="text-base">💰</span>
            <span>{t.wallet}</span>
          </NavLink>
          <NavLink to="/pay" className={({ isActive }) => `flex flex-col items-center py-1 px-4 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span className="text-base">💸</span>
            <span>{t.payView}</span>
          </NavLink>
          <NavLink to="/dividend" className={({ isActive }) => `flex flex-col items-center py-1 px-4 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span className="text-base">🎁</span>
            <span>{t.dividend}</span>
          </NavLink>
        </div>
      )}

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleUniversalScan}
      />

      <OAuthModal
        isOpen={!!oauthData}
        data={oauthData}
        onConfirm={handleConfirmOAuth}
        onCancel={() => setOauthData(null)}
      />

      <ReceiveModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        currentAccount={currentAccount}
      />

    </div>
  );
}

export const WalletApp: React.FC = () => {
  return (
    <BrowserRouter>
      <WalletContent />
    </BrowserRouter>
  );
};