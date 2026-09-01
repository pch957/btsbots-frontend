import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useI18n, type LangKey } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  appType: 'market' | 'wallet';
  onLockTrigger: () => void;
  onOpenScan?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  appType,
  onLockTrigger,
  onOpenScan
}) => {
  const { lang, setLang, t } = useI18n();
  const { isLoggedIn, currentAccount, logout, isConnected } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('btsbots_theme') !== 'light';
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('btsbots_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('btsbots_theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate(appType === 'market' ? '/auth' : '/login');
  };

  return (
    <>
      <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 px-3 md:px-6 py-2.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* 左侧 Logo 与 PC 导航链接 */}
          <div className="flex items-center gap-3 md:gap-6">
            <Link to="/" className="flex items-center gap-2 font-black text-lg md:text-xl tracking-tight">
              <span className="text-2xl filter drop-shadow">🤖</span>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                BTSBots
              </span>
              <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-mono font-bold uppercase">
                {appType}
              </span>
            </Link>

            {/* PC 端导航链接 (Market App) */}
            {appType === 'market' && (
              <div className="hidden md:flex items-center gap-5 text-xs font-bold text-gray-600 dark:text-gray-300">
                <NavLink to="/" end className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>{t.home}</NavLink>
                <NavLink to="/market" className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>{t.trade}</NavLink>
                <NavLink to="/asset" className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>{t.asset}</NavLink>
                <NavLink to={currentAccount ? `/user/${currentAccount}` : '/user/demo.btsbots'} className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>{t.account}</NavLink>
                <NavLink to="/pay" className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>{t.payView}</NavLink>
                <a href="/docs/index.html" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition flex items-center gap-1 text-blue-500 font-bold">
                  <span>📚</span>
                  <span>{t.docs}</span>
                </a>
              </div>
            )}

            {/* PC 端导航链接 (Wallet App) */}
            {appType === 'wallet' && (
              <div className="hidden md:flex items-center gap-5 text-xs font-bold text-gray-600 dark:text-gray-300">
                <NavLink to="/" end className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>💰 {t.wallet}</NavLink>
                <NavLink to="/pay" className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>💸 {t.payView}</NavLink>
                <NavLink to="/dividend" className={({ isActive }) => `hover:text-blue-500 transition ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>🎁 {t.dividend}</NavLink>
                <a href="/docs/index.html" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition flex items-center gap-1 text-blue-500 font-bold">
                  <span>📚</span>
                  <span>{t.docs}</span>
                </a>
              </div>
            )}
          </div>

          {/* 右侧控制区 */}
          <div className="flex items-center gap-2 md:gap-3" ref={menuRef}>
            {/* 节点连接指示灯 */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-amber-500 shadow-[0_0_6px_#f59e0b]'}`}
              title={isConnected ? t.nodeConnected : t.nodeDisconnected}
            />

            {/* 锁屏按钮 */}
            <button
              onClick={onLockTrigger}
              title={t.lockWallet}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-gray-200 dark:border-gray-700"
            >
              🔒 <span className="hidden sm:inline">{t.lockWallet}</span>
            </button>

            {/* 下拉菜单 */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 md:p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 cursor-pointer border border-gray-200 dark:border-gray-700"
              >
                👤 <span className="font-mono max-w-[70px] md:max-w-[100px] truncate">{isLoggedIn ? currentAccount : t.login}</span>
                <span className="text-[10px]">▾</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-2 z-50 text-xs animate-fade-in divide-y divide-gray-100 dark:divide-gray-700/50">
                  
                  {/* 扫码识别 */}
                  {onOpenScan && (
                    <button
                      onClick={() => { setMenuOpen(false); onOpenScan(); }}
                      className="w-full text-left px-4 py-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                      📷 {t.scan}
                    </button>
                  )}

                  {/* 设置中心 */}
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 font-bold transition"
                  >
                    ⚙️ {t.settings}
                  </Link>

                  {/* 📚 文档中心 */}
                  <a
                    href="/docs/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold transition"
                  >
                    📚 {t.docs}
                  </a>

                  {/* 语言选择 */}
                  <div className="flex justify-between items-center px-4 py-2.5 text-gray-700 dark:text-gray-300">
                    <span>🌐 语言</span>
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as LangKey)}
                      className="bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1 outline-none text-xs text-gray-800 dark:text-gray-200"
                    >
                      <option value="zh">🇨🇳 中文</option>
                      <option value="en">🇺🇸 EN</option>
                      <option value="ru">🇷🇺 RU</option>
                    </select>
                  </div>

                  {/* 主题切换 */}
                  <div className="flex justify-between items-center px-4 py-2.5 text-gray-700 dark:text-gray-300">
                    <span>{isDark ? '🌙 暗黑模式' : '☀️ 明亮模式'}</span>
                    <button
                      onClick={() => setIsDark(!isDark)}
                      className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-lg cursor-pointer text-xs"
                    >
                      切换
                    </button>
                  </div>

                  {/* 登录/登出 */}
                  <div className="pt-1">
                    {isLoggedIn ? (
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold transition cursor-pointer"
                      >
                        🚪 {t.logout}
                      </button>
                    ) : (
                      <Link
                        to={appType === 'market' ? '/auth' : '/login'}
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-blue-500 font-bold hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      >
                        🔑 {t.login}
                      </Link>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>

        </div>
      </nav>

      {/* 手机端专用底部快捷导航栏 (Market App) */}
      {appType === 'market' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex justify-around py-2 px-1 text-[11px] font-bold">
          <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center py-1 px-2 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span>🏠</span>
            <span>{t.home}</span>
          </NavLink>
          <NavLink to="/market" className={({ isActive }) => `flex flex-col items-center py-1 px-2 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span>📊</span>
            <span>{t.trade}</span>
          </NavLink>
          <NavLink to="/asset" className={({ isActive }) => `flex flex-col items-center py-1 px-2 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span>🪙</span>
            <span>{t.asset}</span>
          </NavLink>
          <NavLink to={currentAccount ? `/user/${currentAccount}` : '/user/demo.btsbots'} className={({ isActive }) => `flex flex-col items-center py-1 px-2 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span>👤</span>
            <span>{t.account}</span>
          </NavLink>
          <NavLink to="/pay" className={({ isActive }) => `flex flex-col items-center py-1 px-2 rounded-xl ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            <span>💸</span>
            <span>{t.payView}</span>
          </NavLink>
        </div>
      )}
    </>
  );
};