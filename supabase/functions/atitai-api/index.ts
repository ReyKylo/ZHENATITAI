import { applyAction, emptyData } from "../../../src/core.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (payload: unknown, status = 200) => Response.json(payload, {
  status, headers: { ...cors, "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "操作无效" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const key = publishableKeys ? JSON.parse(publishableKeys).default : Deno.env.get("SUPABASE_ANON_KEY")!;
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "请先登录" }, 401);
    // Validate the user server-side; use their JWT for every database operation so RLS applies.
    const headers = { apikey: key, Authorization: authorization, "Content-Type": "application/json" };
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers });
    if (!userResponse.ok) return json({ error: "请先登录" }, 401);
    const user = await userResponse.json();
    const endpoint = `${url}/rest/v1/atitai_records?owner=eq.${encodeURIComponent(user.id)}`;
    const snapshotResponse = await fetch(`${endpoint}&select=data,version`, { headers });
    if (!snapshotResponse.ok) return json({ error: "云端数据暂不可用，请稍后重试" }, 503);
    const [row] = await snapshotResponse.json();
    const current = row || { data: emptyData(), version: 0 };
    if (req.method === "GET") return json(current);
    if (Number(req.headers.get("content-length") || 0) > 4_000_000) return json({ error: "数据量过大，请联系管理员" }, 413);
    const body = await req.text();
    if (body.length > 4_000_000) return json({ error: "数据量过大，请联系管理员" }, 413);
    const { action, item, version } = JSON.parse(body);
    if (version !== current.version) return json({ error: "数据已更新，请刷新后重试" }, 409);
    let data;
    try { data = applyAction(current.data, action, item); }
    catch (error) { return json({ error: (error as Error).message }, 400); }
    const next = { data, version: version + 1, updated_at: new Date().toISOString() };
    const result = await fetch(row ? `${endpoint}&version=eq.${version}` : `${url}/rest/v1/atitai_records`, {
      method: row ? "PATCH" : "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(row ? next : { ...next, owner: user.id }),
    });
    if (result.status === 409) return json({ error: "数据已更新，请刷新后重试" }, 409);
    if (!result.ok) return json({ error: "保存失败" }, 500);
    const rows = await result.json();
    if (rows.length !== 1) return json({ error: "数据已更新，请刷新后重试" }, 409);
    return json({ data: rows[0].data, version: rows[0].version });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "操作无效" }, 400);
    return json({ error: "云端数据暂不可用，请稍后重试" }, 503);
  }
});
