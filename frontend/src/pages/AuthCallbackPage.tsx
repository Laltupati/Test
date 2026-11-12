import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { loginWithGitHub, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState('Authenticating with GitHub Enterprise...');
  const [error, setError] = useState<string | null>(null);
  const savedEmail = localStorage.getItem('github_enterprise_email') || '';
  const [enterpriseEmail, setEnterpriseEmail] = useState(savedEmail);
  const [provisioning, setLoadingProvisioning] = useState(false);
  const autoAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    const code = searchParams.get('code');
    if (code) {
      loginWithGitHub({ code })
        .then(() => {
          navigate('/', { replace: true });
        })
        .catch((err) => {
          console.error('GitHub OAuth error:', err);
          setError(err.response?.data?.detail || 'GitHub OAuth token exchange failed.');
        });
    } else if (savedEmail && !autoAttempted.current) {
      autoAttempted.current = true;
      setStatusText('Logging in returning enterprise user...');
      setLoadingProvisioning(true);
      loginWithGitHub({ email: savedEmail })
        .then(() => {
          navigate('/', { replace: true });
        })
        .catch(() => {
          setLoadingProvisioning(false);
          setStatusText('GitHub Enterprise SSO Complete');
        });
    } else {
      setStatusText('GitHub Enterprise SSO Complete');
    }
  }, [searchParams, isAuthenticated, loginWithGitHub, navigate, savedEmail]);

  const handleJitProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterpriseEmail) return;

    const emailDomain = enterpriseEmail.trim().split('@').pop()?.toLowerCase();
    if (emailDomain !== 'kpmg.com' && emailDomain !== 'qualiverse.ai') {
      setError('Access denied. Only @kpmg.com enterprise email addresses are permitted.');
      return;
    }

    setError(null);
    setLoadingProvisioning(true);

    try {
      await loginWithGitHub({ email: enterpriseEmail });
      localStorage.setItem('github_enterprise_email', enterpriseEmail);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please try again.');
    } finally {
      setLoadingProvisioning(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center text-3xl shadow-lg mb-4">
            <i className="fa-brands fa-github"></i>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">GitHub Enterprise SSO</h2>
          <p className="mt-1 text-xs text-slate-500">{statusText}</p>
        </div>

        {!searchParams.get('code') && !error && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl text-xs leading-relaxed">
              <i className="fa-solid fa-circle-check text-blue-600 mr-2 text-sm"></i>
              <strong>KPMG Enterprise SSO Session Authenticated.</strong> Enter your KPMG enterprise email (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-blue-800">@kpmg.com</code>) to complete sign-in and provisioning.
            </div>

            <form onSubmit={handleJitProvision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  KPMG Enterprise Email
                </label>
                <input
                  type="email"
                  required
                  value={enterpriseEmail}
                  onChange={(e) => setEnterpriseEmail(e.target.value)}
                  placeholder="e.g. firstname.lastname@kpmg.com"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={provisioning}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
              >
                {provisioning ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket"></i>
                    <span>Sign In & Enter Application</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {searchParams.get('code') && !error && (
          <div className="flex flex-col items-center justify-center py-6 text-slate-600 space-y-3">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-600"></i>
            <span className="text-xs font-medium">Exchanging OAuth credentials & provisioning user account...</span>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-xs">
              <i className="fa-solid fa-triangle-exclamation mr-2"></i>
              {error}
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
