import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAsAdmin, setLoginAsAdmin] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      if (loginAsAdmin) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubEnterpriseLogin = async () => {
    try {
      const resp = await api.get<{ client_id: string | null; sso_url: string; has_oauth: boolean }>('/auth/github/config');
      const { client_id, sso_url, has_oauth } = resp.data;

      if (has_oauth && client_id) {
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/github/callback`);
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=user:email&redirect_uri=${redirectUri}`;
      } else {
        window.open(sso_url || 'https://github.com/enterprises/kpmg-emu/sso', '_blank');
        navigate('/auth/github/callback');
      }
    } catch {
      window.open('https://github.com/enterprises/kpmg-emu/sso', '_blank');
      navigate('/auth/github/callback');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg mb-4">
            <i className="fa-solid fa-robot"></i>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">QualiVerse AI</h2>
          <p className="mt-2 text-sm text-slate-600">Sign in to access the Enterprise AI Solutions Directory</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Login Type Toggle */}
            <div className="flex items-center justify-center space-x-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-sm font-medium text-slate-700">Login as:</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setLoginAsAdmin(false)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    !loginAsAdmin
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <i className="fa-solid fa-user mr-1.5"></i>
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setLoginAsAdmin(true)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    loginAsAdmin
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <i className="fa-solid fa-shield-halved mr-1.5"></i>
                  Admin
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                loginAsAdmin
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                  Signing in...
                </span>
              ) : (
                `Sign in as ${loginAsAdmin ? 'Admin' : 'User'}`
              )}
            </button>
          </form>

          {/* GitHub Enterprise SSO Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          {/* KPMG-EMU GitHub Enterprise SSO Button */}
          <button
            type="button"
            onClick={handleGitHubEnterpriseLogin}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm border border-slate-700 cursor-pointer"
          >
            <i className="fa-brands fa-github text-base"></i>
            <span>Sign in with KPMG GitHub Enterprise</span>
            <i className="fa-solid fa-arrow-right text-[10px] ml-1 text-slate-400"></i>
          </button>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
