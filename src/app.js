import { useState, useEffect, useRef, jsx, jsxs, Fragment } from "../vendor/react-runtime.js";
import { tr, errorText, businessText } from "./i18n.js";
import { localRequest, downloadBackup } from "./storage.js";
import { cloudEnabled, signOut } from "./cloud.js";

var tabs = ["overview", "inventory", "customers", "sales"];
var today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dili", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
var afterDays = (d) => new Date(Date.parse(today() + "T00:00:00Z") + d * 864e5).toISOString().slice(0, 10);
var models = ["X", "XR", "XS", "11", "11 Pro", "11 Pro Max", "12", "12 mini", "12 Pro", "12 Pro Max", "13", "13 mini", "13 Pro", "13 Pro Max", "14", "14 Pro", "14 Pro Max", "15", "15 Pro", "15 Pro Max", "16", "16 Pro", "16 Pro Max", "17", "17 Pro", "17 Pro Max"].map((x) => "iPhone " + x);
function App() {
  const [lang, SL] = useState("zh"), [ready, SR] = useState(false), [data, SD] = useState({ phones: [], customers: [], sales: [], payments: [] }), [version, SV] = useState(0), [tab, ST] = useState(0), [query, SQ] = useState(""), [filter, SF] = useState("all"), [modelFilter, SMF] = useState("all"), [dueFilter, SDF] = useState("overdue"), [modal, SM] = useState(""), [form, SForm] = useState({}), [error, SE] = useState(""), [busy, SB] = useState(false), [loading, SLoading] = useState(true), [loaded, SLoaded] = useState(false), [toast, SToast] = useState(false);
  const dialog = useRef(null), previousFocus = useRef(null);
  const t = (k) => tr(lang, k), bt = (v) => businessText(lang, v);
  const money = (n) => new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "id-ID", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
  const date = (s) => s ? new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(s + "T00:00:00Z")) : "—";
  const load = async () => {
    SLoading(true);
    try {
      const r = await localRequest("/api/data", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        throw Error(j.error);
      }
      SD(j.data);
      SV(j.version);
      SLoaded(true);
      SE("");
    } catch (e) {
      SE(e.message || "保存失败");
    } finally {
      SLoading(false);
    }
  };
  useEffect(() => {
    try {
      const l = localStorage.getItem("atitai-language");
      if (l === "id" || l === "zh") SL(l);
    } catch {
    }
    SR(true);
    load();
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("atitai-language", lang);
      } catch {
      }
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "id";
      document.title = lang === "zh" ? "ZHEN ATITAI | 库存与客户" : "ZHEN ATITAI | Stok & Pelanggan";
    }
  }, [lang, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => SToast(false), 4e3);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const el = dialog.current;
    el?.querySelector("input:not([type=hidden]),select,button")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) SM("");
      if (e.key === "Tab" && el) {
        const els = [...el.querySelectorAll("button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),a[href]")];
        const first = els[0], last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = old;
      previousFocus.current?.focus();
    };
  }, [modal, busy]);
  const paid = (s) => Math.round(data.payments.filter((p) => p.saleId === s.id).reduce((n, p) => n + p.amount, 0) * 100) / 100;
  const balance = (s) => Math.max(0, Math.round((s.total - paid(s)) * 100) / 100);
  const stock = data.phones.filter((p) => p.status === "在库"), pending = data.sales.filter((s) => balance(s) > 0), overdue = pending.filter((s) => s.due && s.due < today()), dueToday = pending.filter((s) => s.due === today()), upcoming = pending.filter((s) => s.due > today() && s.due <= afterDays(7));
  const outstanding = pending.reduce((n, s) => n + balance(s), 0);
  const open = (type, item = {}) => {
    previousFocus.current = document.activeElement;
    SE("");
    if (type === "sale") {
      const p = stock.find((p2) => p2.id === item.phoneId) || stock[0];
      SForm({ phoneId: p?.id || "", customerId: item.customerId || data.customers[0]?.id || "", mode: "零售", date: today(), total: p?.price ?? "", deposit: p?.price ?? "", months: 1, due: "", ...item });
    } else if (type === "phone") {
      SForm({ model: "iPhone 11", storage: "128GB", grade: "A", ...item });
    } else if (type === "customer") {
      SForm({ type: "零售", ...item });
    } else if (type === "payment") {
      SForm({ date: today(), ...item });
    } else SForm(item);
    SM(type);
  };
  const change = (name, value) => SForm((old) => {
    const n = { ...old, [name]: value };
    if (modal === "sale") {
      if (name === "phoneId") {
        const p = stock.find((p2) => p2.id === value);
        n.total = p?.price ?? "";
        n.deposit = old.mode === "分期" ? "" : n.total;
      }
      if (name === "mode") {
        n.deposit = value === "分期" ? "" : old.total;
        n.months = value === "分期" ? 3 : 1;
        if (value !== "分期") n.due = "";
      }
      if (name === "total" && old.mode !== "分期") n.deposit = value;
    }
    return n;
  });
  const save = async (e) => {
    e.preventDefault();
    SB(true);
    SE("");
    const item = { ...form };
    ["cost", "price", "battery", "total", "deposit", "months", "amount"].forEach((k) => {
      if (k in item) item[k] = Number(item[k]);
    });
    if (modal === "phone") item.imei = String(item.imei || "").trim();
    try {
      const r = await localRequest("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: modal, item, version }) });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      SD(j.data);
      SV(j.version);
      SM("");
      SToast(true);
    } catch (e2) {
      SE(e2.message || "保存失败");
    } finally {
      SB(false);
    }
  };
  const field = (name, key, type = "text", required = false, extra = {}) => jsxs("label", { children: [
    t(key),
    required && jsx("span", { className: "required", children: " *" }),
    jsx("input", { name, type, required, value: form[name] ?? "", onChange: (e) => change(name, e.target.value), min: type === "number" ? 0 : void 0, step: type === "number" ? "0.01" : void 0, maxLength: 1e3, ...extra })
  ] }, name);
  const select = (name, key, options, translate = false) => jsxs("label", { children: [
    t(key),
    jsx("span", { className: "required", children: " *" }),
    jsxs("select", { required: true, name, value: form[name] ?? "", onChange: (e) => change(name, e.target.value), children: [
      jsx("option", { value: "", disabled: true, children: t("choose") }),
      options.map(([v, l]) => jsx("option", { value: v, children: translate ? bt(l) : l }, v))
    ] })
  ] }, name);
  const matches = (items) => items.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const phones = data.phones.filter((p) => matches([p, bt(p.status)]) && (filter === "all" || p.status === (filter === "stock" ? "在库" : "已售出")) && (modelFilter === "all" || p.model === modelFilter));
  const customers = data.customers.filter((c) => matches([c, bt(c.type || "")]));
  const sales = data.sales.filter((s) => {
    const c = data.customers.find((c2) => c2.id === s.customerId), p = data.phones.find((p2) => p2.id === s.phoneId);
    return matches([s, c, p, bt(s.mode)]) && (filter === "all" || (filter === "unpaid" ? balance(s) > 0 : filter === "settled" ? balance(s) === 0 : filter === "overdue" ? balance(s) > 0 && s.due < today() : balance(s) > 0 && s.due === today()));
  });
  const reset = () => {
    SQ("");
    SF("all");
    SMF("all");
  };
  const navigate = (i) => {
    ST(i);
    reset();
  };
  const csv = (rows, columns, file) => {
    if (!rows.length) {
      SE("@noExport");
      return;
    }
    const cell = (v) => '"' + String(v ?? "").replace(/^[\s]*[=+@-]/, "' $&").replaceAll('"', '""') + '"';
    const lines = [columns.map(([, k]) => t(k)), ...rows.map((r) => columns.map(([k]) => r[k]))];
    const blob = new Blob(["﻿" + lines.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = file + "_" + today() + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  };
  const exportRows = () => {
    if (tab === 1) csv(phones.map((p) => ({ ...p, status: bt(p.status) })), [["model", "model"], ["imei", "imei"], ["storage", "storage"], ["color", "color"], ["grade", "grade"], ["battery", "health"], ["cost", "cost"], ["price", "askPrice"], ["status", "status"], ["supplier", "supplier"], ["note", "testNote"]], "inventory");
    else if (tab === 2) csv(customers.map((c) => ({ ...c, type: bt(c.type) })), [["name", "name"], ["phone", "phone"], ["type", "customerType"], ["address", "address"], ["staff", "staff"], ["work", "work"], ["contact1", "contact1"], ["contact2", "contact2"], ["note", "followNote"]], "customers");
    else csv(sales.map((s) => ({ ...s, name: data.customers.find((c) => c.id === s.customerId)?.name, imei: data.phones.find((p) => p.id === s.phoneId)?.imei, mode: bt(s.mode), paid: paid(s), remaining: balance(s) })), [["name", "customer"], ["imei", "imei"], ["date", "saleDate"], ["mode", "mode"], ["total", "total"], ["paid", "paid"], ["remaining", "remaining"], ["months", "months"], ["due", "nextDue"], ["staff", "staff"], ["note", "note"]], "sales");
  };
  const exportPayments = () => csv(data.payments.filter((p) => sales.some((s) => s.id === p.saleId)).map((p) => {
    const s = data.sales.find((s2) => s2.id === p.saleId);
    return { ...p, name: data.customers.find((c) => c.id === s?.customerId)?.name, imei: data.phones.find((d) => d.id === s?.phoneId)?.imei, note: bt(p.note || "") };
  }), [["name", "customer"], ["imei", "imei"], ["date", "paymentDate"], ["amount", "amount"], ["note", "paymentNote"]], "payments");
  const errorLabel = error === "@noExport" ? t("noExport") : errorText(lang, error);
  const empty2 = (filtered = false) => jsxs("div", { className: "empty", children: [
    jsx("span", { className: "emptyicon", children: "◇" }),
    loading ? t("loading") : filtered ? t("noResults") : t("empty"),
    filtered && jsx("button", { className: "link", onClick: reset, children: t("clear") })
  ] });
  const salesTable = (items) => jsxs("div", { className: "tablewrap", children: [
    jsxs("table", { children: [
      jsx("thead", { children: jsx("tr", { children: ["orderDevice", "mode", "total", "remaining", "nextDue", "action"].map((k) => jsx("th", { children: t(k) }, k)) }) }),
      jsx("tbody", { children: items.map((s) => {
        const c = data.customers.find((x) => x.id === s.customerId), p = data.phones.find((x) => x.id === s.phoneId);
        return jsxs("tr", { children: [
          jsxs("td", { children: [
            jsx("button", { className: "textlink", onClick: () => c && open("customerDetail", c), children: c?.name || "—" }),
            jsxs("small", { children: [
              p?.model,
              " · ",
              p?.imei
            ] })
          ] }),
          jsx("td", { children: jsx("span", { className: "pill", children: bt(s.mode) }) }),
          jsxs("td", { children: [
            money(s.total),
            jsxs("small", { children: [
              t("paid"),
              " ",
              money(paid(s))
            ] })
          ] }),
          jsx("td", { className: balance(s) > 0 ? "amber" : "green", children: money(balance(s)) }),
          jsx("td", { children: balance(s) === 0 ? jsx("span", { className: "pill green", children: t("settled") }) : jsxs(Fragment, { children: [
            jsx("span", { className: s.due < today() ? "red" : "", children: s.due ? date(s.due) : t("noDue") }),
            s.due < today() && jsxs("small", { className: "red", children: [
              Math.floor((Date.parse(today()) - Date.parse(s.due)) / 864e5),
              " ",
              t("dayLate")
            ] }),
            s.due === today() && jsx("small", { className: "amber", children: t("dueToday") })
          ] }) }),
          jsxs("td", { children: [
            jsx("button", { className: "link", onClick: () => open("detail", s), children: t("details") }),
            balance(s) > 0 && jsx("button", { className: "link", onClick: () => open("payment", { saleId: s.id }), children: t("payment") })
          ] })
        ] }, s.id);
      }) })
    ] }),
    !items.length && empty2()
  ] });
  const modalTitle = modal === "phone" ? form.id ? "editPhone" : "addPhone" : modal === "customer" ? form.id ? "editCustomer" : "addCustomer" : modal === "sale" ? "addSale" : modal === "payment" ? "payment" : modal === "customerDetail" ? "customerDetail" : "saleDetail";
  const modalSale = data.sales.find((s) => s.id === form.saleId);
  const customerOrders = data.sales.filter((s) => s.customerId === form.id);
  const followItems = dueFilter === "overdue" ? overdue : dueFilter === "today" ? dueToday : upcoming;
  return jsxs("div", { className: "shell", children: [
    jsxs("aside", { children: [
      jsxs("div", { className: "brand", children: [
        jsx("span", { className: "mark", children: "A" }),
        jsxs("div", { children: [
          "ZHEN ATITAI",
          jsx("small", { children: "RETAIL WORKSPACE" })
        ] })
      ] }),
      jsxs("div", { className: "store", children: [
        jsx("span", { className: "dot" }),
        " Dili · ",
        t("workspace")
      ] }),
      jsx("nav", { children: tabs.map((k, i) => jsxs("button", { className: tab === i ? "active" : "", "aria-current": tab === i ? "page" : void 0, onClick: () => navigate(i), children: [
        jsx("span", { children: ["◫", "▣", "♧", "↗"][i] }),
        t(k)
      ] }, k)) }),
      jsxs("div", { className: "sidebottom", children: [
        "● ",
        cloudEnabled ? (lang === "zh" ? "● 云端账号已登录" : "Akun cloud aktif") : t("private"),
        jsx("small", { children: t("timezone") }),
        jsx("button", { className: "link", onClick: downloadBackup, children: lang === "zh" ? "下载完整数据备份" : "Unduh cadangan data" }),
        cloudEnabled && jsx("button", { className: "link", onClick: () => signOut().catch(() => {}), children: t("logout") })
      ] })
    ] }),
    jsxs("main", { children: [
      jsxs("header", { children: [
        jsxs("div", { className: "crumb", children: [
          "ZHEN ATITAI ",
          jsx("span", { children: "/" }),
          " ",
          t(tabs[tab])
        ] }),
        jsxs("div", { className: "headeractions", children: [
          cloudEnabled && jsx("button", { className: "secondary backupmobile", onClick: () => signOut().catch(() => {}), children: t("logout") }),
          jsx("button", { className: "secondary backupmobile", onClick: downloadBackup, children: lang === "zh" ? "备份" : "Cadangkan" }),
          jsxs("div", { className: "language", "aria-label": "Language / 语言", children: [
            jsx("button", { "aria-pressed": lang === "zh", className: lang === "zh" ? "chosen" : "", onClick: () => SL("zh"), children: "中文" }),
            jsx("button", { "aria-pressed": lang === "id", className: lang === "id" ? "chosen" : "", onClick: () => SL("id"), children: "Indonesia" })
          ] }),
          jsxs("div", { className: "profile", children: [
            jsx("span", { className: loaded ? "live" : "dot muted" }),
            loading ? t("loading") : loaded ? cloudEnabled ? (lang === "zh" ? "云端已连接" : "Cloud terhubung") : t("cloud") : t("offline")
          ] })
        ] })
      ] }),
      jsxs("section", { className: "content", children: [
        jsx("div", { className: "localnotice", children: cloudEnabled ? (lang === "zh" ? "数据已连接云端。使用同一账号登录其他设备，然后刷新以查看最新记录。" : "Data terhubung ke cloud. Masuk dengan akun yang sama di perangkat lain, lalu muat ulang untuk melihat catatan terbaru.") : lang === "zh" ? "数据保存在当前浏览器中，尚不支持跨设备同步。请定期下载备份；清除浏览器数据可能导致记录丢失。" : "Data tersimpan di browser ini dan belum tersinkron antarperangkat. Unduh cadangan secara berkala; menghapus data browser dapat menghapus catatan." }),
        jsxs("div", { className: "heading", children: [
          jsxs("div", { children: [
            jsx("div", { className: "eyebrow", children: "ZHEN ATITAI, LDA · IPHONE OPERATIONS" }),
            jsx("h1", { children: t(tabs[tab]) }),
            jsx("p", { children: t("subtitle") })
          ] }),
          jsxs("div", { className: "headingbuttons", children: [
            jsx("button", { className: "secondary refresh", disabled: loading || busy, onClick: load, "aria-label": t("refresh"), children: "↻" }),
            jsxs("button", { className: "primary", disabled: !loaded, onClick: () => open(tab === 2 ? "customer" : tab === 3 ? "sale" : "phone"), children: [
              "＋ ",
              t(tab === 2 ? "addCustomer" : tab === 3 ? "addSale" : "addPhone")
            ] })
          ] })
        ] }),
        error && !modal && jsxs("div", { className: "alert", role: "alert", children: [
          errorLabel,
          " ",
          jsx("button", { className: "link", onClick: load, children: t("refresh") })
        ] }),
        toast && jsxs("div", { className: "toast", role: "status", children: [
          "✓ ",
          t("saved")
        ] }),
        jsx("div", { className: "stats", children: [[t("stockCount"), stock.length, t("available"), "▣"], [t("stockCost"), money(stock.reduce((n, p) => n + p.cost, 0)), t("costNote"), "↘"], [t("customerCount"), data.customers.length, t("registered"), "♧"], [t("outstanding"), money(outstanding), overdue.length + " " + t("overdueCount"), "↗"]].map(([label, value, note, icon]) => jsxs("div", { className: "stat", children: [
          jsxs("span", { children: [
            label,
            jsx("i", { children: icon })
          ] }),
          jsx("strong", { children: loaded ? value : "—" }),
          jsx("small", { children: note })
        ] }, label)) }),
        tab === 0 ? jsxs(Fragment, { children: [
          jsxs("div", { className: "overview", children: [
            jsxs("div", { className: "panel", children: [
              jsxs("div", { className: "paneltitle", children: [
                jsx("h2", { children: t("stockMix") }),
                jsxs("button", { className: "link", onClick: () => navigate(1), children: [
                  t("viewStock"),
                  " ↗"
                ] })
              ] }),
              stock.length ? Object.entries(stock.reduce((a, p) => {
                a[p.model] = (a[p.model] || 0) + 1;
                return a;
              }, {})).sort((a, b) => b[1] - a[1]).map(([m, n]) => jsxs("div", { className: "barrow", children: [
                jsx("span", { children: m }),
                jsx("div", { children: jsx("i", { style: { width: n / stock.length * 100 + "%" } }) }),
                jsx("b", { children: n })
              ] }, m)) : jsxs("div", { className: "emptypicture", children: [
                jsxs("div", { className: "phoneart", children: [
                  jsx("div", {}),
                  jsx("span", { children: "iPhone" })
                ] }),
                jsx("h3", { children: t("firstPhone") }),
                jsx("p", { children: t("firstPhoneNote") }),
                jsxs("button", { className: "secondary", disabled: !loaded, onClick: () => open("phone"), children: [
                  "＋ ",
                  t("addPhone")
                ] })
              ] })
            ] }),
            jsxs("div", { className: "panel quick", children: [
              jsx("div", { className: "eyebrow", children: "DAILY WORKFLOW" }),
              jsx("h2", { children: t("workflow") }),
              [["arrival", "arrivalNote", "phone"], ["customerStep", "customerNote", "customer"], ["saleStep", "saleNote", "sale"]].map(([title, note, type], i) => jsxs("button", { disabled: !loaded, onClick: () => open(type), children: [
                jsxs("b", { children: [
                  "0",
                  i + 1
                ] }),
                jsxs("span", { children: [
                  t(title),
                  jsx("small", { children: t(note) })
                ] }),
                "↗"
              ] }, type)),
              jsx("div", { className: "hint", children: cloudEnabled ? (lang === "zh" ? "数据保存在云端，使用同一账号即可跨设备访问。" : "Data tersimpan di cloud dan dapat dibuka dengan akun yang sama di perangkat lain.") : t("syncNote") })
            ] })
          ] }),
          jsxs("div", { className: "panel", children: [
            jsxs("div", { className: "paneltitle", children: [
              jsx("h2", { children: t("followup") }),
              jsxs("button", { className: "link", onClick: () => navigate(3), children: [
                t("allOrders"),
                " ↗"
              ] })
            ] }),
            jsx("div", { className: "duefilters", children: [["overdue", "overdue", overdue.length], ["today", "dueToday", dueToday.length], ["upcoming", "upcoming", upcoming.length]].map(([id, key, n]) => jsxs("button", { className: dueFilter === id ? "selected" : "", onClick: () => SDF(id), children: [
              t(key),
              " ",
              jsx("b", { children: n })
            ] }, id)) }),
            salesTable(followItems)
          ] })
        ] }) : jsxs("div", { className: "panel", children: [
          jsxs("div", { className: "toolbar", children: [
            jsx("div", { className: "filters", children: (tab === 1 ? [["all", "all"], ["stock", "inStock"], ["sold", "sold"]] : tab === 3 ? [["all", "all"], ["unpaid", "unpaid"], ["settled", "settled"], ["overdue", "overdue"], ["today", "dueToday"]] : [["all", "allCustomers"]]).map(([id, key]) => jsx("button", { className: filter === id ? "selected" : "", onClick: () => SF(id), children: t(key) }, id)) }),
            jsxs("div", { className: "exportactions", children: [
              jsxs("button", { className: "secondary", onClick: exportRows, children: [
                t("export"),
                " ↓"
              ] }),
              tab === 3 && jsx("button", { className: "link", onClick: exportPayments, children: t("exportPayments") })
            ] }),
            jsxs("div", { className: "searchline", children: [
              jsx("input", { className: "search", "aria-label": t("search"), placeholder: t("search"), value: query, onChange: (e) => SQ(e.target.value) }),
              tab === 1 && jsxs("select", { className: "modelFilter", "aria-label": t("model"), value: modelFilter, onChange: (e) => SMF(e.target.value), children: [
                jsx("option", { value: "all", children: t("allModels") }),
                [...new Set(data.phones.map((p) => p.model))].map((m) => jsx("option", { children: m }, m))
              ] }),
              jsxs("span", { className: "resultcount", children: [
                tab === 1 ? phones.length : tab === 2 ? customers.length : sales.length,
                " ",
                t("results")
              ] }),
              (query || filter !== "all" || modelFilter !== "all") && jsx("button", { className: "link", onClick: reset, children: t("clear") })
            ] })
          ] }),
          tab === 1 ? jsxs("div", { className: "tablewrap", children: [
            jsxs("table", { children: [
              jsx("thead", { children: jsx("tr", { children: ["device", "capacityColor", "conditionBattery", "costPrice", "status", "action"].map((k) => jsx("th", { children: t(k) }, k)) }) }),
              jsx("tbody", { children: phones.map((p) => jsxs("tr", { children: [
                jsxs("td", { children: [
                  jsx("b", { children: p.model }),
                  jsx("small", { className: "mono", children: p.imei })
                ] }),
                jsxs("td", { children: [
                  p.storage,
                  jsx("small", { children: p.color || "—" })
                ] }),
                jsxs("td", { children: [
                  p.grade,
                  jsxs("small", { children: [
                    t("battery"),
                    " ",
                    p.battery,
                    "%"
                  ] })
                ] }),
                jsxs("td", { children: [
                  money(p.cost),
                  jsxs("small", { children: [
                    t("price"),
                    " ",
                    money(p.price)
                  ] })
                ] }),
                jsx("td", { children: jsx("span", { className: "pill " + (p.status === "在库" ? "green" : ""), children: bt(p.status) }) }),
                jsx("td", { children: p.status === "在库" ? jsxs(Fragment, { children: [
                  jsx("button", { className: "link", onClick: () => open("phone", p), children: t("edit") }),
                  jsx("button", { className: "link", onClick: () => open("sale", { phoneId: p.id }), children: t("sell") })
                ] }) : jsx("button", { className: "link", onClick: () => {
                  const s = data.sales.find((s2) => s2.phoneId === p.id);
                  if (s) open("detail", s);
                }, children: t("details") }) })
              ] }, p.id)) })
            ] }),
            !phones.length && empty2(!!data.phones.length)
          ] }) : tab === 2 ? jsxs("div", { className: "tablewrap", children: [
            jsxs("table", { children: [
              jsx("thead", { children: jsx("tr", { children: ["customer", "phone", "address", "staff", "outstanding", "action"].map((k) => jsx("th", { children: t(k) }, k)) }) }),
              jsx("tbody", { children: customers.map((c) => jsxs("tr", { children: [
                jsxs("td", { children: [
                  jsx("button", { className: "textlink", onClick: () => open("customerDetail", c), children: c.name }),
                  jsx("small", { children: bt(c.type || "") })
                ] }),
                jsx("td", { children: c.phone }),
                jsx("td", { className: "wrapcell", children: c.address || "—" }),
                jsx("td", { children: c.staff || "—" }),
                jsx("td", { children: money(data.sales.filter((s) => s.customerId === c.id).reduce((n, s) => n + balance(s), 0)) }),
                jsxs("td", { children: [
                  jsx("button", { className: "link", onClick: () => open("customerDetail", c), children: t("details") }),
                  jsx("button", { className: "link", onClick: () => open("customer", c), children: t("edit") })
                ] })
              ] }, c.id)) })
            ] }),
            !customers.length && empty2(!!data.customers.length)
          ] }) : salesTable(sales)
        ] }),
        jsxs("footer", { children: [
          "ZHEN ATITAI, LDA ",
          jsx("span", { children: t("timezone") })
        ] })
      ] })
    ] }),
    modal && jsx("div", { className: "overlay", children: jsxs("div", { ref: dialog, className: "modal " + (["detail", "customerDetail"].includes(modal) ? "wide" : ""), role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title", children: [
      jsxs("div", { className: "paneltitle", children: [
        jsxs("div", { children: [
          jsx("div", { className: "eyebrow", children: "ZHEN ATITAI WORKSPACE" }),
          jsx("h2", { id: "modal-title", children: t(modalTitle) })
        ] }),
        jsx("button", { className: "close", "aria-label": t("close"), disabled: busy, onClick: () => SM(""), children: "×" })
      ] }),
      error && jsxs("div", { className: "alert", role: "alert", children: [
        errorLabel,
        error.includes("数据已更新") && jsx("button", { className: "link", type: "button", disabled: loading, onClick: load, children: t("refresh") })
      ] }),
      modal === "customerDetail" ? jsxs(Fragment, { children: [
        jsxs("div", { className: "detailhero", children: [
          jsxs("div", { children: [
            jsx("h2", { children: form.name }),
            jsxs("p", { children: [
              form.phone,
              " · ",
              bt(form.type || "")
            ] })
          ] }),
          jsx("button", { className: "secondary", onClick: () => open("customer", form), children: t("edit") })
        ] }),
        jsx("dl", { className: "detailsgrid", children: ["address", "staff", "work", "contact1", "contact2", "note"].map((k) => jsxs("div", { children: [
          jsx("dt", { children: t(k === "note" ? "followNote" : k) }),
          jsx("dd", { children: form[k] || "—" })
        ] }, k)) }),
        jsxs("div", { className: "detailtotals", children: [
          jsxs("span", { children: [
            t("outstanding"),
            jsx("b", { children: money(customerOrders.reduce((n, s) => n + balance(s), 0)) })
          ] }),
          jsxs("button", { className: "primary", onClick: () => open("sale", { customerId: form.id }), children: [
            "＋ ",
            t("addSale")
          ] })
        ] }),
        jsx("h3", { children: t("linkedOrders") }),
        salesTable(customerOrders)
      ] }) : modal === "detail" ? jsxs(Fragment, { children: [
        jsxs("div", { className: "detailhero", children: [
          jsxs("div", { children: [
            jsx("h2", { children: data.customers.find((c) => c.id === form.customerId)?.name }),
            jsxs("p", { children: [
              data.phones.find((p) => p.id === form.phoneId)?.model,
              " · ",
              data.phones.find((p) => p.id === form.phoneId)?.imei
            ] })
          ] }),
          jsx("span", { className: "pill", children: bt(form.mode) })
        ] }),
        jsx("div", { className: "detailtotals", children: [["total", form.total], ["paid", paid(form)], ["remaining", balance(form)]].map(([k, n]) => jsxs("span", { children: [
          t(k),
          jsx("b", { children: money(n) })
        ] }, k)) }),
        jsxs("dl", { className: "detailsgrid", children: [
          jsxs("div", { children: [
            jsx("dt", { children: t("saleDate") }),
            jsx("dd", { children: date(form.date) })
          ] }),
          jsxs("div", { children: [
            jsx("dt", { children: t("months") }),
            jsx("dd", { children: form.months || 1 })
          ] }),
          jsxs("div", { children: [
            jsx("dt", { children: t("nextDue") }),
            jsx("dd", { children: balance(form) ? form.due ? date(form.due) : t("noDue") : t("settled") })
          ] }),
          jsxs("div", { children: [
            jsx("dt", { children: t("staff") }),
            jsx("dd", { children: form.staff || "—" })
          ] }),
          jsxs("div", { children: [
            jsx("dt", { children: t("note") }),
            jsx("dd", { children: form.note || "—" })
          ] })
        ] }),
        jsx("h3", { children: t("receipts") }),
        jsx("div", { className: "paymentlist", children: data.payments.filter((p) => p.saleId === form.id).map((p) => jsxs("div", { children: [
          jsxs("span", { children: [
            date(p.date),
            jsx("small", { children: bt(p.note || "") })
          ] }),
          jsx("b", { children: money(p.amount) })
        ] }, p.id)) }),
        !data.payments.some((p) => p.saleId === form.id) && jsx("p", { children: t("noReceipts") }),
        balance(form) > 0 && jsx("div", { className: "formactions", children: jsx("button", { className: "primary", onClick: () => open("payment", { saleId: form.id }), children: t("payment") }) })
      ] }) : jsx("form", { onSubmit: save, children: jsxs("fieldset", { disabled: busy, children: [
        jsxs("div", { className: "formgrid", children: [
          modal === "phone" && jsxs(Fragment, { children: [
            select("model", "model", models.map((m) => [m, m])),
            field("imei", "imei", "text", true, { inputMode: "numeric", pattern: "[0-9]{15}", maxLength: 15 }),
            select("storage", "storage", ["64GB", "128GB", "256GB", "512GB", "1TB"].map((x) => [x, x])),
            field("color", "color"),
            select("grade", "grade", ["A++", "A", "AB", "B", "C"].map((x) => [x, x])),
            field("battery", "health", "number", true, { max: 100, step: 1 }),
            field("cost", "cost", "number", true),
            field("price", "askPrice", "number", true),
            field("supplier", "supplier"),
            field("note", "testNote")
          ] }),
          modal === "customer" && jsxs(Fragment, { children: [
            field("name", "name", "text", true),
            field("phone", "phone", "tel", true),
            select("type", "customerType", ["零售", "批发", "分期"].map((x) => [x, x]), true),
            field("staff", "staff"),
            field("address", "address"),
            field("work", "work"),
            field("contact1", "contact1"),
            field("contact2", "contact2"),
            field("note", "followNote")
          ] }),
          modal === "sale" && jsxs(Fragment, { children: [
            (!stock.length || !data.customers.length) && jsxs("div", { className: "formnote alert", children: [
              t("needPhoneCustomer"),
              jsxs("div", { className: "formactions", children: [
                jsx("button", { type: "button", className: "link", onClick: () => open("phone"), children: t("addPhone") }),
                jsx("button", { type: "button", className: "link", onClick: () => open("customer"), children: t("addCustomer") })
              ] })
            ] }),
            select("phoneId", "choosePhone", stock.map((p) => [p.id, p.model + " · " + p.imei])),
            select("customerId", "chooseCustomer", data.customers.map((c) => [c.id, c.name + " · " + c.phone])),
            select("mode", "mode", ["零售", "批发", "分期"].map((x) => [x, x]), true),
            field("date", "saleDate", "date", true),
            field("total", "saleTotal", "number", true, { min: 0.01 }),
            field("deposit", "deposit", "number", true, { max: form.total || void 0 }),
            form.mode === "分期" && jsxs(Fragment, { children: [
              field("months", "months", "number", true, { min: 1, max: 24, step: 1 }),
              field("due", "nextDue", "date", true, { min: form.date })
            ] }),
            field("staff", "staff"),
            field("note", "saleNoteField"),
            jsxs("div", { className: "formnote", children: [
              t("phonePrefill"),
              jsx("br", {}),
              t(form.mode === "分期" ? "contractHint" : "cashHint")
            ] })
          ] }),
          modal === "payment" && jsxs(Fragment, { children: [
            jsxs("div", { className: "formnote", children: [
              t("remaining"),
              ": ",
              jsx("strong", { children: money(modalSale ? balance(modalSale) : 0) })
            ] }),
            field("amount", "amount", "number", true, { min: 0.01, max: modalSale ? balance(modalSale) : 0 }),
            field("date", "paymentDate", "date", true),
            field("nextDue", "optionalDue", "date"),
            field("note", "paymentNote")
          ] })
        ] }),
        jsxs("div", { className: "formactions", children: [
          jsx("button", { type: "button", className: "secondary", onClick: () => SM(""), children: t("cancel") }),
          jsx("button", { className: "primary", disabled: busy || !loaded || modal === "sale" && (!stock.length || !data.customers.length), children: t(busy ? "saving" : "save") })
        ] })
      ] }) })
    ] }) })
  ] });
}

export { App };
