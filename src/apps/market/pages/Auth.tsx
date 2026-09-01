import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

export const Auth: React.FC = () => {
  const { loginWithOtp } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await loginWithOtp(username, otp);
      navigate(`/user/${username.trim().toLowerCase()}`);
    } catch (err: any) {
      setError(err.message || 'OTP 验证失败或已失效');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
          🛡️ OTP 快速登录
        </h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          无须加载私钥，使用代理网关生成的 8 位 OTP 登入
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">BitShares 账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="请输入账号名..."
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">8 位 OTP 验证码</label>
            <input
              type="text"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-center tracking-widest text-lg font-bold font-mono focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg text-sm cursor-pointer"
          >
            {isSubmitting ? '验证中...' : '验证并登录'}
          </button>
        </form>
      </div>
    </div>
  );
};