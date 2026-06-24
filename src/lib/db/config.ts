export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "neondb";

  if (!host || !user || !password) {
    return "";
  }

  const ssl = process.env.DB_SSL === "true" ? "?sslmode=require" : "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${ssl}`;
}

export function isDbEnabled(): boolean {
  return Boolean(getDatabaseUrl());
}
