import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyData, validDay } from "../src/core.js";

const device = { model: "iPhone 13", imei: "123456789012345", storage: "128GB", grade: "A", battery: 92, cost: 250, price: 400 };
function fixture() {
  let data = applyAction(emptyData(), "phone", device);
  data = applyAction(data, "customer", { name: "Test customer", phone: "+67070000000", type: "零售" });
  return data;
}
function sale(data, overrides = {}) {
  return { phoneId: data.phones[0].id, customerId: data.customers[0].id, mode: "分期", date: "2026-11-13", total: 400, deposit: 100, due: "2026-12-13", months: 3, ...overrides };
}

test("inventory, customer, installment and settlement work together without mutating prior snapshots", () => {
  const original = fixture();
  const sold = applyAction(original, "sale", sale(original));
  assert.equal(original.phones[0].status, "在库");
  assert.equal(sold.phones[0].status, "已售出");
  assert.equal(sold.sales[0].cost, 250);
  assert.equal(sold.payments[0].amount, 100);
  const settled = applyAction(sold, "payment", { saleId: sold.sales[0].id, amount: 300, date: "2026-11-14" });
  assert.equal(settled.payments.reduce((sum, payment) => sum + payment.amount, 0), 400);
  assert.equal(sold.payments.length, 1);
});
test("duplicate IMEI is rejected and the same device can be edited", () => {
  const data = fixture();
  assert.throws(() => applyAction(data, "phone", device), /IMEI/);
  const next = applyAction(data, "phone", { ...data.phones[0], price: 450 });
  assert.equal(next.phones.length, 1);
  assert.equal(next.phones[0].price, 450);
});
test("sold devices cannot be edited or sold twice", () => {
  const data = fixture();
  const sold = applyAction(data, "sale", sale(data));
  assert.throws(() => applyAction(sold, "sale", sale(sold)), /已售出/);
  assert.throws(() => applyAction(sold, "phone", sold.phones[0]), /不能修改/);
});
test("retail and wholesale sales require full payment", () => {
  const data = fixture();
  for (const mode of ["零售", "批发"]) {
    assert.throws(() => applyAction(data, "sale", sale(data, { mode })), /全额/);
    assert.equal(applyAction(data, "sale", sale(data, { mode, deposit: 400 })).payments[0].amount, 400);
  }
});
test("installments enforce customer, amount, tenor and valid due date", () => {
  const data = fixture();
  for (const overrides of [{ customerId: "missing" }, { total: 0 }, { deposit: 500 }, { months: 0 }, { months: 25 }, { due: "2026-02-30" }, { due: "2026-11-12" }]) {
    assert.throws(() => applyAction(data, "sale", sale(data, overrides)));
  }
});
test("payments cannot overpay, have extra decimals or point to missing orders", () => {
  const data = fixture();
  const sold = applyAction(data, "sale", sale(data));
  const payment = { saleId: sold.sales[0].id, amount: 300, date: "2026-11-14" };
  assert.throws(() => applyAction(sold, "payment", { ...payment, amount: 300.01 }));
  assert.throws(() => applyAction(sold, "payment", { ...payment, amount: 2.001 }));
  assert.throws(() => applyAction(sold, "payment", { ...payment, saleId: "missing" }));
  assert.throws(() => applyAction(sold, "payment", { ...payment, nextDue: "2026-11-12" }));
});
test("decimal currency settles precisely to the last cent", () => {
  const data = fixture();
  const sold = applyAction(data, "sale", sale(data, { total: 0.3, deposit: 0.1 }));
  const paid = applyAction(sold, "payment", { saleId: sold.sales[0].id, amount: 0.2, date: "2026-11-14" });
  assert.equal(paid.payments.length, 2);
  assert.throws(() => applyAction(paid, "payment", { saleId: sold.sales[0].id, amount: 0.01, date: "2026-11-14" }));
});
test("calendar validation rejects overflow and accepts leap days", () => {
  assert.equal(validDay("2026-02-29"), false);
  assert.equal(validDay("2028-02-29"), true);
  assert.equal(validDay("invalid"), false);
});
