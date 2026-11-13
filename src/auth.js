import { useState, useEffect, jsx, jsxs } from "../vendor/react-runtime.js";
import { App } from "./app.js";
import { cloudEnabled, getSession, signIn, signUp } from "./cloud.js";

export function Root() {
  const [session, setSession] = useState(getSession);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("atitai-language") || "zh"; } catch { return "zh"; } });
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const id = lang === "id";
  useEffect(() => {
    const update = () => setSession(getSession());
    addEventListener("atitai-auth", update);
    addEventListener("storage", update);
    return () => { removeEventListener("atitai-auth", update); removeEventListener("storage", update); };
  }, []);
  useEffect(() => {
    if (session || !cloudEnabled) return;
    document.documentElement.lang = id ? "id" : "zh-CN";
    try { localStorage.setItem("atitai-language", lang); } catch {}
  }, [lang, session]);
  if (!cloudEnabled || session) return jsx(App, {}, session?.user?.id || "local");
  const submit = async (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      if (register) {
        const active = await signUp(String(fields.get("email")), String(fields.get("password")));
        if (!active) {
          setNotice(id ? "Akun dibuat. Konfirmasi email dari Supabase, lalu kembali dan masuk di sini." : "账号已创建。请确认 Supabase 邮件，然后返回此页面登录。");
          setRegister(false);
        }
      } else await signIn(String(fields.get("email")), String(fields.get("password")));
    } catch (e) {
      const message = e.message || "";
      setError(/invalid login/i.test(message) ? (id ? "Email atau kata sandi salah." : "邮箱或密码错误。")
        : /email not confirmed/i.test(message) ? (id ? "Konfirmasi email terlebih dahulu." : "请先确认邮箱。")
        : /fetch|network/i.test(message) ? (id ? "Koneksi gagal. Coba lagi." : "连接失败，请重试。") : message);
    } finally { setBusy(false); }
  };
  return jsx("main", { className: "authshell", children: jsxs("section", { className: "authcard", children: [
    jsxs("div", { className: "authbrand", children: [jsx("span", { className: "mark", children: "A" }), jsx("b", { children: "ZHEN ATITAI" })] }),
    jsxs("div", { className: "language", children: [
      jsx("button", { type: "button", className: !id ? "chosen" : "", onClick: () => setLang("zh"), children: "中文" }),
      jsx("button", { type: "button", className: id ? "chosen" : "", onClick: () => setLang("id"), children: "Indonesia" }),
    ] }),
    jsx("p", { className: "eyebrow", children: "RETAIL WORKSPACE · DILI" }),
    jsx("h1", { children: register ? (id ? "Buat akun toko" : "创建门店账号") : (id ? "Selamat datang kembali" : "欢迎回来") }),
    jsx("p", { className: "authnote", children: id ? "Stok, pelanggan, dan pembayaran tersimpan aman di akun Anda. Masuk dengan akun yang sama di perangkat lain." : "库存、客户及收款数据安全保存在您的账号中。使用同一账号即可跨设备访问。" }),
    error && jsx("div", { className: "alert", role: "alert", children: error }),
    notice && jsx("div", { className: "authnotice", role: "status", children: notice }),
    jsx("form", { onSubmit: submit, children: jsxs("fieldset", { disabled: busy, children: [
      jsxs("label", { children: [id ? "Email" : "邮箱", jsx("input", { name: "email", type: "email", autoComplete: "username", required: true, maxLength: 254 })] }),
      jsxs("label", { children: [id ? "Kata sandi" : "密码", jsx("input", { name: "password", type: "password", autoComplete: register ? "new-password" : "current-password", required: true, minLength: register ? 8 : undefined })] }),
      jsx("button", { className: "primary", disabled: busy, children: busy ? (id ? "Memproses…" : "正在处理…") : register ? (id ? "Buat akun" : "创建账号") : (id ? "Masuk" : "登录") }),
    ] }) }),
    jsx("button", { className: "link", disabled: busy, onClick: () => { setRegister(!register); setError(""); setNotice(""); }, children: register ? (id ? "Sudah punya akun? Masuk" : "已有账号？登录") : (id ? "Belum punya akun? Daftar" : "还没有账号？注册") }),
    jsx("small", { className: "authnote", children: id ? "Setiap akun memiliki data toko sendiri." : "每个账号拥有独立的门店数据。" }),
  ] }) });
}
