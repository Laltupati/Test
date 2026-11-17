import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest } from '../../authConfig';

// ── BEGIN AUTH-BYPASS (dev/local testing only — see README-AUTH-BYPASS.md) ──
// Set to true to skip Microsoft sign-in entirely on the client. Must be used
// together with the matching server-side bypass in server/entraAuth.js, or
// every API call below will still fail with 401.
// export const BYPASS_MSAL_AUTH = true;
export const BYPASS_MSAL_AUTH = false;
// ── END AUTH-BYPASS marker ──

// Wraps fetch() with a bearer token acquired from Entra ID via MSAL. The
// token is fetched fresh (silently, from cache, refreshing if needed) on
// every call rather than stored by this code — MSAL owns the token cache.
export function useAdminFetch() {
  const { instance, accounts } = useMsal();

  return useCallback(
    async (url, options = {}) => {
      // ── BEGIN AUTH-BYPASS: skip token acquisition, call the API with no Authorization header ──
      if (BYPASS_MSAL_AUTH) {
        return fetch(url, options);
      }
      // ── END AUTH-BYPASS ──

      const account = accounts[0];
      if (!account) throw new Error('Not signed in');

      let tokenResponse;
      try {
        tokenResponse = await instance.acquireTokenSilent({ ...loginRequest, account });
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          tokenResponse = await instance.acquireTokenPopup({ ...loginRequest, account });
        } else {
          throw err;
        }
      }

      return fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${tokenResponse.accessToken}` },
      });
    },
    [instance, accounts]
  );
}
