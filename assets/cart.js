(function () {
  const KEY = "aimc_cart";
  const API =
    "https://script.google.com/macros/s/AKfycbytFn_U1s4rG29ayl16zGX6kgT6TCEq0NYi3R3ay5YCvpoipD9TYkYEOv-TrLIXUi23RQ/exec"; // <-- your Apps Script /exec URL
  const DELIVERY_FEE_PK = 200;

  function load() {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  }
  function save(c) {
    localStorage.setItem(KEY, JSON.stringify(c));
  }
  function count() {
    return load().reduce((n, i) => n + (i.qty || 0), 0);
  }
  function subtotal() {
    return load().reduce(
      (s, i) => s + Number(i.price || 0) * Number(i.qty || 0),
      0
    );
  }
  function clear() {
    save([]);
  }

  function add(item) {
    const c = load();
    const key = item.id + "__" + (item.size || "");
    const ex = c.find((i) => i.key === key);
    if (ex) ex.qty += item.qty || 1;
    else
      c.push({
        key,
        id: item.id,
        name: item.name,
        size: item.size || "",
        price: Number(item.price || 0),
        qty: item.qty || 1,
      });
    save(c);
  }

  async function fileToDataURL(file) {
    if (!file) return "";
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function deliveryFeeFromForm(formEl) {
    const v = (
      formEl.querySelector('[name="delivery"]')?.value || ""
    ).toLowerCase();
    return v.includes("delivery") ? DELIVERY_FEE_PK : 0;
  }

  async function submitOrder(formEl) {
    const cart = load();
    if (!cart.length) throw new Error("Cart is empty");

    const fee = deliveryFeeFromForm(formEl);
    const grand = subtotal() + fee;

    const fd = new FormData(formEl);
    fd.append("cart_json", JSON.stringify(cart));
    fd.append("delivery_fee", String(fee));
    fd.append("total", String(grand));

    const file = formEl.querySelector('input[name="screenshot"]')?.files?.[0];
    if (file) {
      const b64 = await fileToDataURL(file);
      fd.append("screenshot_b64", b64);
    }

    const res = await fetch(API, { method: "POST", body: fd });
    const json = await res.json();
    return json; // {ok, orderId, total, ...} or {ok:false,...}
  }

  async function getVariants(productId) {
    const url = `${API}?stock=1&id=${encodeURIComponent(productId)}`;
    const r = await fetch(url);
    const j = await r.json();
    return j.variants || [];
  }

  window.Cart = {
    load,
    save,
    add,
    count,
    subtotal,
    clear,
    submitOrder,
    getVariants,
    API,
  };
  window.refreshCartBadge = function () {
    const el = document.getElementById("cartBadge");
    if (!el) return;
    const n = count();
    el.textContent = n;
    el.style.display = n ? "inline-block" : "none";
  };
  document.addEventListener("DOMContentLoaded", window.refreshCartBadge);
})();
