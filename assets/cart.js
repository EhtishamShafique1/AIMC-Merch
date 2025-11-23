(function () {
  const KEY = "aimc_cart";
  const API =
    "https://script.google.com/macros/s/AKfycbz-gmYORvXpJoHnfpcqfdQZi6MLPUeJLTA6NUOgkzssKYqGP3AGeA3G23FzlMWm2R0-Ow/exec"; // <-- updated Apps Script /exec URL (confirmed reachable)
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
    try {
      const r = await fetch(url);
      const j = await r.json();
      if (!j) {
        console.warn("Cart.getVariants -> empty response from API", url);
        return [];
      }
      if (j.ok === false) {
        console.warn("Cart.getVariants -> API returned error", j.error || j);
        return [];
      }

      const raw = j.variants || [];
      const variants = raw.map((v) => {
        // Price can be number or string (e.g. "PKR 2,100"); handle both
        let price = 0;
        if (typeof v.price === "number") {
          price = v.price;
        } else {
          const priceRaw = (v.price || v.price_str || "").toString();
          const cleaned = priceRaw.replace(/[^\d.,]/g, "").replace(/,/g, "");
          price = Number(cleaned) || 0;
        }

        const idVal = v.id || v.product_id || v["product id"] || v.product || "";
        const sizeVal = v.size || v.s || v["size"] || "";
        const stockVal = Number(v.stock || v.qty || v["stock"] || 0);

        return {
          id: idVal,
          size: sizeVal,
          price: price,
          stock: stockVal,
        };
      });

      if (!variants.length) {
        console.warn("Cart.getVariants -> no variants returned for", productId, "from", url);
      }

      console.debug("Cart.getVariants ->", variants);
      return variants;
    } catch (err) {
      console.error("Cart.getVariants fetch error", err, url);
      return [];
    }
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




