/**
 * Entra ID (Azure AD) access-token verification for the Admin tab.
 * ─────────────────────────────────────────────────────────────────
 * The client signs in with MSAL and calls the admin API with
 * `Authorization: Bearer <access_token>`. This module verifies that
 * token cryptographically against Microsoft's public signing keys
 * (JWKS) — it does NOT call Microsoft on every request, the keys are
 * fetched once and cached.
 *
 * Required environment variables:
 *   ENTRA_TENANT_ID   - your Entra tenant (directory) ID
 *   ENTRA_AUDIENCE    - the API app registration's Application ID URI
 *                       or client ID (must match what the SPA requested
 *                       a token "for" — see client/src/authConfig.js)
 *
 * Optional:
 *   ENTRA_ALLOWED_EMAILS - comma-separated allowlist (e.g.
 *                          "alice@kpmg.com,bob@kpmg.com"). Signing in
 *                          with Entra only proves the person is a valid
 *                          account in your tenant — it does NOT by
 *                          itself mean they should have admin access.
 *                          Without this, ANY user in the tenant who can
 *                          authenticate can use the Admin panel. Set
 *                          this (or use Entra App Roles / group claims —
 *                          see README) to actually restrict who's admin.
 *
 * See README.md for the one-time Azure Portal app registration steps.
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID;
const ENTRA_AUDIENCE = process.env.ENTRA_AUDIENCE;
const ENTRA_ALLOWED_EMAILS = (process.env.ENTRA_ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const configured = !!(ENTRA_TENANT_ID && ENTRA_AUDIENCE);
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[entra-auth] ENTRA_TENANT_ID / ENTRA_AUDIENCE not set — all /api/admin/* requests will be rejected until Entra ID is configured (see README.md).'
  );
}
if (configured && ENTRA_ALLOWED_EMAILS.length === 0) {
  // eslint-disable-next-line no-console
  console.warn(
    '[entra-auth] ENTRA_ALLOWED_EMAILS is not set — ANY user who can sign in to your Entra tenant will be able to use the Admin panel. Set ENTRA_ALLOWED_EMAILS to restrict this.'
  );
}

const client = configured
  ? jwksClient({
      jwksUri: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxAge: 12 * 60 * 60 * 1000, // 12h — Microsoft rotates signing keys infrequently
      rateLimit: true,
    })
  : null;

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.header?.kid) {
      return reject(new Error('Malformed token'));
    }
    getSigningKey(decoded.header.kid)
      .then((publicKey) => {
        jwt.verify(
          token,
          publicKey,
          {
            algorithms: ['RS256'],
            audience: ENTRA_AUDIENCE,
            issuer: [
              `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`,
              `https://sts.windows.net/${ENTRA_TENANT_ID}/`, // v1 issuer form, in case the API accepts v1 tokens
            ],
          },
          (err, payload) => (err ? reject(err) : resolve(payload))
        );
      })
      .catch(reject);
  });
}

// ── BEGIN AUTH-BYPASS (dev/local testing only — see README-AUTH-BYPASS.md) ──
// Set to true to skip Entra ID token verification entirely on the server.
// This must be flipped back to false before deploying anywhere reachable
// by anyone other than you — it removes ALL protection on /api/admin/*
// (owner emails, incident details, and the ability to trigger real health
// checks become fully public).
// const BYPASS_ENTRA_AUTH = true;
const BYPASS_ENTRA_AUTH = false;
// ── END AUTH-BYPASS marker (see matching marker below) ──

/** Express middleware: verifies the bearer token and enforces the email allowlist. */
async function requireEntraAuth(req, res, next) {
  // ── BEGIN AUTH-BYPASS: skip all token verification and let every request through ──
  if (BYPASS_ENTRA_AUTH) {
    req.adminUser = { email: 'bypass@local', name: 'Auth Bypass (dev only)', oid: null };
    return next();
  }
  // ── END AUTH-BYPASS ──

  if (!configured) {
    return res.status(500).json({ error: 'Admin panel is not configured (ENTRA_TENANT_ID/ENTRA_AUDIENCE unset).' });
  }

  const authHeader = req.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: `Invalid token: ${err.message}` });
  }

  const email = (payload.preferred_username || payload.upn || payload.email || '').toLowerCase();
  if (ENTRA_ALLOWED_EMAILS.length > 0 && !ENTRA_ALLOWED_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Account not authorized for the Admin panel' });
  }

  req.adminUser = { email, name: payload.name || null, oid: payload.oid || null };
  return next();
}

module.exports = { requireEntraAuth, allowedEmailsCount: ENTRA_ALLOWED_EMAILS.length };
