import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_BUCKET_NAME = 'sheq-photos';

let supabaseClient: SupabaseClient | null = null;
let bucketChecked = false;

/**
 * Strips surrounding quotes (single or double), whitespace, newlines, and carriage returns.
 */
export function cleanEnvSecret(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Normalizes Supabase URL to ensure it is a valid, clean HTTPS endpoint.
 * Handles:
 * - Surrounding double or single quotes: '"https://edwkbmvhnsjhquepqvue.supabase.co"'
 * - Supabase Dashboard URLs: 'https://supabase.com/dashboard/project/edwkbmvhnsjhquepqvue'
 * - Trailing slashes: 'https://edwkbmvhnsjhquepqvue.supabase.co/'
 * - API subpaths: 'https://edwkbmvhnsjhquepqvue.supabase.co/storage/v1'
 * - Bare project references: 'edwkbmvhnsjhquepqvue' or '"edwkbmvhnsjhquepqvue"'
 * - Domains without protocol: 'edwkbmvhnsjhquepqvue.supabase.co'
 */
export function formatSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '').trim();

  // If user pasted dashboard URL like https://supabase.com/dashboard/project/<project-ref>
  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Strip trailing slashes and common API subpaths
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/storage\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');

  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    if (/^[a-z0-9_-]+$/i.test(cleaned)) {
      cleaned = `https://${cleaned}.supabase.co`;
    } else {
      cleaned = `https://${cleaned}`;
    }
  }

  try {
    const parsed = new URL(cleaned);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return cleaned;
  }
}

/**
 * Checks whether Supabase Storage environment variables are present and explicitly enabled.
 */
export function isSupabaseConfigured(): boolean {
  if (process.env.ENABLE_SUPABASE_STORAGE !== 'true') {
    return false;
  }
  const url = cleanEnvSecret(process.env.SUPABASE_URL);
  const key = cleanEnvSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return Boolean(url && key);
}

/**
 * Lazily initializes and returns the Supabase Admin client with service-role privileges.
 * NEVER exposes the service-role key to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseClient) {
    const rawUrl = process.env.SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!rawUrl || !rawKey) {
      throw new Error(
        'Supabase Storage is not configured. Please define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your server environment variables.'
      );
    }

    const supabaseUrl = formatSupabaseUrl(rawUrl);
    const serviceRoleKey = cleanEnvSecret(rawKey);

    if (!supabaseUrl) {
      throw new Error('Supabase Storage URL is invalid or empty after formatting.');
    }

    if (!serviceRoleKey) {
      throw new Error('Supabase Service Role Key is empty after sanitization.');
    }

    // Diagnostic log without secrets
    console.log(
      `[Supabase] Initializing storage client for endpoint: ${supabaseUrl} (Key length: ${serviceRoleKey.length}, Key JWT format: ${serviceRoleKey.startsWith('eyJ')})`
    );

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * Ensures that the private storage bucket exists in Supabase.
 */
export async function ensureBucketExists(): Promise<void> {
  if (bucketChecked) return;
  if (!isSupabaseConfigured()) return;

  try {
    const client = getSupabaseAdmin();
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    if (listError) {
      const cause = (listError as any).originalError?.cause;
      console.warn(
        '[Supabase Storage] Could not list buckets:',
        listError.message,
        cause ? `(Cause: ${cause.message || cause.code || cause})` : ''
      );
      return;
    }

    const exists = buckets?.some((b) => b.name === SUPABASE_BUCKET_NAME);
    if (!exists) {
      console.log(`[Supabase Storage] Ensuring private bucket "${SUPABASE_BUCKET_NAME}" exists...`);
      const { error: createError } = await client.storage.createBucket(SUPABASE_BUCKET_NAME, {
        public: false, // MANDATORY: strictly private
        fileSizeLimit: 10 * 1024 * 1024, // 10 MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (createError) {
        if (!createError.message?.toLowerCase().includes('already exists')) {
          console.warn(
            `[Supabase Storage] Note on creating bucket "${SUPABASE_BUCKET_NAME}":`,
            createError.message
          );
        }
      } else {
        console.log(`[Supabase Storage] Successfully created private bucket "${SUPABASE_BUCKET_NAME}".`);
      }
    }
    bucketChecked = true;
  } catch (err: any) {
    console.warn('[Supabase Storage] Bucket verification warning:', err?.message || err);
  }
}

/**
 * Uploads a validated photograph buffer to the private Supabase bucket.
 */
export async function uploadPhotoBuffer(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await ensureBucketExists();
  const client = getSupabaseAdmin();

  const { error } = await client.storage.from(SUPABASE_BUCKET_NAME).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    const originalError = (error as any).originalError;
    const cause = originalError?.cause || (error as any).cause;
    const causeMsg = cause ? (cause.message || cause.code || String(cause)) : '';
    const status = (error as any).status || (error as any).statusCode;

    console.error('[Supabase Storage Upload Error]', {
      message: error.message,
      cause: causeMsg,
      code: cause?.code,
      status,
      targetPath: storagePath,
      bucket: SUPABASE_BUCKET_NAME,
    });

    let extraHint = '';
    if (error.message.includes('fetch failed')) {
      const rawUrl = process.env.SUPABASE_URL || '';
      const formatted = formatSupabaseUrl(rawUrl);
      extraHint = ` - Network connection to Supabase (${formatted}) failed. Cause: ${causeMsg || 'Unreachable host or DNS error'}. Please verify that the Supabase project is active and unpaused in your Supabase dashboard.`;
    }

    throw new Error(`Supabase Storage upload failed: ${error.message}${extraHint}`);
  }
}

/**
 * Generates a short-lived signed URL for an authorized user.
 * Default expiration: 3600 seconds (1 hour).
 */
export async function createSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getSupabaseAdmin();

  const { data, error } = await client.storage
    .from(SUPABASE_BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    const originalError = (error as any)?.originalError;
    const cause = originalError?.cause || (error as any)?.cause;
    const causeMsg = cause ? (cause.message || cause.code || String(cause)) : '';
    console.error('[Supabase Signed URL Error]', {
      message: error?.message,
      cause: causeMsg,
      storagePath,
    });
    throw new Error(
      `Failed to generate signed URL: ${error?.message || 'Unknown error'}${causeMsg ? ' (' + causeMsg + ')' : ''}`
    );
  }

  return data.signedUrl;
}

/**
 * Deletes a single photograph object from Supabase Storage.
 */
export async function deletePhotoObject(storagePath: string): Promise<void> {
  const client = getSupabaseAdmin();

  const { error } = await client.storage.from(SUPABASE_BUCKET_NAME).remove([storagePath]);

  if (error) {
    const originalError = (error as any)?.originalError;
    const cause = originalError?.cause || (error as any)?.cause;
    console.error('[Supabase Delete Error]', {
      message: error.message,
      cause: cause?.message || cause?.code,
      storagePath,
    });
    throw new Error(`Failed to delete object "${storagePath}" from Supabase Storage: ${error.message}`);
  }
}

/**
 * Deletes multiple photograph objects from Supabase Storage in batch.
 */
export async function deletePhotoObjects(storagePaths: string[]): Promise<void> {
  if (!storagePaths || storagePaths.length === 0) return;
  const client = getSupabaseAdmin();

  const { error } = await client.storage.from(SUPABASE_BUCKET_NAME).remove(storagePaths);

  if (error) {
    throw new Error(`Failed to delete objects from Supabase Storage: ${error.message}`);
  }
}

/**
 * Downloads a photograph binary directly from the private Supabase Storage bucket.
 * Uses server-side service-role privileges.
 */
export async function downloadPhotoBuffer(
  storagePath: string
): Promise<{ buffer: Buffer; contentType?: string } | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Cannot download photo: Supabase Storage is not configured.');
    return null;
  }

  try {
    const client = getSupabaseAdmin();
    const { data, error } = await client.storage.from(SUPABASE_BUCKET_NAME).download(storagePath);

    if (error || !data) {
      console.warn(`Could not download photo "${storagePath}" from Supabase:`, error?.message);
      return null;
    }

    const arrayBuf = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuf),
      contentType: data.type || undefined,
    };
  } catch (err: any) {
    console.warn(`Error downloading photo buffer "${storagePath}":`, err?.message || err);
    return null;
  }
}

/**
 * Performs a safe, non-sensitive diagnostic check of Supabase connectivity and bucket status.
 * NEVER returns or exposes secrets.
 */
export async function checkSupabaseDiagnostics(): Promise<{
  configured: boolean;
  sanitizedUrl: string;
  hasServiceRoleKey: boolean;
  serviceRoleKeyLength: number;
  isJwtFormat: boolean;
  networkConnectivity: {
    reachable: boolean;
    pingStatus?: number;
    error?: string;
    cause?: string;
  };
  storageApi: {
    canListBuckets: boolean;
    bucketCount?: number;
    bucketNames?: string[];
    sheqPhotosBucketExists?: boolean;
    error?: string;
    cause?: string;
  };
}> {
  const rawUrl = process.env.SUPABASE_URL || '';
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const sanitizedUrl = formatSupabaseUrl(rawUrl);
  const sanitizedKey = cleanEnvSecret(rawKey);

  const configured = Boolean(sanitizedUrl && sanitizedKey);
  const isJwtFormat = sanitizedKey.startsWith('eyJ') && sanitizedKey.split('.').length === 3;

  let pingResult: any = { reachable: false };
  if (sanitizedUrl) {
    try {
      const res = await fetch(`${sanitizedUrl}/storage/v1/status`, { method: 'GET' });
      pingResult = { reachable: true, pingStatus: res.status };
    } catch (err: any) {
      pingResult = {
        reachable: false,
        error: err.message,
        cause: err.cause?.message || err.cause?.code || String(err.cause || ''),
      };
    }
  }

  let storageApiResult: any = { canListBuckets: false };
  if (configured) {
    try {
      const client = getSupabaseAdmin();
      const { data: buckets, error } = await client.storage.listBuckets();
      if (error) {
        const originalErr = (error as any).originalError;
        const cause = originalErr?.cause || (error as any).cause;
        storageApiResult = {
          canListBuckets: false,
          error: error.message,
          cause: cause?.message || cause?.code || String(cause || ''),
        };
      } else {
        const names = (buckets || []).map((b) => b.name);
        storageApiResult = {
          canListBuckets: true,
          bucketCount: names.length,
          bucketNames: names,
          sheqPhotosBucketExists: names.includes(SUPABASE_BUCKET_NAME),
        };
      }
    } catch (apiErr: any) {
      storageApiResult = {
        canListBuckets: false,
        error: apiErr.message,
      };
    }
  }

  return {
    configured,
    sanitizedUrl,
    hasServiceRoleKey: Boolean(sanitizedKey),
    serviceRoleKeyLength: sanitizedKey.length,
    isJwtFormat,
    networkConnectivity: pingResult,
    storageApi: storageApiResult,
  };
}

