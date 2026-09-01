import React from 'react';
import { I18nContext, useI18nProvider } from './lib/i18n';
import { WalletApp } from './apps/wallet/WalletApp';
import { MarketApp } from './apps/market/MarketApp';

export const App: React.FC = () => {
  const i18nValue = useI18nProvider();
  const appMode = import.meta.env.VITE_APP_MODE || 'wallet';

  return (
    <I18nContext.Provider value={i18nValue}>
      {appMode === 'market' ? <MarketApp /> : <WalletApp />}
    </I18nContext.Provider>
  );
};

export default App;