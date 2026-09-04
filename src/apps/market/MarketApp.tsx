import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { LockOverlay } from '../../components/LockOverlay';
import { AutoLockProvider } from '../../components/AutoLockProvider';
import { QRScannerModal } from '../../components/QRScannerModal';
import { OAuthModal } from '../../components/OAuthModal';
import { Home } from './pages/Home';
import { Market } from './pages/Market';
import { AssetDetail } from './pages/AssetDetail';
import { UserDetail } from './pages/UserDetail';
import { Auth } from './pages/Auth';
import { PayView } from '../wallet/pages/PayView';
import { SettingsView } from '../wallet/pages/Settings';
import { PinLockManager } from '../../lib/crypto/pinLock';
import { signerInstance } from '../../lib/crypto/signer';
import { ddpPool } from '../../lib/ddp/ddpSubPool';
import { DDP_CONFIG } from '../../config/ddpConfig';
import { useAuth } from '../../hooks/useAuth';
import type { OAuthChallengeData } from '../../types/wallet';

function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      document.title = 'BTSBots Market - 首页';
    } else if (path.startsWith('/market')) {
      document.title = 'BTSBots Market - 交易';
    } else if (path.startsWith('/asset')) {
      document.title = 'BTSBots Market - 资产';
    } else if (path.startsWith('/user')) {
      document.title = 'BTSBots Market - 账户';
    } else if (path.startsWith('/pay')) {
      document.title = 'BTSBots Market - 转账';
    } else if (path.startsWith('/settings')) {
      document.title = 'BTSBots Market - 设置';
    } else if (path.startsWith('/auth')) {
      document.title = 'BTSBots Market - 登录';
    } else {
      document.title = 'BTSBots Market';
    }
  }, [location]);

  return null;
}

function MarketContent() {
  const { currentAccount } = useAuth();
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(PinLockManager.isLocked());
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [oauthData, setOauthData] = useState<OAuthChallengeData | null>(null);

  // 转账表单状态
  const [toAccount, setToAccount] = useState('');
  const [payAsset, setPayAsset] = useState('BTS');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [goodsName, setGoodsName] = useState('');

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
      
      const targetRedirect = oauthData.redirect;
      const token = oauthData.token;
      setOauthData(null);

      if (targetRedirect) {
        window.location.href = `${targetRedirect}?token=${token}`;
      } else if (window.opener) {
        window.close();
      }
    } catch (err: any) {
      alert(`授权加签失败: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors pb-16 md:pb-0">
      <TitleUpdater />
      <AutoLockProvider onLock={() => setIsLocked(true)} />
      <LockOverlay isOpen={isLocked} onUnlocked={() => setIsLocked(false)} />

      <Navbar
        appType="market"
        onLockTrigger={() => setIsLocked(true)}
        onOpenScan={() => setIsScannerOpen(true)}
      />

      <main className="max-w-7xl mx-auto p-3 md:p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/market" element={<Market />} />
          <Route path="/asset/:assetName" element={<AssetDetail />} />
          <Route path="/asset" element={<Navigate to="/asset/BTS" replace />} />
          <Route path="/user/:username" element={<UserDetail />} />
          <Route path="/user" element={<Navigate to="/user/demo.btsbots" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/pay" element={
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
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

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

    </div>
  );
}

export const MarketApp: React.FC = () => {
  return (
    <BrowserRouter>
      <MarketContent />
    </BrowserRouter>
  );
};