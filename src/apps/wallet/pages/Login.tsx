import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../lib/i18n';

export const Login: React.FC = () => {
  const { t } = useI18n();
  const { loginWithOtp } = useAuth();
  const navigate = useNavigate();

  const [account, setAccount] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await loginWithOtp(account, otp);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'OTP 验证失败或已过期');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-950 text-gray-100 flex items-center justify-center p-3.5 sm:p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 sm:p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-5 sm:mb-6">
          <div className="h-11 w-11 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white text-xl mx-auto mb-2.5 shadow-md">
            B
          </div>
          <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            BTSBots 智能钱包
          </h2>
          <p className="text-[11px] text-gray-400 mt-1 leading-snug">
            使用 Python 客户端或守护网关分配的 8 位 OTP 免私钥极速登入
          </p>
        </div>

        {error && (
          <div className="mb-3.5 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs text-gray-400 mb-1">BitShares 账号</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-mono text-xs sm:text-sm"
              placeholder="请输入账号名..."
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">8 位数字验证码 (OTP)</label>
            <input
              type="text"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 text-center tracking-widest text-lg font-bold font-mono"
              placeholder="00000000"
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 text-white font-bold py-3 rounded-2xl transition shadow-lg mt-1 text-xs sm:text-sm cursor-pointer"
          >
            {isSubmitting ? '正在验证安全凭据...' : t.login}
          </button>
        </form>
      </div>
    </div>
  );
};