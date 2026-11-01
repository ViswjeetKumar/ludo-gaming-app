/** Pure configuration validation. Environment access belongs at the process boundary. */
export interface PublicRuntimeConfig {
  readonly environment: "development" | "staging" | "production";
  readonly port: number;
  readonly allowedOrigins: readonly string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError("PORT must be an integer from 1 through 65535.");
  }
  return port;
}

function parseOrigins(value: string | undefined, environment: PublicRuntimeConfig["environment"]): readonly string[] {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (environment === "production" && origins.length === 0) {
    throw new ConfigError("ALLOWED_ORIGINS is required in production.");
  }
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ConfigError("ALLOWED_ORIGINS must contain absolute URLs.");
    }
    if (parsed.protocol !== "https:" && environment === "production") {
      throw new ConfigError("Production allowed origins must use HTTPS.");
    }
    if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new ConfigError("Allowed origins must be bare origins without paths or credentials.");
    }
  }
  return Object.freeze([...new Set(origins)]);
}

/**
 * Deliberately excludes database URLs, KMS identities and every secret. Those
 * are parsed by role-specific process boundaries and must never be sent to a
 * client, log entry or health response.
 */
export function parsePublicRuntimeConfig(source: Readonly<Record<string, string | undefined>>): PublicRuntimeConfig {
  const rawEnvironment = source.NODE_ENV ?? "development";
  if (rawEnvironment !== "development" && rawEnvironment !== "staging" && rawEnvironment !== "production") {
    throw new ConfigError("NODE_ENV must be development, staging or production.");
  }

  return Object.freeze({
    environment: rawEnvironment,
    port: parsePort(source.PORT),
    allowedOrigins: parseOrigins(source.ALLOWED_ORIGINS, rawEnvironment),
  });
}
