import firebaseConfig from '../../firebase-applet-config.json';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const DOCUMENTS_BASE = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
  PROJECT_ID
)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;
const DOC_RESOURCE_PREFIX = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export function encodeFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { doubleValue: 0 };
    if (Number.isInteger(val) && Math.abs(val) <= Number.MAX_SAFE_INTEGER) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((item) => item !== undefined).map((item) => encodeFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return fields;
}

export function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('arrayValue' in val) {
    const values = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return values.map((v: any) => decodeFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export function decodeFirestoreDoc<T = Record<string, any>>(docJson: any): (T & { id: string }) | null {
  if (!docJson?.name) return null;
  const docId = String(docJson.name).split('/').pop() || '';
  const fields = docJson.fields || {};
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    data[k] = decodeFirestoreValue(v);
  }
  return { ...(data as T), id: data.id || docId };
}

function encodePathSegments(segments: string[]): string {
  return segments.map((s) => encodeURIComponent(s)).join('/');
}

async function parseFirestoreError(res: globalThis.Response): Promise<Error> {
  const payload = await res.json().catch(() => ({}));
  const rawMsg =
    (Array.isArray(payload) ? payload[0]?.error?.message : payload?.error?.message) ||
    `Firestore request failed (${res.status})`;
  const err = new Error(rawMsg) as Error & { status?: number };
  err.status = res.status;
  return err;
}

export async function restGetDocWithMeta<T = Record<string, any>>(
  pathSegments: string[],
  idToken?: string
): Promise<{ data: T & { id: string }; updateTime?: string } | null> {
  const url = `${DOCUMENTS_BASE}/${encodePathSegments(pathSegments)}`;
  const headers: Record<string, string> = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 404) return null;
  if (!res.ok) throw await parseFirestoreError(res);
  const json = await res.json();
  const data = decodeFirestoreDoc<T>(json);
  if (!data) return null;
  return { data, updateTime: json.updateTime ? String(json.updateTime) : undefined };
}

export async function restGetDoc<T = Record<string, any>>(
  pathSegments: string[],
  idToken?: string
): Promise<(T & { id: string }) | null> {
  const res = await restGetDocWithMeta<T>(pathSegments, idToken);
  return res ? res.data : null;
}

export async function restListCollection<T = Record<string, any>>(
  collectionSegments: string[],
  idToken?: string
): Promise<(T & { id: string })[]> {
  const out: (T & { id: string })[] = [];
  let pageToken = '';
  const colPath = encodePathSegments(collectionSegments);

  do {
    const qs = new URLSearchParams({ pageSize: '300' });
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `${DOCUMENTS_BASE}/${colPath}?${qs.toString()}`;
    const headers: Record<string, string> = {};
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 404) return [];
    if (!res.ok) throw await parseFirestoreError(res);
    const json = (await res.json()) as { documents?: any[]; nextPageToken?: string };
    for (const d of json.documents || []) {
      const decoded = decodeFirestoreDoc<T>(d);
      if (decoded) out.push(decoded);
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return out;
}

export async function restQueryWhereEqual<T = Record<string, any>>(
  collectionId: string,
  fieldPath: string,
  value: string,
  idToken?: string,
  options?: { parentSegments?: string[]; limitCount?: number }
): Promise<(T & { id: string })[]> {
  const parentSuffix =
    options?.parentSegments && options.parentSegments.length > 0
      ? `/${encodePathSegments(options.parentSegments)}`
      : '';
  const url = `${DOCUMENTS_BASE}${parentSuffix}:runQuery`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const structuredQuery: Record<string, any> = {
    from: [{ collectionId }],
    where: {
      fieldFilter: {
        field: { fieldPath },
        op: 'EQUAL',
        value: encodeFirestoreValue(value),
      },
    },
  };
  if (options?.limitCount) {
    structuredQuery.limit = options.limitCount;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw await parseFirestoreError(res);
  const rows = (await res.json()) as { document?: any }[];
  const out: (T & { id: string })[] = [];
  for (const row of rows || []) {
    if (row.document) {
      const decoded = decodeFirestoreDoc<T>(row.document);
      if (decoded) out.push(decoded);
    }
  }
  return out;
}

export type RestWriteOp =
  | {
      type: 'create' | 'set' | 'update';
      pathSegments: string[];
      data: Record<string, unknown>;
      merge?: boolean;
      expectedUpdateTime?: string;
    }
  | {
      type: 'delete';
      pathSegments: string[];
    };

export async function restCommitWrites(ops: RestWriteOp[], idToken?: string): Promise<void> {
  if (ops.length === 0) return;

  const writes = ops.map((op) => {
    const docName = `${DOC_RESOURCE_PREFIX}/${op.pathSegments.join('/')}`;
    if (op.type === 'delete') {
      return { delete: docName };
    }
    const cleanData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(op.data)) {
      if (v !== undefined) cleanData[k] = v;
    }
    const fields = encodeFirestoreFields(cleanData);
    const writeObj: Record<string, any> = {
      update: { name: docName, fields },
    };
    if (op.type === 'create') {
      writeObj.currentDocument = { exists: false };
    } else if (op.type === 'update') {
      writeObj.currentDocument = op.expectedUpdateTime
        ? { updateTime: op.expectedUpdateTime }
        : { exists: true };
      writeObj.updateMask = { fieldPaths: Object.keys(cleanData) };
    } else if (op.type === 'set' && op.merge) {
      writeObj.updateMask = { fieldPaths: Object.keys(cleanData) };
    }
    return writeObj;
  });

  const url = `${DOCUMENTS_BASE}:commit`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw await parseFirestoreError(res);
}

export async function restSetDoc(
  pathSegments: string[],
  data: Record<string, unknown>,
  idToken?: string,
  merge = false
): Promise<void> {
  return restCommitWrites([{ type: 'set', pathSegments, data, merge }], idToken);
}

export async function restUpdateDoc(
  pathSegments: string[],
  data: Record<string, unknown>,
  idToken?: string
): Promise<void> {
  return restCommitWrites([{ type: 'update', pathSegments, data }], idToken);
}
