/**
 * Microsoft Entra ID configuration for the Admin tab.
 *
 * Production uses runtime configuration from GET /api/auth/config so the same
 * frontend artifact can be deployed to TEST and PROD. Each App Service supplies
 * its own ENTRA_* application settings. VITE_* values remain as a local/dev
 * fallback only.
 */

export const loginRequest = { scopes: [] };

export async function loadEntraConfig() {
  let runtime = {};
  try {
    const response = await fetch('/api/auth/config', { cache: 'no-store' });
    if (response.ok) runtime = await response.json();
  } catch (err) {
    console.warn('[entra-auth] Runtime auth configuration could not be loaded; using build-time fallback.', err);
  }

  const tenantId = runtime.tenantId || import.meta.env.VITE_ENTRA_TENANT_ID || '';
  const clientId = runtime.clientId || import.meta.env.VITE_ENTRA_CLIENT_ID || '';
  const apiScope = runtime.apiScope || import.meta.env.VITE_ENTRA_API_SCOPE || '';
  // loginPopup runs in a child window. Use the dedicated Vite-built MSAL v5
  // redirect-bridge page so the popup can relay the authorization response to
  // the parent without booting the full Playground application.
  const redirectUri = `${window.location.origin}/admin-auth.html`;

  if (!tenantId || !clientId || !apiScope) {
    throw new Error(
      'Admin Entra authentication is incomplete for this environment. Configure the tenant ID, client ID and API scope in this App Service.'
    );
  }

  // Keep the imported object reference stable for AdminUseCase2/adminAuth.
  loginRequest.scopes = [apiScope];

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  };
}
