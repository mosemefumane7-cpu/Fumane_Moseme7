require("dotenv").config();

const baseUrl = (
  process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
).replace(/\/$/, "");
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

async function request(path, { method = "GET", body, cookie, csrfToken } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

async function main() {
  if (!username || !password)
    throw new Error(
      "Set ADMIN_USERNAME and ADMIN_PASSWORD in the shell before running this demo.",
    );
  const health = await request("/api/health");
  if (!health.response.ok || !health.payload.database?.connected) {
    throw new Error(
      `Database is not ready: ${health.payload.database?.message || health.payload.message}. Load schema.sql and seed.sql, then retry.`,
    );
  }

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  if (!login.response.ok)
    throw new Error(`Login failed: ${login.payload.message}`);
  const csrfToken = login.payload.data?.csrfToken;
  if (!csrfToken) throw new Error("Login did not return a session CSRF token.");
  const setCookie = login.response.headers.get("set-cookie");
  const cookie = setCookie?.split(";", 1)[0];
  if (!cookie)
    throw new Error("Login did not return the admin session cookie.");

  const beforeStock = await request("/api/stock", { cookie });
  const appleLarge = beforeStock.payload.data.find(
    (row) => row.fruit_name === "Apples" && row.packaging_size === "LARGE",
  );
  const appleSmall = beforeStock.payload.data.find(
    (row) => row.fruit_name === "Apples" && row.packaging_size === "SMALL",
  );
  const bananaSmall = beforeStock.payload.data.find(
    (row) => row.fruit_name === "Bananas" && row.packaging_size === "SMALL",
  );
  if (!appleLarge || !appleSmall || !bananaSmall)
    throw new Error("Seed stock is missing Apples or Bananas.");
  if (Number(appleLarge.available_quantity) !== 6) {
    throw new Error(
      `Expected Apples/LARGE stock to be 6 for this demo, found ${appleLarge.available_quantity}. Reload seed.sql in a clean database and run this demo before other purchases.`,
    );
  }

  const salesBefore = await request("/api/sales", { cookie });
  const saleIdsBefore = new Set(
    salesBefore.payload.data.map((sale) => Number(sale.sale_id)),
  );
  const response = await request("/api/sales", {
    method: "POST",
    cookie,
    csrfToken,
    body: {
      vendor_id: 1,
      items: [
        { fruit_id: appleSmall.fruit_id, packaging_size: "SMALL", quantity: 2 },
        {
          fruit_id: bananaSmall.fruit_id,
          packaging_size: "SMALL",
          quantity: 3,
        },
        {
          fruit_id: appleLarge.fruit_id,
          packaging_size: "LARGE",
          quantity: 10,
        },
      ],
    },
  });
  if (
    response.response.status !== 409 ||
    !/Requested 10 LARGE Apples, only 6 available/i.test(
      response.payload.message || "",
    )
  ) {
    throw new Error(
      `Expected the 409 shortage response; received ${response.response.status}: ${response.payload.message}`,
    );
  }

  const [afterStock, salesAfter] = await Promise.all([
    request("/api/stock", { cookie }),
    request("/api/sales", { cookie }),
  ]);
  const lookup = (rows, fruitName, size) =>
    Number(
      rows.find(
        (row) => row.fruit_name === fruitName && row.packaging_size === size,
      )?.available_quantity,
    );
  for (const [fruitName, size] of [
    ["Apples", "SMALL"],
    ["Bananas", "SMALL"],
    ["Apples", "LARGE"],
  ]) {
    if (
      lookup(beforeStock.payload.data, fruitName, size) !==
      lookup(afterStock.payload.data, fruitName, size)
    ) {
      throw new Error(
        `${fruitName}/${size} stock changed even though the sale failed.`,
      );
    }
  }
  const newSales = salesAfter.payload.data.filter(
    (sale) => !saleIdsBefore.has(Number(sale.sale_id)),
  );
  if (newSales.length)
    throw new Error("A sale row was created even though the request failed.");

  console.log("Rollback demonstration passed.");
  console.log(
    `Response: HTTP ${response.response.status} — ${response.payload.message}`,
  );
  console.log(
    "Verified: Apples/SMALL, Bananas/SMALL, and Apples/LARGE stock are unchanged; no sale row was added.",
  );
}

main().catch((error) => {
  console.error(`Rollback demonstration failed: ${error.message}`);
  process.exitCode = 1;
});
