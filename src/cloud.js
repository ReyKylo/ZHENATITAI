import { config } from "./config.js";

export const cloudEnabled = Boolean(config.url && config.publishableKey);
const sessionKey = "zhen-atitai-auth-v1";
let refreshPromise;
const emitAuth = () => globalThis.dispatchEvent?.(new Event("atitai-auth"));
export function getSession() {
  try { return JSON.parse(localStorage.getItem(sessionKey) || "null"); }
  catch { return null; }
}
function storeSession(session) {
  if (session?.access_token) {
    const value = { ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in };
    localStorage.setItem(sessionKey, JSON.stringify(value));
  } else localStorage.removeItem(sessionKey);
  emitAuth();
}
async function authRequest(path, body, token) {
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: config.publishableKey, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(payload.msg || payload.error_description || payload.message || "Authentication failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}
export async function signIn(email, password) {
  const session = await authRequest("token?grant_type=password", { email: email.trim(), password });
  storeSession(session);
}
export async function signUp(email, password) {
  const result = await authRequest("signup", { email: email.trim(), password });
  if (result.access_token) storeSession(result);
  return Boolean(result.access_token);
}
export async function signOut() {
  const session = getSession();
  try { if (session) await authRequest("logout?scope=local", null, session.access_token); }
  finally { storeSession(null); }
}
export async function accessToken() {
  const initial = getSession();
  if (!initial) throw Error("请先登录");
  if (initial.expires_at > Date.now() / 1000 + 60) return initial.access_token;
  if (!refreshPromise) {
    const refresh = async () => {
      const session = getSession();
      if (!session) throw Error("请先登录");
      if (session.expires_at > Date.now() / 1000 + 60) return session.access_token;
      try {
        const next = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
        storeSession(next);
        return next.access_token;
      } catch (error) {
        if (error.status >= 400 && error.status < 500) storeSession(null);
        throw error;
      }
    };
    refreshPromise = (globalThis.navigator?.locks ? navigator.locks.request(`${sessionKey}:refresh`, refresh) : refresh())
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
export async function cloudRequest(_url, options = {}) {
  let token;
  try { token = await accessToken(); }
  catch (error) {
    return Response.json({ error: getSession() ? "云端数据暂不可用，请稍后重试" : "请先登录" }, { status: getSession() ? 503 : 401 });
  }
  const response = await fetch(`${config.url}/functions/v1/atitai-api`, {
    method: options.method || "GET", cache: "no-store",
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: options.body,
  });
  if (response.status === 401) storeSession(null);
  return response;
}
