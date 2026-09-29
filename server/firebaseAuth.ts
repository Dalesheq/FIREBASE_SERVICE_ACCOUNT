import crypto from 'crypto';
import { Request } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  role?: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: VerifiedFirebaseUser;
  token?: string;
}

/**
 * Express middleware requiring a valid Firebase Bearer token and active user.
 */
export async function requireAuth(req: AuthenticatedRequest, res: any, next: any) {
  try {
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    }

    const verified = await verifyFirebaseToken(token);
    const active = await isUserActive(verified, token);
    if (!active) {
      return res.status(403).json({ error: 'Account deactivated. Access denied.' });
    }

    req.user = verified;
    req.token = token;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Authentication failed.' });
  }
}

// In-memory cache for Google's public certificates
let cachedCerts: Record<string, string> | null = null;
let certsExpiresAt = 0;

/**
 * Extracts Bearer token from Express request Authorization header.
 */
export function getAuthTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}

/**
 * Fetches and caches Google's public X.509 certificates for Firebase ID token verification.
 * Source: https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
 * This public endpoint requires NO API key, NO Google Cloud billing, and has no IP/domain restrictions.
 */
async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates: HTTP ${res.status}`);
  }

  // Parse cache-control header max-age (typically 6-12 hours)
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedCerts = (await res.json()) as Record<string, string>;
  certsExpiresAt = now + Math.max(120, maxAgeSeconds) * 1000;
  return cachedCerts;
}

/**
 * Authoritatively verifies a Firebase ID Token using Google's public cryptographic keys.
 * 
 * Cryptographic verification:
 * 1. Checks RS256 algorithm and extracts key ID (kid) from token header
 * 2. Matches kid against Google's public X.509 certificates
 * 3. Verifies RSA-SHA256 signature using Node.js built-in crypto module
 * 4. Validates project ID (aud), issuer (iss), subject (sub/uid), and expiry timestamps
 * 
 * This completely avoids the "API key not valid" error caused by missing, invalid, or
 * referrer-restricted API keys in Google Identity Toolkit lookup calls.
 */
export async function verifyFirebaseToken(idToken: string): Promise<VerifiedFirebaseUser> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('No authentication token provided.');
  }

  const projectId = 'gen-lang-client-0206733447';

  // Primary Method: Cryptographic RS256 verification using Google's public certificates
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT structure.');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (header.alg !== 'RS256') {
      throw new Error(`Unsupported token algorithm "${header.alg}". Expected RS256.`);
    }

    if (!header.kid) {
      throw new Error('Missing "kid" claim in token header.');
    }

    // Get public certificates from Google
    let certs = await getGooglePublicCerts();
    let cert = certs[header.kid];

    // If key not found in cache, clear cache and re-fetch once to handle key rotation
    if (!cert) {
      cachedCerts = null;
      certs = await getGooglePublicCerts();
      cert = certs[header.kid];
    }

    if (!cert) {
      throw new Error(`Token signed with unknown key ID "${header.kid}".`);
    }

    // Cryptographic signature check
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const isValidSignature = verifier.verify(cert, signatureB64, 'base64url');

    if (!isValidSignature) {
      throw new Error('Token cryptographic signature verification failed.');
    }

    // Claims validation per Firebase specification:
    // https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
    const nowSeconds = Math.floor(Date.now() / 1000);
    const clockSkewSeconds = 300; // 5 minute clock skew tolerance for network/system clock drift

    // Strict aud validation: Must equal "gen-lang-client-0206733447"
    if (payload.aud !== projectId) {
      throw new Error(
        `Token audience "${payload.aud}" does not match project ID "${projectId}".`
      );
    }

    // Strict iss validation: Must equal "https://securetoken.google.com/gen-lang-client-0206733447"
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      throw new Error(
        `Token issuer "${payload.iss}" does not match expected issuer "${expectedIssuer}".`
      );
    }

    // Strict sub validation: Must be a non-empty string corresponding to the user UID
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
      throw new Error('Token subject (sub) must be a non-empty string.');
    }

    // Strict exp validation: Required, must be a number, and must be in the future (accounting for clock skew)
    if (typeof payload.exp !== 'number' || isNaN(payload.exp)) {
      throw new Error('Token missing or invalid required "exp" (expiration time) claim.');
    }
    if (payload.exp < nowSeconds - clockSkewSeconds) {
      throw new Error('Firebase ID token has expired. Please refresh your session.');
    }

    // Strict iat validation: Required, must be a number, and must be in the past (accounting for clock skew)
    if (typeof payload.iat !== 'number' || isNaN(payload.iat)) {
      throw new Error('Token missing or invalid required "iat" (issued-at) claim.');
    }
    if (payload.iat > nowSeconds + clockSkewSeconds) {
      throw new Error('Token issued-at timestamp is in the future.');
    }

    // Strict auth_time validation: Required by Firebase ID token specification, must be a number, and must be in the past
    if (typeof payload.auth_time !== 'number' || isNaN(payload.auth_time)) {
      throw new Error('Token missing or invalid required "auth_time" (authentication time) claim.');
    }
    if (payload.auth_time > nowSeconds + clockSkewSeconds) {
      throw new Error('Token authentication time (auth_time) is in the future.');
    }

    return {
      uid: payload.sub,
      email: payload.email || '',
      role: payload.role,
      name: payload.name,
    };
  } catch (err: any) {
    // Pure fail-closed cryptographic token verification error; no fallback mechanisms
    throw new Error(`Authentication verification failed: ${err.message || 'Invalid token'}`);
  }
}

/**
 * Checks whether the verified user is an active user in the system.
 * Uses the authoritative 'active' boolean field on the Firestore user document (/users/{uid}).
 * Deactivated accounts (active === false) are strictly denied access.
 */
export async function isUserActive(user: VerifiedFirebaseUser, idToken: string): Promise<boolean> {
  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() ||
      firebaseConfig.projectId?.trim() ||
      'gen-lang-client-0206733447';
    const dbId =
      process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() ||
      firebaseConfig.firestoreDatabaseId?.trim() ||
      '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${user.uid}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (res.ok) {
      const docData = await res.json();
      const fields = docData?.fields || {};

      // Primary field: active (boolean)
      if (fields.active !== undefined && fields.active.booleanValue !== undefined) {
        return fields.active.booleanValue !== false;
      }

      // Backward compatibility fallback if isActive field was used
      if (fields.isActive !== undefined && fields.isActive.booleanValue !== undefined) {
        return fields.isActive.booleanValue !== false;
      }

      // If neither is explicitly false, default to active for newly synced profiles
      return true;
    } else {
      console.warn(
        `isUserActive: Firestore user lookup returned HTTP ${res.status} for uid: ${user.uid}`
      );
    }
  } catch (err) {
    console.warn('Could not check active status in Firestore:', err);
  }

  // If document not found or fetch fails, access is denied (fail closed)
  return false;
}

/**
 * Checks whether the verified user is an active SHEQ Admin.
 * The authoritative role MUST come from the Firestore user document (/users/{uid}).
 * Matches the application's actual role values ('admin' and 'actioner') case-insensitively.
 * Both role.toLowerCase() === 'admin' AND active !== false are strictly required.
 */
export async function isUserAdmin(user: VerifiedFirebaseUser, idToken: string): Promise<boolean> {
  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() ||
      firebaseConfig.projectId?.trim() ||
      'gen-lang-client-0206733447';
    const dbId =
      process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() ||
      firebaseConfig.firestoreDatabaseId?.trim() ||
      '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${user.uid}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (res.ok) {
      const docData = await res.json();
      const fields = docData?.fields || {};
      const rawRole = fields.role?.stringValue?.trim().toLowerCase();

      // Check active flag
      let isActive = true;
      if (fields.active !== undefined && fields.active.booleanValue !== undefined) {
        isActive = fields.active.booleanValue !== false;
      } else if (fields.isActive !== undefined && fields.isActive.booleanValue !== undefined) {
        isActive = fields.isActive.booleanValue !== false;
      }

      // Fail-closed: User must be active AND have role 'admin' in Firestore
      if (!isActive) {
        return false;
      }

      // Accepts 'admin' (or legacy 'super_admin') case-insensitively, strictly rejecting 'actioner'
      return rawRole === 'admin' || rawRole === 'super_admin';
    } else {
      console.warn(
        `isUserAdmin: Firestore user lookup returned HTTP ${res.status} for uid: ${user.uid}`
      );
    }
  } catch (err) {
    console.warn('Could not verify admin role in Firestore:', err);
  }

  // Fail closed: Never grant admin privilege on network or lookup failure
  return false;
}
