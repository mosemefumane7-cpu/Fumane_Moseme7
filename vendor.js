(() => {
  "use strict";
  const CURRENCY = "M";
  const $ = (selector) => document.querySelector(selector);
  const state = { csrf: null, vendor: null, registering: false, sale: null };

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (value) =>
    `${CURRENCY} ${Number(value || 0).toLocaleString("en-LS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const shortDate = (value) =>
    value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const STATUS = { PAID: "Paid", PARTIALLY_PAID: "Part paid", UNPAID: "Unpaid" };
  const badge = (status) => {
    const cls = status === "PARTIALLY_PAID" ? " status-badge--partial" : status === "UNPAID" ? " status-badge--unpaid" : "";
    return `<span class="status-badge${cls}">${escapeHtml(STATUS[status] || status)}</span>`;
  };
  const methodLabel = (m) => ({ CASH: "Cash", MOBILE_MONEY: "Mobile money", CREDIT: "Credit" })[m] || m;

  function toast(message, error = false) {
    const node = document.createElement("div");
    node.className = `vp-toast${error ? " vp-toast--error" : ""}`;
    node.textContent = message;
    $("#vpToasts").append(node);
    setTimeout(() => node.remove(), 4500);
  }

  async function api(path, options = {}) {
    const { body, ...rest } = options;
    const method = (rest.method || "GET").toUpperCase();
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
    const response = await fetch(`/api/portal${path}`, {
      credentials: "same-origin",
      ...rest,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(unsafe && state.csrf ? { "X-CSRF-Token": state.csrf } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let payload = null;
    try { payload = await response.json(); } catch (_) { /* non-JSON response */ }
    if (!response.ok || !payload || payload.success === false) {
      const error = new Error((payload && payload.message) || "Something went wrong. Please try again.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function show(view) {
    $("#vpLoading").hidden = view !== "loading";
    $("#vpAuth").hidden = view !== "auth";
    $("#vpApp").hidden = view !== "app";
  }

  /* ---------- sign in / register ---------- */
  function setMode(registering) {
    state.registering = registering;
    $("#vpAuthTitle").textContent = registering ? "Create your account" : "Sign in";
    $("#vpAuthHint").textContent = registering
      ? "Enter the phone number Batloung Farm registered for you, then choose a password (8 or more characters)."
      : "Use the phone number Batloung Farm has registered for your business.";
    $("#vpAuthSubmit").textContent = registering ? "Create account" : "Sign in";
    $("#vpAuthToggle").textContent = registering ? "Already have an account? Sign in" : "First time here? Create your account";
    $("#vpConfirmRow").hidden = !registering;
    $("#vpAuthForm").password.autocomplete = registering ? "new-password" : "current-password";
    $("#vpAuthError").hidden = true;
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#vpAuthError");
    error.hidden = true;
    const phone = form.phone.value.trim();
    const password = form.password.value;
    if (!phone || !password) { error.textContent = "Enter your phone number and password."; error.hidden = false; return; }
    if (state.registering) {
      if (password.length < 8) { error.textContent = "Password must be at least 8 characters."; error.hidden = false; return; }
      if (password !== form.confirmPassword.value) { error.textContent = "The two passwords do not match."; error.hidden = false; return; }
    }
    const button = $("#vpAuthSubmit");
    button.disabled = true;
    try {
      const result = await api(state.registering ? "/register" : "/login", { method: "POST", body: { phone, password } });
      state.csrf = result.data.csrfToken;
      state.vendor = result.data.vendor;
      form.reset();
      await openApp();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    try { await api("/logout", { method: "POST" }); } catch (_) { /* cookie is cleared server-side when reachable */ }
    state.csrf = null; state.vendor = null;
    setMode(false);
    show("auth");
  }

  /* ---------- dashboard ---------- */
  async function loadDashboard() {
    const [summary, sales] = await Promise.all([api("/summary"), api("/sales")]);
    const s = summary.data;
    $("#kpiDue").textContent = money(s.outstanding_balance);
    $("#kpiPaid").textContent = money(s.total_paid);
    $("#kpiTotal").textContent = money(s.total_sales);
    $("#kpiOpen").textContent = s.open_sales
      ? `${s.open_sales} order${s.open_sales === 1 ? "" : "s"} awaiting payment`
      : "You are all paid up. Thank you!";

    const rows = sales.data;
    $("#vpNoSales").hidden = rows.length > 0;
    $("#vpSales").innerHTML = rows.map((sale) => `
      <tr>
        <td>#${escapeHtml(sale.sale_id)}</td>
        <td>${escapeHtml(shortDate(sale.sale_date))}</td>
        <td>${badge(sale.payment_status)}</td>
        <td class="num">${money(sale.total_amount)}</td>
        <td class="num">${money(sale.amount_paid)}</td>
        <td class="num"><strong>${money(sale.outstanding_balance)}</strong></td>
        <td class="vp-actions">
          <button class="button button--small ${sale.outstanding_balance > 0 ? "button--primary" : "button--outline"}" type="button" data-sale="${escapeHtml(sale.sale_id)}">
            ${sale.outstanding_balance > 0 ? "Pay" : "View"}
          </button>
        </td>
      </tr>`).join("");

    const payments = s.recent_payments;
    $("#vpNoPayments").hidden = payments.length > 0;
    $("#vpPayments").innerHTML = payments.map((p) => `
      <tr>
        <td>${escapeHtml(shortDate(p.payment_date))}</td>
        <td>#${escapeHtml(p.sale_id)}</td>
        <td>${escapeHtml(methodLabel(p.payment_method))}</td>
        <td>${escapeHtml(p.reference || "—")}</td>
        <td class="num">${money(p.amount)}</td>
      </tr>`).join("");
  }

  async function openApp() {
    const v = state.vendor;
    $("#vpVendorName").textContent = v.vendor_name;
    $("#vpWelcome").textContent = `Welcome, ${v.vendor_name}`;
    $("#vpMeta").textContent = [v.phone_number, v.location].filter(Boolean).join(" · ");
    show("app");
    try { await loadDashboard(); } catch (err) { toast(err.message, true); }
  }

  /* ---------- order dialog and payment ---------- */
  async function openSale(saleId) {
    try {
      const { data } = await api(`/sales/${encodeURIComponent(saleId)}`);
      state.sale = data;
      $("#vpDialogTitle").textContent = `Order #${data.sale_id}`;
      $("#vpDialogBody").innerHTML = `
        <div class="vp-sum">
          <div><span>Total</span><strong>${money(data.total_amount)}</strong></div>
          <div><span>Paid</span><strong>${money(data.amount_paid)}</strong></div>
          <div><span>Balance</span><strong>${money(data.outstanding_balance)}</strong></div>
        </div>
        <p class="vp-muted">${escapeHtml(shortDate(data.sale_date))} · ${badge(data.payment_status)}</p>
        <h3>Items</h3>
        <div class="vp-table-wrap"><table class="vp-table">
          <thead><tr><th>Fruit</th><th>Size</th><th class="num">Boxes</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
          <tbody>${data.items.map((i) => `
            <tr><td>${escapeHtml(i.fruit_name)}</td><td>${escapeHtml(String(i.packaging_size).toLowerCase())}</td>
            <td class="num">${escapeHtml(i.quantity)}</td><td class="num">${money(i.unit_price)}</td><td class="num">${money(i.line_total)}</td></tr>`).join("")}
          </tbody></table></div>
        ${data.payments.length ? `<h3>Payments on this order</h3>
        <div class="vp-table-wrap"><table class="vp-table"><tbody>${data.payments.map((p) => `
          <tr><td>${escapeHtml(shortDate(p.payment_date))}</td><td>${escapeHtml(methodLabel(p.payment_method))}</td>
          <td>${escapeHtml(p.reference || "—")}</td><td class="num">${money(p.amount)}</td></tr>`).join("")}</tbody></table></div>` : ""}`;

      const form = $("#vpPayForm");
      const due = Number(data.outstanding_balance);
      form.hidden = !(due > 0);
      form.reset();
      $("#vpPayError").hidden = true;
      if (due > 0) {
        form.amount.max = due.toFixed(2);
        form.amount.value = due.toFixed(2);
        $("#vpPayFull").textContent = `Pay the full balance (${money(due)})`;
      }
      const dialog = $("#vpDialog");
      if (!dialog.open) dialog.showModal();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#vpPayError");
    error.hidden = true;
    const amount = Number(form.amount.value);
    const reference = form.reference.value.trim();
    const due = Number(state.sale.outstanding_balance);
    if (!Number.isFinite(amount) || amount <= 0) { error.textContent = "Enter an amount greater than zero."; error.hidden = false; return; }
    if (Math.round(amount * 100) > Math.round(due * 100)) { error.textContent = `You cannot pay more than the balance of ${money(due)}.`; error.hidden = false; return; }
    if (reference.length < 4) { error.textContent = "Enter the mobile money transaction reference."; error.hidden = false; return; }
    const button = $("#vpPaySubmit");
    button.disabled = true;
    try {
      const { data } = await api(`/sales/${encodeURIComponent(state.sale.sale_id)}/payments`, { method: "POST", body: { amount, reference } });
      toast(`Payment of ${money(data.amount)} recorded. Balance left: ${money(data.outstanding_balance)}.`);
      $("#vpDialog").close();
      await loadDashboard();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  /* ---------- start ---------- */
  async function init() {
    $("#vpAuthForm").addEventListener("submit", submitAuth);
    $("#vpAuthToggle").addEventListener("click", () => setMode(!state.registering));
    $("#vpLogout").addEventListener("click", logout);
    $("#vpSales").addEventListener("click", (e) => {
      const button = e.target.closest("button[data-sale]");
      if (button) openSale(button.dataset.sale);
    });
    $("#vpDialogClose").addEventListener("click", () => $("#vpDialog").close());
    $("#vpPayForm").addEventListener("submit", submitPayment);
    $("#vpPayFull").addEventListener("click", () => {
      $("#vpPayForm").amount.value = Number(state.sale.outstanding_balance).toFixed(2);
    });
    setMode(false);
    try {
      const { data } = await api("/me");
      state.csrf = data.csrfToken;
      state.vendor = data.vendor;
      await openApp();
    } catch (_) {
      show("auth");
    }
  }
  init();
})();
