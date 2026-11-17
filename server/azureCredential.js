const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');

function isAzureHosted() {
  return Boolean(
    process.env.WEBSITE_INSTANCE_ID ||
    process.env.WEBSITE_SITE_NAME ||
    process.env.IDENTITY_ENDPOINT ||
    process.env.MSI_ENDPOINT
  );
}

function scopeToResource(scope) {
  const value = String(scope || '').trim();
  return value.endsWith('/.default') ? value.slice(0, -'/.default'.length) : value;
}

/**
 * App Service exposes a local Managed Identity token endpoint through
 * IDENTITY_ENDPOINT + IDENTITY_HEADER.  Calling that endpoint directly avoids
 * Azure Identity SDK response-shape issues such as "Response had no expiresOn
 * property" while still using the App Service system-assigned identity.
 */
async function getAppServiceManagedIdentityToken(scope) {
  const endpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader = process.env.IDENTITY_HEADER;
  if (!endpoint || !identityHeader) {
    const err = new Error('App Service Managed Identity endpoint variables IDENTITY_ENDPOINT/IDENTITY_HEADER are unavailable.');
    err.code = 'MANAGED_IDENTITY_ENDPOINT_UNAVAILABLE';
    throw err;
  }

  const resource = scopeToResource(scope);
  const url = new URL(endpoint);
  url.searchParams.set('resource', resource);
  url.searchParams.set('api-version', '2019-08-01');

  // client_id is needed only for a user-assigned identity.  Leave it absent for
  // the system-assigned identity used by genaiplaygtest2.
  if (process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID) {
    url.searchParams.set('client_id', process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-IDENTITY-HEADER': identityHeader,
      Metadata: 'true',
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`App Service Managed Identity token endpoint failed (${response.status}): ${body.slice(0, 500)}`);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (_) {
    throw new Error('App Service Managed Identity token endpoint returned invalid JSON.');
  }

  const accessToken = payload.access_token || payload.accessToken || payload.token;
  if (!accessToken) {
    throw new Error(`App Service Managed Identity token response did not contain access_token. Fields returned: ${Object.keys(payload).join(', ')}`);
  }

  let expiresOnTimestamp = null;
  const expiresRaw = payload.expires_on ?? payload.expiresOn ?? payload.expires_in ?? payload.expiresIn;
  if (expiresRaw !== undefined && expiresRaw !== null) {
    const numeric = Number(expiresRaw);
    if (Number.isFinite(numeric)) {
      // expires_on is normally Unix seconds. expires_in is relative seconds.
      expiresOnTimestamp = payload.expires_in !== undefined || payload.expiresIn !== undefined
        ? Date.now() + numeric * 1000
        : numeric * 1000;
    } else {
      const parsed = Date.parse(String(expiresRaw));
      if (Number.isFinite(parsed)) expiresOnTimestamp = parsed;
    }
  }

  return { token: accessToken, expiresOnTimestamp };
}

function createAzureCredential() {
  if (isAzureHosted()) {
    const clientId = process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID;
    return clientId ? new ManagedIdentityCredential(clientId) : new ManagedIdentityCredential();
  }
  return new DefaultAzureCredential();
}

async function getAccessToken(scope, attempts = 2) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // Prefer the App Service local REST endpoint in Azure. This is the most
      // deterministic path for a system-assigned identity and avoids the
      // chained developer credentials entirely.
      if (process.env.IDENTITY_ENDPOINT && process.env.IDENTITY_HEADER) {
        return await getAppServiceManagedIdentityToken(scope);
      }

      const credential = createAzureCredential();
      const token = await credential.getToken(scope);
      if (!token?.token) throw new Error(`Unable to acquire Azure token for ${scope}`);
      return token;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }

  const endpointPresent = Boolean(process.env.IDENTITY_ENDPOINT);
  const headerPresent = Boolean(process.env.IDENTITY_HEADER);
  const wrapped = new Error(
    `Managed Identity authentication failed while requesting ${scope}. ` +
    `App Service identity endpoint: ${endpointPresent ? 'present' : 'missing'}; identity header: ${headerPresent ? 'present' : 'missing'}. ` +
    `Underlying error: ${lastError?.message || 'Unknown authentication error'}`
  );
  wrapped.code = 'AZURE_MANAGED_IDENTITY_AUTH_FAILED';
  wrapped.cause = lastError;
  throw wrapped;
}

function credentialDiagnostics() {
  return {
    azureHosted: isAzureHosted(),
    identityEndpointPresent: Boolean(process.env.IDENTITY_ENDPOINT),
    identityHeaderPresent: Boolean(process.env.IDENTITY_HEADER),
    identityMode: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID ? 'user-assigned' : 'system-assigned',
  };
}

module.exports = {
  createAzureCredential,
  getAccessToken,
  getAppServiceManagedIdentityToken,
  credentialDiagnostics,
  isAzureHosted,
};
