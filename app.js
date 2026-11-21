const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const SIZES = ["SMALL", "MEDIUM", "LARGE"];
const CURRENCY = "M";
const state = {
  admin: null,
  csrfToken: null,
  view: "dashboard",
  fruits: [],
  suppliers: [],
  vendors: [],
  stock: [],
  sales: [],
  purchases: [],
  outstanding: [],
  editing: null,
};

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
function money(value) {
  return `${CURRENCY} ${Number(value || 0).toLocaleString("en-LS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function shortDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}
function localISODate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function monthStart() {
  const date = new Date();
  date.setDate(1);
  return localISODate(date);
}
function showToast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast${type === "error" ? " toast--error" : ""}`;
  node.innerHTML = `<span>${escapeHtml(message)}</span>`;
  $("#toastRegion").append(node);
  window.setTimeout(() => node.remove(), 4400);
}

async function api(path, options = {}) {
  const { body, headers = {}, ...rest } = options;
  const method = (rest.method || "GET").toUpperCase();
  const needsCsrf =
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/register");
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(needsCsrf && state.csrfToken
        ? { "X-CSRF-Token": state.csrfToken }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    payload = {
      success: false,
      message: "The server returned an unexpected response.",
    };
  }
  if (!response.ok || payload.success === false) {
    if (
      response.status === 401 &&
      !path.startsWith("/auth/login") &&
      !path.startsWith("/auth/register")
    )
      showLogin();
    throw new Error(payload.message || `Request failed (${response.status}).`);
  }
  return payload.data;
}

const auth = { mode: "login", hasUsers: true };
function setAuthMode(mode) {
  auth.mode = mode;
  const registering = mode === "register";
  $$("[data-register-only]").forEach((node) => {
    node.hidden = !registering;
  });
  const form = $("#loginForm");
  form.elements.confirmPassword.required = registering;
  form.elements.password.autocomplete = registering
    ? "new-password"
    : "current-password";
  form.elements.password.minLength = registering ? 8 : 0;
  $("#loginSubmit").firstChild.textContent = registering
    ? auth.hasUsers
      ? "Create staff account "
      : "Create administrator account "
    : "Open distribution desk ";
  const toggle = $("#authModeToggle");
  toggle.hidden = !auth.hasUsers;
  toggle.textContent = registering
    ? "Already have an account? Sign in"
    : "New here? Create a read-only staff account";
  $("#loginFootnote").textContent = registering
    ? auth.hasUsers
      ? "New accounts can view everything but not change it"
      : "You are the first user, so you will be the administrator"
    : "Staff and administrators";
}
async function refreshAuthMode() {
  try {
    const status = await api("/auth/status");
    auth.hasUsers = status.hasUsers;
  } catch (_) {
    auth.hasUsers = true;
  }
  setAuthMode(auth.hasUsers ? auth.mode : "register");
}
function showLogin(errorMessage = "") {
  $("#appShell").hidden = true;
  $("#loginView").hidden = false;
  $("#loginError").textContent = errorMessage;
  $("#loginError").hidden = !errorMessage;
  document.body.classList.remove("is-staff");
  state.admin = null;
  state.csrfToken = null;
  void refreshAuthMode();
}
function showApp(admin) {
  state.admin = admin;
  state.csrfToken = admin?.csrfToken || null;
  $("#loginView").hidden = true;
  $("#appShell").hidden = false;
  const name = admin?.fullName || admin?.username || "User";
  const isAdmin = admin?.role === "admin";
  document.body.classList.toggle("is-staff", !isAdmin);
  $("#teamNav").hidden = !isAdmin;
  $("#rolePill").textContent = isAdmin ? "Administrator" : "Read-only staff";
  $("#adminName").textContent = name;
  $("#greetingName").textContent = name;
  $("#todayLabel").textContent = new Date()
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
  switchView("dashboard");
}

function switchView(view) {
  const target = $(`#view-${view}`);
  if (!target) return;
  state.view = view;
  $$(".page-view").forEach((section) => {
    section.classList.toggle("is-visible", section.id === `view-${view}`);
    section.hidden = section.id !== `view-${view}`;
  });
  $$(".nav-link").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const active = $(`.nav-link[data-view="${view}"]`);
  $("#currentSection").textContent =
    active?.querySelector("span:nth-child(2)")?.textContent || "Overview";
  $("#sidebar").classList.remove("is-open");
  $("#menuButton").setAttribute("aria-expanded", "false");
  if (view === "team") loadTeam();
  if (view === "dashboard") loadDashboard();
  if (view === "suppliers") loadSuppliers();
  if (view === "fruits") loadFruits();
  if (view === "stock") loadStock();
  if (view === "vendors") loadVendors();
  if (view === "purchases") {
    loadSuppliers();
    loadPurchases();
    if (!$("#purchaseItems").children.length) addPurchaseRow();
  }
  if (view === "sales") {
    loadSalesDesk();
    if (!$("#saleItems").children.length) addSaleRow();
  }
  if (view === "reports") loadReports();
}

async function loadTeam() {
  try {
    const users = await api("/auth/users");
    $("#teamTable").innerHTML = users
      .map((user) => {
        const self = user.username === state.admin?.username;
        const next = user.role === "admin" ? "staff" : "admin";
        const action = self
          ? '<span class="row-sub">This is you</span>'
          : `<button class="text-link" data-set-role="${user.user_id}" data-role="${next}">${next === "admin" ? "Make administrator" : "Make read-only"}</button>`;
        return `<tr><td>${escapeHtml(user.full_name || "—")}</td><td>${escapeHtml(user.username)}</td><td><span class="status-badge ${user.role === "admin" ? "" : "status-badge--unpaid"}">${user.role === "admin" ? "ADMIN" : "STAFF"}</span></td><td>${escapeHtml(shortDate(user.created_at))}</td><td>${action}</td></tr>`;
      })
      .join("");
  } catch (error) {
    showToast(error.message, "error");
  }
}
async function loadLookups() {
  const [fruits, suppliers, vendors, stock] = await Promise.all([
    api("/fruits"),
    api("/suppliers"),
    api("/vendors"),
    api("/stock"),
  ]);
  state.fruits = fruits;
  state.suppliers = suppliers;
  state.vendors = vendors;
  state.stock = stock;
  $("#supplierCount").textContent = suppliers.length;
  renderSupplierOptions();
  renderVendorOptions();
}
function renderSupplierOptions() {
  const select = $("#purchaseSupplier");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">Choose supplier</option>${state.suppliers.map((item) => `<option value="${item.supplier_id}">${escapeHtml(item.business_name)} · ${escapeHtml(item.province)}</option>`).join("")}`;
  if (current) select.value = current;
}
function renderVendorOptions() {
  const select = $("#saleVendor");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">Choose vendor</option>${state.vendors.map((item) => `<option value="${item.vendor_id}">${escapeHtml(item.vendor_name)} · ${escapeHtml(item.location || "Lesotho")}</option>`).join("")}`;
  if (current) select.value = current;
}
function activeFruitOptions() {
  return state.fruits.filter((fruit) => fruit.status === "ACTIVE");
}
function fruitSelectOptions() {
  return `<option value="">Choose fruit</option>${activeFruitOptions()
    .map(
      (fruit) =>
        `<option value="${fruit.fruit_id}">${escapeHtml(fruit.fruit_name)}</option>`,
    )
    .join("")}`;
}
function stockRow(fruitId, size) {
  return state.stock.find(
    (row) =>
      Number(row.fruit_id) === Number(fruitId) && row.packaging_size === size,
  );
}

async function loadDashboard() {
  $("#revenueChart").innerHTML = loadingNote("Loading revenue trend…");
  $("#fruitChart").innerHTML = loadingNote("Loading top fruit lines…");
  $("#dashboardLowStock").innerHTML = loadingNote("Checking stock levels…");
  try {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    const [stock, fruits, outstanding, trend, revenue] = await Promise.all([
      api("/stock"),
      api("/reports/top-fruits"),
      api("/vendors/outstanding"),
      api(
        `/reports/revenue-trend?from=${localISODate(from)}&to=${localISODate()}`,
      ),
      api(`/reports/revenue?from=${monthStart()}&to=${localISODate()}`),
    ]);
    state.stock = stock;
    state.outstanding = outstanding;
    const total = stock.reduce(
      (sum, row) => sum + Number(row.available_quantity),
      0,
    );
    const low = stock.filter(
      (row) =>
        Number(row.available_quantity) <= Number(row.low_stock_threshold),
    );
    const open = outstanding.reduce(
      (sum, row) => sum + Number(row.outstanding_balance),
      0,
    );
    $("#kpiStock").textContent = total.toLocaleString("en-LS");
    $("#kpiStockSub").textContent = `${stock.length} fruit / size cards`;
    $("#kpiLow").textContent = low.length;
    $("#kpiLowSub").textContent = low.length
      ? "At or below restock threshold"
      : "All stock cards are healthy";
    $("#lowStockCount").textContent = low.length;
    $("#kpiRevenue").textContent = money(revenue.revenue);
    $("#kpiOutstanding").textContent = money(open);
    $("#kpiOutstandingSub").textContent =
      `${outstanding.length} vendor account${outstanding.length === 1 ? "" : "s"} to follow up`;
    renderRevenueChart(trend.points);
    renderFruitChart(fruits);
    renderLowStock(low.slice(0, 5), $("#dashboardLowStock"));
  } catch (error) {
    $("#revenueChart").innerHTML = errorNote("Revenue trend is unavailable.");
    $("#fruitChart").innerHTML = errorNote("Top fruit lines are unavailable.");
    $("#dashboardLowStock").innerHTML = errorNote(
      "Stock watch is unavailable.",
    );
    showToast(error.message, "error");
  }
}
function renderLowStock(rows, target) {
  if (!rows.length) {
    target.innerHTML =
      '<div class="empty-note">No low-stock cards. The shelves are looking good.</div>';
    return;
  }
  target.innerHTML = rows
    .map(
      (row) =>
        `<div class="compact-row"><div class="compact-fruit"><span class="fruit-orb">${escapeHtml(row.fruit_name.slice(0, 1))}</span><span><strong>${escapeHtml(row.fruit_name)}</strong><small>${escapeHtml(row.packaging_size)} · threshold ${row.low_stock_threshold}</small></span></div><span class="stock-chip stock-chip--low"><b>${row.available_quantity}</b> left</span></div>`,
    )
    .join("");
}
function renderFruitChart(rows) {
  const target = $("#fruitChart");
  if (!rows.length) {
    target.innerHTML = '<div class="empty-note">No sales recorded yet.</div>';
    return;
  }
  const max = Math.max(...rows.map((row) => Number(row.quantity_sold)), 1);
  target.innerHTML = rows
    .slice(0, 5)
    .map(
      (row) =>
        `<div class="fruit-row"><span class="fruit-row-name">${escapeHtml(row.fruit_name)}</span><span class="fruit-bar-track"><span class="fruit-bar" style="display:block;width:${Math.max(3, (Number(row.quantity_sold) / max) * 100)}%"></span></span><span class="fruit-row-value">${row.quantity_sold}</span></div>`,
    )
    .join("");
}
function renderRevenueChart(points) {
  const target = $("#revenueChart");
  if (!points?.length) {
    target.innerHTML =
      '<div class="chart-empty">No sales in this 30-day window.</div>';
    return;
  }
  const values = points.map((point) => Number(point.revenue));
  const max = Math.max(...values, 1);
  const minY = 20;
  const maxY = 145;
  const left = 38;
  const right = 570;
  const width = right - left;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const coords = values.map((value, index) => ({
    x: values.length > 1 ? left + index * step : left + width / 2,
    y: maxY - (value / max) * (maxY - minY),
    value,
  }));
  const path = coords
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${path} L ${coords.at(-1).x} ${maxY} L ${coords[0].x} ${maxY} Z`;
  const first = shortDate(points[0].revenue_date);
  const last = shortDate(points.at(-1).revenue_date);
  target.innerHTML = `<svg viewBox="0 0 600 190" role="img" aria-label="Daily sales revenue from ${escapeHtml(first)} to ${escapeHtml(last)}"><defs><linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e98335" stop-opacity=".2"/><stop offset="1" stop-color="#e98335" stop-opacity="0"/></linearGradient></defs><line class="chart-gridline" x1="35" y1="30" x2="580" y2="30"/><line class="chart-gridline" x1="35" y1="87" x2="580" y2="87"/><line class="chart-gridline" x1="35" y1="145" x2="580" y2="145"/><path class="chart-fill" d="${area}"/><path class="chart-line" d="${path}"/>${coords.map((point) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="3.5"><title>${escapeHtml(money(point.value))}</title></circle>`).join("")}<text class="chart-label" x="35" y="174">${escapeHtml(first)}</text><text class="chart-label" x="580" y="174" text-anchor="end">${escapeHtml(last)}</text><text class="chart-value" x="580" y="20" text-anchor="end">${escapeHtml(money(max))}</text></svg>`;
}

async function loadSuppliers() {
  $("#suppliersTable").innerHTML = loadingRow(5, "Loading suppliers…");
  try {
    state.suppliers = await api("/suppliers");
    $("#supplierMeta").textContent = `${state.suppliers.length} PARTNERS`;
    $("#supplierCount").textContent = state.suppliers.length;
    $("#suppliersTable").innerHTML = state.suppliers.length
      ? state.suppliers
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.business_name)}<span class="row-sub">${escapeHtml(row.address || "Address not provided")}</span></td><td>${escapeHtml(row.contact_person)}</td><td>${escapeHtml(row.province)}</td><td>${escapeHtml(row.phone)}</td><td><div class="row-actions"><button class="icon-action" data-edit="supplier" data-id="${row.supplier_id}" aria-label="Edit ${escapeHtml(row.business_name)}">✎</button><button class="icon-action icon-action--danger" data-delete-supplier="${row.supplier_id}" aria-label="Delete ${escapeHtml(row.business_name)}">×</button></div></td></tr>`,
          )
          .join("")
      : emptyRow(5, "No suppliers yet. Add the first partner.");
    renderSupplierOptions();
  } catch (error) {
    $("#suppliersTable").innerHTML = emptyRow(
      5,
      "Could not load suppliers. Check the connection and refresh.",
    );
    showToast(error.message, "error");
  }
}
async function loadFruits() {
  $("#fruitsTable").innerHTML = loadingRow(4, "Loading fruit catalog…");
  try {
    state.fruits = await api("/fruits");
    $("#fruitMeta").textContent = `${state.fruits.length} FRUIT LINES`;
    $("#fruitsTable").innerHTML = state.fruits.length
      ? state.fruits
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.fruit_name)}</td><td>${escapeHtml(row.description || "—")}</td><td><span class="status-badge ${row.status === "ACTIVE" ? "" : "status-badge--unpaid"}">${escapeHtml(row.status)}</span></td><td><div class="row-actions"><button class="icon-action" data-edit="fruit" data-id="${row.fruit_id}" aria-label="Edit ${escapeHtml(row.fruit_name)}">✎</button></div></td></tr>`,
          )
          .join("")
      : emptyRow(4, "No fruit lines yet.");
  } catch (error) {
    $("#fruitsTable").innerHTML = emptyRow(
      4,
      "Could not load fruit catalog. Check the connection and refresh.",
    );
    showToast(error.message, "error");
  }
}
function emptyRow(columns, message) {
  return `<tr><td colspan="${columns}"><div class="empty-note">${escapeHtml(message)}</div></td></tr>`;
}
function loadingRow(columns, message) {
  return `<tr><td colspan="${columns}">${loadingNote(message)}</td></tr>`;
}
function loadingNote(message) {
  return `<div class="loading-note" role="status"><span class="loading-spinner" aria-hidden="true"></span><span>${escapeHtml(message)}</span></div>`;
}
function errorNote(message) {
  return `<div class="empty-note" role="alert">${escapeHtml(message)}</div>`;
}
async function loadStock() {
  $("#stockGrid").innerHTML = loadingNote("Loading stock by package size…");
  try {
    state.stock = await api("/stock");
    const total = state.stock.reduce(
      (sum, row) => sum + Number(row.available_quantity),
      0,
    );
    $("#stockTotalLabel").textContent =
      `${total.toLocaleString("en-LS")} BOXES`;
    const byFruit = new Map();
    for (const row of state.stock) {
      if (!byFruit.has(row.fruit_id))
        byFruit.set(row.fruit_id, { name: row.fruit_name, rows: {} });
      byFruit.get(row.fruit_id).rows[row.packaging_size] = row;
    }
    $("#stockGrid").innerHTML =
      [...byFruit.entries()]
        .map(
          ([fruitId, group]) =>
            `<article class="stock-card"><div class="stock-card-head"><h2>${escapeHtml(group.name)}</h2><small>STOCK CARD ${String(fruitId).padStart(2, "0")}</small></div><div class="stock-size-header"><span>SMALL</span><span>MEDIUM</span><span>LARGE</span></div><div class="stock-size-row">${SIZES.map(
              (size) => {
                const row = group.rows[size];
                if (!row)
                  return `<div class="stock-size-cell"><small>${size}</small><strong>—</strong><span class="threshold-note">Not stocked yet</span></div>`;
                const low =
                  Number(row.available_quantity) <=
                  Number(row.low_stock_threshold);
                return `<div class="stock-size-cell${low ? " is-low" : ""}"><small>${size} ${low ? "· LOW" : ""}</small><strong>${row.available_quantity}</strong><button class="stock-price-button" data-edit-stock="${row.stock_id}" aria-label="Edit ${escapeHtml(group.name)} ${size} price">${escapeHtml(money(row.selling_price))} / price</button><span class="threshold-note">Restock at ${row.low_stock_threshold}</span></div>`;
              },
            ).join("")}</div></article>`,
        )
        .join("") ||
      '<div class="panel empty-note">No stock records yet.</div>';
    $("#lowStockCount").textContent = state.stock.filter(
      (row) =>
        Number(row.available_quantity) <= Number(row.low_stock_threshold),
    ).length;
  } catch (error) {
    $("#stockGrid").innerHTML = errorNote(
      "Stock cards are unavailable. Check the connection and refresh.",
    );
    showToast(error.message, "error");
  }
}
async function loadVendors(query = "") {
  $("#vendorsTable").innerHTML = loadingRow(6, "Loading vendors…");
  $("#outstandingTable").innerHTML = loadingRow(3, "Loading balances…");
  try {
    const path = query
      ? `/vendors/search?q=${encodeURIComponent(query)}`
      : "/vendors";
    const [vendors, outstanding] = await Promise.all([
      api(path),
      api("/vendors/outstanding"),
    ]);
    state.vendors = query ? state.vendors : vendors;
    state.outstanding = outstanding;
    const balanceByVendor = new Map(
      outstanding.map((row) => [
        Number(row.vendor_id),
        Number(row.outstanding_balance),
      ]),
    );
    $("#vendorsTable").innerHTML = vendors.length
      ? vendors
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.vendor_name)}</td><td>${escapeHtml(row.location || "—")}</td><td>${escapeHtml(row.phone_number)}</td><td class="${(balanceByVendor.get(Number(row.vendor_id)) || 0) > 0 ? "outstanding-row" : ""}">${escapeHtml(money(balanceByVendor.get(Number(row.vendor_id)) || 0))}</td><td>${escapeHtml(shortDate(row.registration_date))}</td><td><div class="row-actions"><button class="icon-action" data-edit="vendor" data-id="${row.vendor_id}" aria-label="Edit ${escapeHtml(row.vendor_name)}">✎</button></div></td></tr>`,
          )
          .join("")
      : emptyRow(
          6,
          query
            ? "No vendors match that search."
            : "No vendors registered yet.",
        );
    $("#outstandingTable").innerHTML = outstanding.length
      ? outstanding
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.vendor_name)}</td><td>${escapeHtml(row.phone_number)}</td><td class="outstanding-row">${escapeHtml(money(row.outstanding_balance))}</td></tr>`,
          )
          .join("")
      : emptyRow(3, "All vendor balances are settled.");
    renderVendorOptions();
  } catch (error) {
    $("#vendorsTable").innerHTML = emptyRow(
      6,
      "Could not load vendors. Check the connection and refresh.",
    );
    $("#outstandingTable").innerHTML = emptyRow(
      3,
      "Could not load balances. Check the connection and refresh.",
    );
    showToast(error.message, "error");
  }
}
async function loadPurchases() {
  $("#purchasesTable").innerHTML = loadingRow(5, "Loading purchase history…");
  try {
    const rows = await api("/purchases");
    state.purchases = rows;
    $("#purchasesTable").innerHTML = rows.length
      ? rows
          .slice(0, 15)
          .map(
            (row) =>
              `<tr><td class="table-strong">PO-${String(row.purchase_id).padStart(4, "0")}</td><td>${escapeHtml(row.supplier_name)}</td><td>${escapeHtml(shortDate(row.purchase_date))}</td><td>${row.item_count}</td><td class="table-strong">${escapeHtml(money(row.total_amount))}</td></tr>`,
          )
          .join("")
      : emptyRow(5, "No receipts recorded yet.");
  } catch (error) {
    $("#purchasesTable").innerHTML = emptyRow(
      5,
      "Could not load purchases. Check the connection and refresh.",
    );
    showToast(error.message, "error");
  }
}
async function loadSales() {
  $("#salesTable").innerHTML = loadingRow(7, "Loading sales history…");
  try {
    state.sales = await api("/sales");
    $("#salesMeta").textContent = `${state.sales.length} SALES`;
    $("#salesTable").innerHTML = state.sales.length
      ? state.sales
          .map((row) => {
            const statusClass =
              row.payment_status === "PAID"
                ? ""
                : row.payment_status === "PARTIALLY_PAID"
                  ? "status-badge--partial"
                  : "status-badge--unpaid";
            return `<tr><td class="table-strong">SL-${String(row.sale_id).padStart(4, "0")}</td><td>${escapeHtml(row.vendor_name)}</td><td>${escapeHtml(shortDate(row.sale_date))}</td><td>${escapeHtml(money(row.total_amount))}</td><td>${escapeHtml(money(row.amount_paid))}</td><td><span class="status-badge ${statusClass}">${escapeHtml(row.payment_status.replace("_", " "))}</span></td><td>${Number(row.total_amount) > Number(row.amount_paid) ? `<button class="text-link" data-record-payment="${row.sale_id}" data-due="${Number(row.total_amount) - Number(row.amount_paid)}">Record payment</button>` : ""}</td></tr>`;
          })
          .join("")
      : emptyRow(7, "No sales recorded yet.");
  } catch (error) {
    $("#salesTable").innerHTML = emptyRow(
      7,
      "Could not load sales. Check the connection and refresh.",
    );
    showToast(error.message, "error");
  }
}
async function loadSalesDesk() {
  try {
    await loadLookups();
    await loadSales();
  } catch (error) {
    showToast(error.message, "error");
  }
}
async function loadReports() {
  $("#reportFruitsTable").innerHTML = loadingRow(2, "Loading fruit report…");
  $("#reportStockTable").innerHTML = loadingRow(4, "Loading stock report…");
  $("#topVendorName").textContent = "Loading…";
  $("#topVendorBoxes").textContent = "Retrieving purchase totals";
  $("#reportRevenue").textContent = "Loading…";
  $("#reportWindow").textContent = "Retrieving date-range revenue";
  try {
    const fromInput = $('#reportForm [name="from"]');
    const toInput = $('#reportForm [name="to"]');
    if (!fromInput.value) fromInput.value = monthStart();
    if (!toInput.value) toInput.value = localISODate();
    const [fruits, vendor, stock] = await Promise.all([
      api("/reports/top-fruits"),
      api("/reports/top-vendor"),
      api("/reports/stock-levels"),
    ]);
    $("#reportFruitsTable").innerHTML = fruits.length
      ? fruits
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.fruit_name)}</td><td class="table-strong">${row.quantity_sold}</td></tr>`,
          )
          .join("")
      : emptyRow(2, "No sales recorded.");
    $("#topVendorName").textContent = vendor?.vendor_name || "No vendor yet";
    $("#topVendorBoxes").textContent = vendor
      ? `${vendor.boxes_purchased} boxes purchased from Batloung`
      : "No purchases recorded";
    $("#reportStockTable").innerHTML = stock.length
      ? stock
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.fruit_name)}</td><td>${escapeHtml(row.packaging_size)}</td><td class="table-strong">${row.available_quantity}</td><td><span class="status-badge ${row.is_low_stock ? "status-badge--partial" : ""}">${row.is_low_stock ? "LOW" : "OK"}</span></td></tr>`,
          )
          .join("")
      : emptyRow(4, "No stock records.");
    await runRevenueReport();
  } catch (error) {
    $("#reportFruitsTable").innerHTML = emptyRow(
      2,
      "Could not load fruit report. Check the connection and refresh.",
    );
    $("#reportStockTable").innerHTML = emptyRow(
      4,
      "Could not load stock report. Check the connection and refresh.",
    );
    $("#topVendorName").textContent = "Unavailable";
    $("#topVendorBoxes").textContent = "Could not load the report";
    $("#reportRevenue").textContent = "Unavailable";
    $("#reportWindow").textContent = "Could not load the date-range report";
    showToast(error.message, "error");
  }
}
async function runRevenueReport() {
  const form = $("#reportForm");
  const from = form.elements.from.value;
  const to = form.elements.to.value;
  $("#reportRevenue").textContent = "Loading…";
  $("#reportWindow").textContent =
    `${shortDate(from)} — ${shortDate(to)} · retrieving`;
  const [revenue, trend] = await Promise.all([
    api(
      `/reports/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
    api(
      `/reports/revenue-trend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  ]);
  $("#reportRevenue").textContent = money(revenue.revenue);
  $("#reportWindow").textContent =
    `${shortDate(from)} — ${shortDate(to)} · sales value`;
}

function renderItemRow(type) {
  const isPurchase = type === "purchase";
  const row = document.createElement("div");
  row.className = `item-row item-row--${type}`;
  if (isPurchase) {
    row.innerHTML = `<div class="item-fruit-size"><select name="fruit_id" class="fruit-choice" aria-label="Fruit" required>${fruitSelectOptions()}</select><select name="packaging_size" aria-label="Packaging size" required>${SIZES.map((size) => `<option value="${size}">${size}</option>`).join("")}</select></div><input name="quantity" type="number" min="1" step="1" value="1" aria-label="Quantity" required><input name="unit_cost" type="number" min="0" step="0.01" value="0" aria-label="Unit cost in Maloti" required><button type="button" class="item-remove" aria-label="Remove line">×</button>`;
  } else {
    row.innerHTML = `<div class="item-fruit-size"><select name="fruit_id" class="fruit-choice" aria-label="Fruit" required>${fruitSelectOptions()}</select><select name="packaging_size" aria-label="Packaging size" required>${SIZES.map((size) => `<option value="${size}">${size}</option>`).join("")}</select></div><input name="quantity" type="number" min="1" step="1" value="1" aria-label="Quantity" required><span class="sale-line-hint">Choose a stock line</span><button type="button" class="item-remove" aria-label="Remove line">×</button>`;
  }
  row.addEventListener("input", () =>
    isPurchase ? updatePurchaseTotal() : updateSaleTotal(),
  );
  row.addEventListener("change", () =>
    isPurchase ? updatePurchaseTotal() : updateSaleTotal(),
  );
  row.querySelector(".item-remove").addEventListener("click", () => {
    if (row.parentElement.children.length === 1) {
      showToast("Keep at least one item line in the form.", "error");
      return;
    }
    row.remove();
    isPurchase ? updatePurchaseTotal() : updateSaleTotal();
  });
  return row;
}
function addPurchaseRow() {
  $("#purchaseItems").append(renderItemRow("purchase"));
  updatePurchaseTotal();
}
function addSaleRow() {
  $("#saleItems").append(renderItemRow("sale"));
  updateSaleTotal();
}
function updatePurchaseTotal() {
  const total = $$("#purchaseItems .item-row").reduce(
    (sum, row) =>
      sum +
      Number(row.querySelector('[name="quantity"]').value || 0) *
        Number(row.querySelector('[name="unit_cost"]').value || 0),
    0,
  );
  $("#purchaseTotal").textContent = money(total);
}
function updateSaleTotal() {
  let total = 0;
  const rows = $$("#saleItems .item-row");
  const requestedByStockKey = new Map();
  rows.forEach((row) => {
    const fruitId = row.querySelector('[name="fruit_id"]').value;
    const size = row.querySelector('[name="packaging_size"]').value;
    const stock = fruitId ? stockRow(fruitId, size) : null;
    if (!stock) return;
    const key = `${fruitId}:${size}`;
    const quantity = Number(row.querySelector('[name="quantity"]').value || 0);
    requestedByStockKey.set(
      key,
      (requestedByStockKey.get(key) || 0) + quantity,
    );
  });
  rows.forEach((row) => {
    const fruitId = row.querySelector('[name="fruit_id"]').value;
    const size = row.querySelector('[name="packaging_size"]').value;
    const quantity = Number(row.querySelector('[name="quantity"]').value || 0);
    const hint = row.querySelector(".sale-line-hint");
    const stock = fruitId ? stockRow(fruitId, size) : null;
    if (stock) {
      const key = `${fruitId}:${size}`;
      const combinedQuantity = requestedByStockKey.get(key) || quantity;
      const short = combinedQuantity > Number(stock.available_quantity);
      const requestNote =
        combinedQuantity !== quantity
          ? ` · ${combinedQuantity} requested across lines`
          : "";
      hint.textContent = `${stock.available_quantity} available${requestNote} · ${money(stock.selling_price)} / box`;
      hint.classList.toggle("is-short", short);
      total += quantity * Number(stock.selling_price);
    } else {
      hint.textContent = fruitId
        ? "No stock card for this size"
        : "Choose a stock line";
      hint.classList.remove("is-short");
    }
  });
  $("#saleTotal").textContent = money(total);
}
function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function selectedItems(type) {
  return $$(`#${type}Items .item-row`).map((row) => {
    const item = {
      fruit_id: Number(row.querySelector('[name="fruit_id"]').value),
      packaging_size: row.querySelector('[name="packaging_size"]').value,
      quantity: Number(row.querySelector('[name="quantity"]').value),
    };
    if (type === "purchase")
      item.unit_cost = Number(row.querySelector('[name="unit_cost"]').value);
    return item;
  });
}

function openEditDialog(entity, id) {
  const list =
    entity === "supplier"
      ? state.suppliers
      : entity === "vendor"
        ? state.vendors
        : state.fruits;
  const row = list.find((item) => Number(item[`${entity}_id`]) === Number(id));
  if (!row) return;
  state.editing = { entity, id: Number(id), row };
  const fields = {
    supplier: [
      ["business_name", "Business name", "text"],
      ["contact_person", "Contact person", "text"],
      ["phone", "Phone", "tel"],
      [
        "province",
        "Province",
        "select",
        [
          "Gauteng",
          "Free State",
          "KwaZulu-Natal",
          "Western Cape",
          "Eastern Cape",
          "Limpopo",
          "Mpumalanga",
          "North West",
        ],
      ],
      ["address", "Address", "text"],
    ],
    vendor: [
      ["vendor_name", "Vendor name", "text"],
      ["phone_number", "Phone", "tel"],
      ["location", "Location", "text"],
    ],
    fruit: [
      ["fruit_name", "Fruit name", "text"],
      ["description", "Description", "text"],
      ["status", "Status", "select", ["ACTIVE", "INACTIVE"]],
    ],
  }[entity];
  $("#editDialogTitle").textContent = `Edit ${entity}`;
  $("#editFields").innerHTML = fields
    .map(([name, label, type, choices]) => {
      const control =
        type === "select"
          ? `<select name="${name}" required>${choices.map((value) => `<option value="${escapeHtml(value)}" ${row[name] === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>`
          : `<input name="${name}" type="${type}" value="${escapeHtml(row[name] || "")}" maxlength="${name === "description" ? 500 : 180}" ${["business_name", "contact_person", "phone", "phone_number", "vendor_name", "fruit_name"].includes(name) ? "required" : ""}>`;
      return `<label>${escapeHtml(label)}${control}</label>`;
    })
    .join("");
  $("#editDialog").showModal();
}
function openStockDialog(id) {
  const row = state.stock.find((item) => Number(item.stock_id) === Number(id));
  if (!row) return;
  $("#stockDialogTitle").textContent =
    `${row.fruit_name} · ${row.packaging_size}`;
  $("#stockForm").elements.stock_id.value = row.stock_id;
  $("#stockForm").elements.selling_price.value = Number(
    row.selling_price,
  ).toFixed(2);
  $("#stockForm").elements.low_stock_threshold.value = row.low_stock_threshold;
  $("#stockDialog").showModal();
}
function openPaymentDialog(saleId, amountDue) {
  $("#paymentForm").elements.sale_id.value = saleId;
  $("#paymentForm").elements.amount.max = Number(amountDue).toFixed(2);
  $("#paymentForm").elements.amount.value = "";
  $("#paymentSaleLabel").textContent =
    `Sale SL-${String(saleId).padStart(4, "0")} · balance ${money(amountDue)}`;
  $("#paymentDialog").showModal();
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const values = formObject(form);
    const registering = auth.mode === "register";
    if (registering && values.password !== values.confirmPassword)
      throw new Error("The two passwords do not match.");
    delete values.confirmPassword;
    if (!registering) delete values.fullName;
    const data = await api(registering ? "/auth/register" : "/auth/login", {
      method: "POST",
      body: values,
    });
    form.reset();
    showApp(data);
    await loadLookups().catch((error) => showToast(error.message, "error"));
  } catch (error) {
    showLogin(error.message);
  } finally {
    button.disabled = false;
  }
});
$("#authModeToggle").addEventListener("click", () => {
  $("#loginError").hidden = true;
  setAuthMode(auth.mode === "login" ? "register" : "login");
});
$("#logoutButton").addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (_) {
    /* Local UI still signs out if the server is unreachable. */
  }
  showLogin();
});
$("#mainNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) switchView(button.dataset.view);
});
document.addEventListener("click", (event) => {
  const viewLink = event.target.closest("[data-view-link]");
  if (viewLink) switchView(viewLink.dataset.viewLink);
  const opener = event.target.closest("[data-open-form]");
  if (opener) {
    const form = $(`#${opener.dataset.openForm}`);
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
    form?.querySelector("input")?.focus({ preventScroll: true });
  }
  const close = event.target.closest("[data-close-dialog]");
  if (close) close.closest("dialog")?.close();
  const edit = event.target.closest("[data-edit]");
  if (edit) openEditDialog(edit.dataset.edit, edit.dataset.id);
  const editStock = event.target.closest("[data-edit-stock]");
  if (editStock) openStockDialog(editStock.dataset.editStock);
  const recordPayment = event.target.closest("[data-record-payment]");
  if (recordPayment)
    openPaymentDialog(
      recordPayment.dataset.recordPayment,
      Number(recordPayment.dataset.due),
    );
  const setRole = event.target.closest("[data-set-role]");
  if (setRole) {
    api(`/auth/users/${setRole.dataset.setRole}/role`, {
      method: "PATCH",
      body: { role: setRole.dataset.role },
    })
      .then(() => {
        showToast("Role updated.");
        return loadTeam();
      })
      .catch((error) => showToast(error.message, "error"));
  }
  const deleteSupplier = event.target.closest("[data-delete-supplier]");
  if (deleteSupplier)
    void deleteSupplierById(deleteSupplier.dataset.deleteSupplier);
});
$("#menuButton").addEventListener("click", () => {
  const open = $("#sidebar").classList.toggle("is-open");
  $("#menuButton").setAttribute("aria-expanded", String(open));
});
$("#supplierForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/suppliers", {
      method: "POST",
      body: formObject(form),
    });
    form.reset();
    showToast("Supplier added to the partner list.");
    await loadSuppliers();
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#fruitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/fruits", {
      method: "POST",
      body: formObject(form),
    });
    form.reset();
    showToast("Fruit line added to the catalog.");
    await loadFruits();
    await loadLookups();
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#vendorForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/vendors", {
      method: "POST",
      body: formObject(form),
    });
    form.reset();
    showToast("Vendor registered.");
    await loadVendors();
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#vendorSearch").addEventListener("input", (event) => {
  const input = event.currentTarget;
  window.clearTimeout(input.searchTimer);
  input.searchTimer = window.setTimeout(
    () => loadVendors(input.value.trim()),
    220,
  );
});
$("#addPurchaseItem").addEventListener("click", addPurchaseRow);
$("#addSaleItem").addEventListener("click", addSaleRow);
$("#purchaseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const items = selectedItems("purchase");
    const body = {
      supplier_id: Number(form.elements.supplier_id.value),
      items,
    };
    const result = await api("/purchases", { method: "POST", body });
    showToast(
      `Purchase PO-${String(result.purchase_id).padStart(4, "0")} received; stock updated.`,
    );
    form.reset();
    $("#purchaseItems").innerHTML = "";
    addPurchaseRow();
    await Promise.all([loadLookups(), loadPurchases(), loadStock()]);
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#saleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const body = {
      vendor_id: Number(form.elements.vendor_id.value),
      items: selectedItems("sale"),
    };
    const amount = Number(form.elements.payment_amount.value || 0);
    if (amount > 0)
      body.payment = { amount, method: form.elements.payment_method.value };
    const result = await api("/sales", { method: "POST", body });
    showToast(
      `Sale SL-${String(result.sale_id).padStart(4, "0")} saved · ${money(result.total_amount)}.`,
    );
    form.reset();
    $("#saleItems").innerHTML = "";
    addSaleRow();
    await Promise.all([loadLookups(), loadSales(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const saleId = form.elements.sale_id.value;
  try {
    await api(`/sales/${saleId}/payments`, {
      method: "POST",
      body: {
        amount: Number(form.elements.amount.value),
        method: form.elements.method.value,
        reference: form.elements.reference.value || undefined,
      },
    });
    $("#paymentDialog").close();
    showToast("Payment recorded and balance updated.");
    await Promise.all([loadSales(), loadVendors(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#stockForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.elements.stock_id.value;
  try {
    await api(`/stock/${id}`, {
      method: "PUT",
      body: {
        selling_price: Number(form.elements.selling_price.value),
        low_stock_threshold: Number(form.elements.low_stock_threshold.value),
      },
    });
    $("#stockDialog").close();
    showToast("Stock card updated.");
    await Promise.all([loadStock(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.editing) return;
  const { entity, id } = state.editing;
  const endpoint =
    entity === "supplier"
      ? "suppliers"
      : entity === "vendor"
        ? "vendors"
        : "fruits";
  try {
    await api(`/${endpoint}/${id}`, {
      method: "PUT",
      body: formObject($("#editForm")),
    });
    $("#editDialog").close();
    showToast(`${entity[0].toUpperCase()}${entity.slice(1)} details updated.`);
    state.editing = null;
    if (entity === "supplier") await loadSuppliers();
    if (entity === "vendor") await loadVendors();
    if (entity === "fruit") {
      await loadFruits();
      await loadLookups();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});
$("#reportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await runRevenueReport();
    showToast("Revenue report refreshed.");
  } catch (error) {
    $("#reportRevenue").textContent = "Unavailable";
    $("#reportWindow").textContent = "Could not load the date-range report";
    showToast(error.message, "error");
  }
});

async function deleteSupplierById(id) {
  const row = state.suppliers.find(
    (supplier) => Number(supplier.supplier_id) === Number(id),
  );
  if (
    !row ||
    !window.confirm(
      `Delete ${row.business_name}? Suppliers with purchase history cannot be deleted.`,
    )
  )
    return;
  try {
    await api(`/suppliers/${id}`, { method: "DELETE" });
    showToast("Supplier deleted.");
    await loadSuppliers();
  } catch (error) {
    showToast(error.message, "error");
  }
}

$$("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }),
);

(async function initialize() {
  $("#todayLabel").textContent = new Date()
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
  $("#reportForm").elements.from.value = monthStart();
  $("#reportForm").elements.to.value = localISODate();
  try {
    const admin = await api("/auth/me");
    showApp(admin);
    await loadLookups().catch((error) => showToast(error.message, "error"));
  } catch (_) {
    showLogin();
  }
})();
