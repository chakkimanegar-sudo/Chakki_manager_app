import { spawn, spawnSync } from 'node:child_process';

// Replit mobile preview needs three processes:
// 1) API server for /api/*
// 2) Web app that the WebView loads
// 3) Expo/Metro for Expo Go testing
// The old mobile script only started Expo, so the WebView could open while
// sync requests had no API behind the web server.
const expoPort = process.env.PORT || '8081';
const webPort = process.env.WEB_PORT || '3000';
const apiPort = process.env.API_PORT || '5000';
const basePath = process.env.BASE_PATH || '/';

const processes = [];
let shuttingDown = false;

function ensureDatabaseSchema() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Multi-device sync cannot start until a Replit database is provisioned.');
    return;
  }

  console.log('Checking Chakki Manager database schema...');
  const result = spawnSync(
    'pnpm',
    ['--filter', '@workspace/db', 'run', 'push'],
    { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error('Database schema setup failed. The API may not be able to save sync data.');
  }
}

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: false,
  });

  processes.push(child);

  child.on('error', (err) => {
    console.error(`${name} failed to start:`, err);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.log(`${name} stopped (${signal})`);
      return;
    }
    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code || 1);
    }
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));

ensureDatabaseSchema();

console.log(`Starting Chakki Manager API on port ${apiPort}...`);
start(
  'API',
  'pnpm',
  ['--filter', '@workspace/api-server', 'run', 'dev'],
  { PORT: apiPort },
);

console.log(`Starting Chakki Manager web app on port ${webPort}...`);
start(
  'Web',
  'pnpm',
  ['--filter', '@workspace/chakki-app', 'run', 'dev'],
  { PORT: webPort, BASE_PATH: basePath, API_PORT: apiPort },
);

console.log(`Starting Expo/Metro on port ${expoPort}...`);
start(
  'Expo',
  'pnpm',
  ['exec', 'expo', 'start', '--localhost', '--port', expoPort],
  {
    EXPO_PACKAGER_PROXY_URL: process.env.REPLIT_EXPO_DEV_DOMAIN
      ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
      : process.env.EXPO_PACKAGER_PROXY_URL,
    EXPO_PUBLIC_DOMAIN: process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN,
    EXPO_PUBLIC_REPL_ID: process.env.EXPO_PUBLIC_REPL_ID || process.env.REPL_ID,
    REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REACT_NATIVE_PACKAGER_HOSTNAME || process.env.REPLIT_DEV_DOMAIN,
  },
);

console.log(`Chakki Manager web: http://0.0.0.0:${webPort}`);
console.log(`Chakki Manager API: http://127.0.0.1:${apiPort}`);
console.log(`Expo/Metro: http://127.0.0.1:${expoPort}`);
