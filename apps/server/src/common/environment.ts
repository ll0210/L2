import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function applyEnvironmentFile(path: string) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    if (/^[A-Z][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Nest does not load .env files by itself. Load the server-scoped file before
 * choosing the repository, while preserving variables supplied by the host.
 */
export function loadRuntimeEnvironment() {
  const serverEnvFromRoot = join(process.cwd(), 'apps', 'server', '.env');
  const serverEnvFromModule = join(__dirname, '..', '.env');
  const cwdEnv = join(process.cwd(), '.env');
  for (const path of new Set([serverEnvFromRoot, serverEnvFromModule, cwdEnv])) applyEnvironmentFile(path);
}
