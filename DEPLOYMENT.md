# Deployment guide

This app is a single Express service: it serves the dashboard and `/api` from the same origin, binds to `0.0.0.0`, and listens on the platform-provided `PORT`. It stores durable business data in MySQL, not in the container filesystem.

## 1. Push the code to GitHub

Create an empty GitHub repository; do not initialize it with a README or other files. From the project directory, check the existing remotes first so you do not replace a remote used by another service:

```sh
git remote -v
```

Add your GitHub repository as a separate remote and push the current `main` branch:

```sh
git remote add github https://github.com/OWNER/batloung-farm.git
git push -u github main
```

If a remote named `github` already exists, update it with `git remote set-url github https://github.com/OWNER/batloung-farm.git`. Authenticate with GitHub CLI or your configured Git credential manager. Check that `.env` is not staged; `.gitignore` excludes it. Keep `.env.example`, which contains placeholders only.

## 2. Prepare MySQL

Choose MySQL 8 on Aiven, Railway, or another managed provider. Create the database `batloung_farm_db` and a database user with permission to create/use the tables. Allow the deployed Express service to connect to the database endpoint. Use a private network connection when the application and database are on the same host and the provider supports it; otherwise use the provider's public endpoint with TLS.

Load schema, then seed, into the new database. For a remote endpoint, supply the provider's TLS/CA arguments to the MySQL client as required:

```sh
mysql --host=DB_HOST --port=DB_PORT --user=DB_USER --password batloung_farm_db < database/schema.sql
mysql --host=DB_HOST --port=DB_PORT --user=DB_USER --password batloung_farm_db < database/seed.sql
```

Enter the password at the prompt, not in a shared shell history. The seed inserts fixed demo rows; it does not reset or clear tables and is not idempotent. Run it only once in an empty/demo database, never in a populated production database. The app does not run schema changes on startup.

For Aiven, copy the service host, port and credentials from the Aiven service's connection information. Set `DB_SSL=true`. When using MySQL certificate modes that verify the Aiven CA/identity, download the project's CA certificate and provide its PEM contents as the protected `DB_SSL_CA` variable. `mysql2` is configured to verify TLS peers and accepts that CA value.

For a Railway MySQL service, set the application variables by referencing the database service's values. Exact service names depend on your Railway project; for a database service named `MySQL`, the reference pattern is:

```text
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

Use the private host when the services share a Railway project/network. Set `DB_SSL` according to the connection endpoint's requirements. If Railway has generated a database name other than `batloung_farm_db`, set the app's `DB_NAME` to that database and use schema/seed scripts accordingly.

## 3. Create deployment secrets

Use `.env.example` as the source of variable names, but add values only in the host's secret/environment settings. Required values are:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` and `DB_SSL`.
- No admin variables are needed: the first person to register on the live site becomes the administrator. Register yourself straight after deploying.
- A unique `JWT_SECRET` with at least 32 random characters; generate one locally with `openssl rand -hex 32`.
- `COOKIE_SECURE=true` and `NODE_ENV=production`.

Do not set `COOKIE_SECURE=false` on HTTPS Preview or a public HTTPS site. The app defaults to a `SameSite=None; Secure` cookie so the dashboard can run inside Preview's cross-site HTTPS iframe. Every authenticated state-changing request also requires a session-bound CSRF header; the browser client reads the token from the login/session response and sends it as `X-CSRF-Token`. `CORS_ORIGINS` can stay blank because the frontend and API share one origin. Set `COOKIE_SECURE=false` only when using plain HTTP on localhost. The platforms provide `PORT`; do not hardcode a cloud port. `DB_SSL_CA` is optional unless your MySQL provider requires a custom CA certificate.

## 4. Deploy to Render

1. In Render, create a **Web Service** connected to the GitHub repository and `main` branch. Choose the Docker runtime; the repository includes a root `Dockerfile`. No separate frontend build is needed.
2. Set the health check path to `/api/health`. The endpoint is public and returns the process status plus `database.connected`.
3. Add the environment variables and secrets listed above. Confirm they are present in the service's Environment page before the first deploy. Never add real values to `render.yaml`, Docker build arguments, or Git.
4. Create the service and follow its logs. The container installs production dependencies and starts `node server.js`; the server honors the `PORT` injected by Render and binds on `0.0.0.0`.
5. After the service is live, open `https://YOUR-SERVICE.onrender.com/api/health`. Confirm `success` is `true` and `database.connected` is `true`. Then open the root URL, sign in and verify inventory and reports.

`/api/health` is a liveness response so the HTTP process can stay available while the app logs/retries an unavailable MySQL connection. It does not mean data routes are ready. If `database.connected` is false, check the DB host/port/user/password/name, network allow-list, and TLS/CA settings. MySQL-dependent routes return HTTP 503 until a connection is restored.

## 5. Railway alternative

1. Create a project and deploy the GitHub repository as an application service. Railway can build from the included `Dockerfile`.
2. Add the database and application variables in the service Variables panel. If using Railway MySQL, map the database service variables to the `DB_*` names shown above. Set `NODE_ENV=production`, `COOKIE_SECURE=true` and `JWT_SECRET`.
3. Set the deployment healthcheck path to `/api/health`. The server listens on Railway's injected `PORT`.
4. Deploy the application and database. Load `database/schema.sql` and `database/seed.sql` into the application database once, then verify the health response and sign in through the public domain.

## 6. Post-deploy checks and GitHub updates

- Verify `/api/health` says `database.connected: true`.
- Sign in, view Stock and Reports, and create a small test purchase/sale only if this is a test database.
- Run the rollback demo against a fresh seed before other test purchases: `ADMIN_USERNAME=<admin username> ADMIN_PASSWORD='...' npm run test:demo`.
- For later source updates, commit and push to `github`; the connected host can redeploy from GitHub. Do not commit `.env`, password hashes for real accounts, database backups, or credential files.

## References

- [Node.js release status and LTS guidance](https://nodejs.org/en/about/previous-releases)
- [Render Web Services](https://render.com/docs/web-services), [Render environment variables](https://render.com/docs/configure-environment-variables), and [Render Health Checks](https://render.com/docs/health-checks)
- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks) and [Railway variables](https://docs.railway.com/variables)
- [Aiven TLS/SSL certificates](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
- [GitHub: adding locally hosted code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
