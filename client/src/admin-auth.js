import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// MSAL Browser v5 popup redirect bridge. This page is loaded only in the
// authentication popup and relays the authorization response to the opener.
broadcastResponseToMainFrame().catch((error) => {
  console.error('[entra-auth] Failed to relay popup authentication response.', error);
});
