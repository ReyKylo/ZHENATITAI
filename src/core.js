// Business rules shared by the browser and Node tests. Monetary comparisons use cents.
export const emptyData = () => ({ phones: [], customers: [], sales: [], payments: [] });
export const cents = (amount) => Math.round(amount * 100);
export const validDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

const validText = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 1000;
const validNumber = (value) => Number.isFinite(value) && value >= 0 && value <= 10_000_000;
const uuid = () => globalThis.crypto.randomUUID?.() || Array.from(
  globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0"),
).join("");

export function applyAction(current, action, item) {
  const data = structuredClone(current);
  if (!item || typeof item !== "object" || Array.isArray(item)) throw Error("操作无效");
  for (const key of ["cost", "price", "total", "deposit", "amount"]) {
    if (key in item && (!validNumber(item[key]) || Math.abs(item[key] * 100 - cents(item[key])) > 1e-5)) {
      throw Error("金额最多保留两位小数");
    }
  }
  const id = uuid();
  if (action === "phone") {
    if (!validText(item.model) || !/^\d{15}$/.test(item.imei) || !validNumber(item.cost)
      || !validNumber(item.price) || !validNumber(item.battery) || item.battery > 100) {
      throw Error("请填写型号、15 位 IMEI 和有效金额／电池健康度");
    }
    if (data.phones.some((phone) => phone.imei === item.imei && phone.id !== item.id)) throw Error("此 IMEI 已存在");
    const old = data.phones.find((phone) => phone.id === item.id);
    if (old?.status === "已售出") throw Error("已售出手机不能修改");
    const phone = { ...item, id: old?.id || id, status: old?.status || "在库", created: old?.created || new Date().toISOString() };
    data.phones = old ? data.phones.map((p) => p.id === old.id ? phone : p) : [phone, ...data.phones];
  } else if (action === "customer") {
    if (!validText(item.name) || !validText(item.phone)) throw Error("请填写客户姓名和电话");
    const old = data.customers.find((customer) => customer.id === item.id);
    const customer = { ...item, id: old?.id || id };
    data.customers = old ? data.customers.map((c) => c.id === old.id ? customer : c) : [customer, ...data.customers];
  } else if (action === "sale") {
    const phone = data.phones.find((p) => p.id === item.phoneId);
    if (!phone || phone.status !== "在库") throw Error("手机已售出或不存在");
    if (!data.customers.some((customer) => customer.id === item.customerId)) throw Error("请选择客户");
    if (!validNumber(item.total) || item.total <= 0 || !validNumber(item.deposit) || item.deposit > item.total
      || !["零售", "批发", "分期"].includes(item.mode) || !validDay(item.date)) throw Error("销售金额或日期无效");
    if (item.mode !== "分期" && cents(item.deposit) !== cents(item.total)) throw Error("零售和批发需全额收款");
    if (item.mode === "分期" && (!validDay(item.due) || !Number.isInteger(item.months) || item.months < 1 || item.months > 24)) {
      throw Error("请填写有效还款日期和期数");
    }
    if (item.mode === "分期" && item.due < item.date) throw Error("还款日不能早于销售日期");
    phone.status = "已售出";
    data.sales.unshift({ ...item, id, cost: phone.cost });
    if (item.deposit > 0) data.payments.unshift({ id: uuid(), saleId: id, amount: item.deposit, date: item.date, note: "首笔收款" });
  } else if (action === "payment") {
    const sale = data.sales.find((s) => s.id === item.saleId);
    if (!sale) throw Error("订单不存在");
    const paid = data.payments.filter((p) => p.saleId === sale.id).reduce((sum, p) => sum + cents(p.amount), 0);
    if (!validNumber(item.amount) || item.amount <= 0 || paid + cents(item.amount) > cents(sale.total) || !validDay(item.date)) {
      throw Error("收款不能超过剩余余额，日期必须有效");
    }
    if (item.nextDue && !validDay(item.nextDue)) throw Error("下一还款日期无效");
    if (item.nextDue && item.nextDue < sale.date) throw Error("还款日不能早于销售日期");
    data.payments.unshift({ ...item, id });
    if (item.nextDue) sale.due = item.nextDue;
  } else {
    throw Error("操作无效");
  }
  if (JSON.stringify(data).length > 4_000_000) throw Error("数据量过大，请联系管理员");
  return data;
}
