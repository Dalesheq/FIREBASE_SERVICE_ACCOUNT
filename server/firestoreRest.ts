import firebaseConfig from '../firebase-applet-config.json';

/**
 * Strips surrounding quotes (single or double), whitespace, newlines, and carriage returns.
 */
function cleanEnvString(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Retrieves the sanitized Firestore configuration.
 */
export function getFirestoreConfig(): { projectId: string; databaseId: string } {
  const envProjectId = cleanEnvString(process.env.FIREBASE_PROJECT_ID);
  const cfgProjectId = cleanEnvString(firebaseConfig.projectId);
  const projectId = envProjectId || cfgProjectId || 'gen-lang-client-0206733447';

  const envDatabaseId = cleanEnvString(process.env.FIREBASE_FIRESTORE_DATABASE_ID);
  const cfgDatabaseId = cleanEnvString(firebaseConfig.firestoreDatabaseId);
  const databaseId = envDatabaseId || cfgDatabaseId || '(default)';

  return { projectId, databaseId };
}

/**
 * Returns the base URL for the Firestore REST API.
 */
export function getFirestoreBaseUrl(): string {
  const { projectId, databaseId } = getFirestoreConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

/**
 * Converts a primitive or nested JS value to Firestore REST API value format.
 */
export function toFirestoreValue(val: any): any {
  if (val === undefined) return undefined;
  if (val === null) return { nullValue: null };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)).filter((v) => v !== undefined),
      },
    };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: toFirestoreFields(val),
      },
    };
  }
  return { stringValue: String(val) };
}

/**
 * Converts a JS object to Firestore REST API fields format.
 */
export function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj || {})) {
    const converted = toFirestoreValue(val);
    if (converted !== undefined) {
      fields[key] = converted;
    }
  }
  return fields;
}

/**
 * Converts a single Firestore REST value to regular JS value.
 */
export function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    return fromFirestoreFields(val.mapValue.fields || {});
  }
  return val;
}

/**
 * Converts Firestore REST API fields to a regular JS object.
 */
export function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields || {})) {
    result[key] = fromFirestoreValue(val);
  }
  return result;
}

/**
 * Converts a raw Firestore REST Document object to a JS object with id attached.
 */
export function fromFirestoreDocument(doc: Record<string, any>): Record<string, any> {
  if (!doc) return {};
  const data = doc.fields ? fromFirestoreFields(doc.fields) : { ...doc };
  if (doc.name) {
    data._name = doc.name;
    const parts = doc.name.split('/');
    data.id = parts[parts.length - 1];
  }
  return data;
}

/**
 * Fetches a Firestore document using the authenticated user's ID token.
 */
export async function getFirestoreDoc(
  docPath: string,
  userToken: string
): Promise<Record<string, any> | null> {
  const url = `${getFirestoreBaseUrl()}/${docPath.replace(/^\/+/, '')}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore read error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const data = fromFirestoreFields(json.fields || {});
  data._name = json.name;
  if (json.name) {
    const parts = json.name.split('/');
    data.id = parts[parts.length - 1];
  }
  return data;
}

/**
 * Overloaded alias for getFirestoreDoc: supports (collection, docId, token) or (docPath, token).
 */
export async function getFirestoreDocument(
  param1: string,
  param2: string,
  param3?: string
): Promise<Record<string, any> | null> {
  if (param3 !== undefined) {
    return getFirestoreDoc(`${param1}/${param2}`, param3);
  }
  return getFirestoreDoc(param1, param2);
}

/**
 * Writes or overwrites a Firestore document using the authenticated user's ID token.
 */
export async function writeFirestoreDoc(
  docPath: string,
  data: Record<string, any>,
  userToken: string
): Promise<void> {
  const url = `${getFirestoreBaseUrl()}/${docPath.replace(/^\/+/, '')}`;
  const fields = toFirestoreFields(data);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore write error (${res.status}): ${errText}`);
  }
}

/**
 * Overloaded alias for writeFirestoreDoc: supports (collection, docId, data, token) or (docPath, data, token).
 */
export async function createFirestoreDocument(
  param1: string,
  param2: string | Record<string, any>,
  param3?: Record<string, any> | string,
  param4?: string
): Promise<void> {
  if (typeof param2 === 'string' && typeof param3 === 'object' && typeof param4 === 'string') {
    return writeFirestoreDoc(`${param1}/${param2}`, param3, param4);
  }
  if (typeof param2 === 'object' && typeof param3 === 'string') {
    return writeFirestoreDoc(param1, param2, param3);
  }
  throw new Error('Invalid arguments for createFirestoreDocument');
}

/**
 * Deletes a Firestore document using the authenticated user's ID token.
 */
export async function deleteFirestoreDoc(docPath: string, userToken: string): Promise<void> {
  const url = `${getFirestoreBaseUrl()}/${docPath.replace(/^\/+/, '')}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  if (res.status === 404) {
    return; // Already deleted
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore delete error (${res.status}): ${errText}`);
  }
}

/**
 * Overloaded alias for deleteFirestoreDoc: supports (collection, docId, token) or (docPath, token).
 */
export async function deleteFirestoreDocument(
  param1: string,
  param2: string,
  param3?: string
): Promise<void> {
  if (param3 !== undefined) {
    return deleteFirestoreDoc(`${param1}/${param2}`, param3);
  }
  return deleteFirestoreDoc(param1, param2);
}

/**
 * Appends a URL string to an array field in a document (like evidencePhotoUrls in actions).
 */
export async function appendToArrayField(
  docPath: string,
  arrayFieldName: string,
  valueToAppend: string,
  userToken: string
): Promise<void> {
  const existing = await getFirestoreDoc(docPath, userToken);
  if (!existing) return;

  const currentArray = Array.isArray(existing[arrayFieldName]) ? existing[arrayFieldName] : [];
  if (!currentArray.includes(valueToAppend)) {
    currentArray.push(valueToAppend);
  }

  await writeFirestoreDoc(docPath, { [arrayFieldName]: currentArray }, userToken);
}

/**
 * Removes a URL string from an array field in a document.
 */
export async function removeFromArrayField(
  docPath: string,
  arrayFieldName: string,
  valueToRemove: string,
  userToken: string
): Promise<void> {
  const existing = await getFirestoreDoc(docPath, userToken);
  if (!existing) return;

  const currentArray = Array.isArray(existing[arrayFieldName]) ? existing[arrayFieldName] : [];
  const updatedArray = currentArray.filter((item: string) => item !== valueToRemove);

  await writeFirestoreDoc(docPath, { [arrayFieldName]: updatedArray }, userToken);
}

/**
 * Queries documents in a collection by a single field equality filter.
 */
export async function queryDocsByField(
  collectionId: string,
  fieldName: string,
  fieldValue: any,
  userToken: string
): Promise<Array<Record<string, any>>> {
  const url = `${getFirestoreBaseUrl()}:runQuery`;

  let filterValue: any;
  if (fieldValue === null) {
    filterValue = { nullValue: null };
  } else if (typeof fieldValue === 'boolean') {
    filterValue = { booleanValue: fieldValue };
  } else if (typeof fieldValue === 'number') {
    filterValue = Number.isInteger(fieldValue)
      ? { integerValue: fieldValue.toString() }
      : { doubleValue: fieldValue };
  } else {
    filterValue = { stringValue: String(fieldValue) };
  }

  const structuredQuery = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: fieldName },
          op: 'EQUAL',
          value: filterValue,
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(structuredQuery),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Firestore query error (${res.status}): ${err}`);
  }

  const results = await res.json();
  const docs: Array<Record<string, any>> = [];

  for (const item of results) {
    if (item.document && item.document.fields) {
      const data = fromFirestoreFields(item.document.fields);
      const parts = item.document.name.split('/');
      data.id = parts[parts.length - 1];
      data._name = item.document.name;
      docs.push(data);
    }
  }

  return docs;
}

/**
 * Alias for queryDocsByField.
 */
export const queryFirestoreDocuments = queryDocsByField;

