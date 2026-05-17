import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const envPath = resolve(projectRoot, '.env');
const outputPath = resolve(projectRoot, 'public', 'env.js');

function parseEnv(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((env, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      env[key] = rawValue.replace(/^["']|["']$/g, '');
      return env;
    }, {});
}

let env = {};
try {
  env = parseEnv(readFileSync(envPath, 'utf8'));
} catch {
  env = {};
}

const runtimeEnv = {
  googleClientId: env.NG_APP_GOOGLE_CLIENT_ID ?? env.GOOGLE_CLIENT_ID ?? ''
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `window.__OMS_ENV__ = Object.freeze(${JSON.stringify(runtimeEnv, null, 2)});\n`
);

console.log('Generated public/env.js from frontend/.env');
