import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { io } = require('socket.io-client');
const port = Number(process.env.CYBERQUEST_VERIFY_PORT ?? 3100);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/main.js'], {
  cwd: new URL('../apps/server/', import.meta.url),
  env: { ...process.env, DATA_BACKEND: 'local', SERVER_PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Local server did not become healthy within 10 seconds.');
}

async function request(path, options = {}) {
  const response = await fetch(`${base}/api${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function socketEvent(token, event, action) {
  return new Promise((resolve, reject) => {
    const socket = io(`${base}/events`, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 5_000 });
    const timeout = setTimeout(() => { socket.close(); reject(new Error(`Timed out waiting for ${event}.`)); }, 8_000);
    socket.once('connect_error', (error) => { clearTimeout(timeout); socket.close(); reject(error); });
    socket.once('session.ready', async () => {
      try { await action(); } catch (error) { clearTimeout(timeout); socket.close(); reject(error); }
    });
    socket.once(event, (payload) => { clearTimeout(timeout); socket.close(); resolve(payload); });
  });
}

function rejectedSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${base}/events`, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 5_000 });
    let ready = false;
    const timeout = setTimeout(() => { socket.close(); resolve(!ready); }, 5_000);
    socket.once('session.ready', () => { ready = true; });
    socket.once('disconnect', () => { clearTimeout(timeout); socket.close(); resolve(!ready); });
    socket.once('connect_error', () => { clearTimeout(timeout); socket.close(); resolve(!ready); });
  });
}

try {
  await waitForHealth();
  const login = await request('/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@cyberquest.local', password: 'CyberQuest123!' }),
  });
  if (!login.response.ok || !login.body.accessToken) throw new Error('Demo login failed.');
  const token = login.body.accessToken;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const [challenges, detail, skills, learning, invalidInput] = await Promise.all([
    request('/challenges', { headers }), request('/challenges/web-101', { headers }), request('/users/me/skills', { headers }), request('/learning/overview', { headers }),
    request('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo@cyberquest.local', password: 'CyberQuest123!', role: 'ADMIN' }) }),
  ]);
  if (!challenges.response.ok || !challenges.body.some((challenge) => challenge.slug === 'web-101')) throw new Error('Seeded challenges were not returned.');
  if (!detail.response.ok || Object.hasOwn(detail.body, 'flagHash')) throw new Error('Challenge detail leaked a flag hash.');
  if (!skills.response.ok || !Array.isArray(skills.body) || skills.body.length === 0) throw new Error('Skill progress was not returned.');
  if (!learning.response.ok || !Array.isArray(learning.body.courses) || !learning.body.courses.every((course) => Array.isArray(course.chapters) && typeof course.progress === 'number')) throw new Error('Learning contract is incomplete.');
  if (invalidInput.response.status !== 400) throw new Error('Unknown input property was not rejected.');

  const labEvent = await socketEvent(token, 'lab.status', async () => {
    const started = await request('/labs/start', { method: 'POST', headers, body: JSON.stringify({ challengeId: 'web-101' }) });
    if (!started.response.ok) throw new Error('Guided lab did not start.');
  });
  await request('/labs/web-101/stop', { method: 'POST', headers });
  if (labEvent.challengeRef !== 'web-101' || labEvent.session?.status !== 'RUNNING' || Object.keys(labEvent).some((key) => /flag|hash|token/i.test(key))) throw new Error('Realtime lab event was invalid or sensitive.');
  if (!(await rejectedSocket('invalid-token'))) throw new Error('Invalid realtime token was accepted.');

  console.log(JSON.stringify({ verified: true, challenges: challenges.body.length, skills: skills.body.length, courses: learning.body.courses.length, realtime: 'authenticated-and-private' }));
} finally {
  server.kill();
}
