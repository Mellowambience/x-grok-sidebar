// Headless verification harness — runs in CI and locally (no browser needed).
// 1) syntax-check every JS file  2) validate manifest.json  3) assert router cascade.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { decideTransport } from './router.mjs';

const JS_FILES = ['content.js', 'background.js', 'crypto.js', 'localmodel.js', 'panel.js', 'mist.js', 'os.js', 'popup.js'];
let failures = 0;
const note = (ok, msg) => { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + msg); };

// 1) syntax check
for (const f of JS_FILES) {
  try { execFileSync('node', ['--check', f], { stdio: 'pipe' }); note(true, 'syntax ' + f); }
  catch (e) { note(false, 'syntax ' + f + ' -> ' + e.message.split('\n')[0]); }
}

// 2) manifest valid + MV3 shape
try {
  const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
  note(m.manifest_version === 3, 'manifest is MV3');
  note(Array.isArray(m.permissions) && m.permissions.includes('identity'), 'manifest requests identity');
  note(readdirSync('lib/twitter-text').length > 0, 'vendored twitter-text present');
} catch (e) { note(false, 'manifest parse -> ' + e.message); }

// 3) router cascade (matches current decideTransport signature)
const cases = [
  [{ online: true, hasCloudKey: true, channel: 'grok', localReady: true, mistReady: true, osReady: true }, 'cloud'],
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: true, mistReady: false, osReady: false }, 'local'],
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: true, mistReady: false, osReady: false }, 'local'],
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: false, mistReady: false, osReady: false }, 'queued'],
  [{ online: true, hasCloudKey: true, channel: 'mist', localReady: true, mistReady: true, osReady: true }, 'mist'],
  [{ online: true, hasCloudKey: true, channel: 'mist', localReady: true, mistReady: false, osReady: false }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'os', localReady: true, mistReady: true, osReady: true }, 'os'],
  [{ online: true, hasCloudKey: true, channel: 'os', localReady: true, mistReady: true, osReady: false }, 'mist'],
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: true, mistReady: true, osReady: true }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'grok', localReady: false, mistReady: true, osReady: false }, 'cloud'],
];
for (const [input, expected] of cases) {
  const got = decideTransport(input);
  note(got === expected, 'route ' + JSON.stringify(input) + ' => ' + got + ' (exp ' + expected + ')');
}

console.log('\n' + (failures === 0 ? 'ALL GREEN' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
