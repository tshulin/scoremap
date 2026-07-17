// Backend API client. The Grademax backend (this repo's `back` branch) scrapes
// StudentVUE server-side; the browser only ever talks to it. In dev the Vite
// proxy forwards /api to the backend on this machine (vite.config.js), so
// requests are same-origin and every response header is readable.
//
// Errors arrive as { error: { code, message } } — codes from the backend's
// PortalErrorCode enum (AUTH_FAILED, SESSION_EXPIRED, NO_ACTIVE_GRADING_PERIOD,
// PARSE_FAILED, PORTAL_UNAVAILABLE, RATE_LIMITED, VALIDATION, INTERNAL).

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const TOKEN_KEY = 'grademax-token';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasToken() {
  return !!getToken();
}

function setToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function apiErrorFrom(res) {
  let code = 'INTERNAL';
  let message = `Request failed (${res.status}).`;
  try {
    const body = await res.json();
    if (body && body.error) {
      code = body.error.code || code;
      message = body.error.message || message;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(code, message, res.status);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers['Authorization'] = `Bearer ${getToken() || ''}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await apiErrorFrom(res);
  return res;
}

// ---- auth ----

export async function login({ domain, username, password }) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { domain, username, password },
    auth: false,
  });
  const { token, student } = await res.json();
  setToken(token);
  return student;
}

export async function logout() {
  try {
    if (hasToken()) await request('/auth/session', { method: 'DELETE' });
  } finally {
    clearToken();
  }
}

// ---- resources ----

export async function getStudent() {
  return (await request('/student')).json();
}

export async function getDocuments() {
  return (await request('/documents')).json();
}

export async function getAttendance() {
  return (await request('/attendance')).json();
}

// Returns { gradebook, placeholder }. `placeholder` is true when the backend
// served its sample gradebook (PLACEHOLDER_DATA fallback) — the UI must say so.
export async function getGradebook() {
  const res = await request('/gradebook');
  return {
    gradebook: await res.json(),
    placeholder: res.headers.get('X-Grademax-Placeholder') === 'true',
  };
}

export async function downloadDocument(docToken) {
  const res = await request(`/documents/${encodeURIComponent(docToken)}`);
  const disposition = res.headers.get('Content-Disposition') || '';
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plain = disposition.match(/filename="([^"]+)"/i);
  const fileName = utf8 ? decodeURIComponent(utf8[1]) : plain ? plain[1] : 'document';
  return { blob: await res.blob(), fileName };
}
