import React, { useEffect, useState } from 'react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { loadEntraConfig } from '../authConfig';
import AdminUseCase2 from './AdminUseCase2';

// Admin-only authentication boundary. Nothing outside this component depends on
// MSAL or the Admin Entra configuration.
export default function Admin() {
  const [msalInstance, setMsalInstance] = useState(null);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const msalConfig = await loadEntraConfig();
        const instance = new PublicClientApplication(msalConfig);
        await instance.initialize();

        if (!instance.getActiveAccount() && instance.getAllAccounts().length > 0) {
          instance.setActiveAccount(instance.getAllAccounts()[0]);
        }
        instance.addEventCallback((event) => {
          if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
            instance.setActiveAccount(event.payload.account);
          }
        });

        if (!cancelled) setMsalInstance(instance);
      } catch (err) {
        console.error('[admin-auth] Admin Entra configuration unavailable:', err);
        if (!cancelled) setConfigError(err?.message || 'Admin Entra authentication is not configured.');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (configError) {
    return (
      <div className="ad-signin-screen">
        <h2>GenAI Playground Admin Panel</h2>
        <p>Admin sign-in is not configured for this environment.</p>
        <div style={{ marginTop: 10, color: 'var(--red-s)', fontSize: 12 }}>{configError}</div>
      </div>
    );
  }

  if (!msalInstance) {
    return (
      <div className="ad-signin-screen">
        <h2>GenAI Playground Admin Panel</h2>
        <p>Loading secure Admin sign-in…</p>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AdminUseCase2 />
    </MsalProvider>
  );
}
