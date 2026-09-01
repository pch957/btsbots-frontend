import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { signerInstance } from './lib/crypto/signer';

// 初始化本地 WebCrypto 会话临时密钥
signerInstance.initializeOrLoadKey().catch(console.error);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}