// Headless verification harness — runs in CI and locally (no browser needed).
// 1) syntax-check every JS file  2) validate manifest.json  3) assert router cascade.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { decideTransport } from './router.mjs';

const JS_FILES = [
  'content.js', 'background.js', 'crypto.js', 'localmodel.js',
  'panel.js', 'mist.js', 'os.js', 'popup.js', 'router.mjs'
];
let failures = 0;
const note = (ok, msg) => { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + msg); };

// 1) syntax check
for (const f of JS_FILES) {
  try {
    execFileSync('node', ['--check', f], { stdio: 'pipe' });
    note(true, 'syntax ' + f);
  } catch (e) {
    note(false, 'syntax ' + f + ' -> ' + e.message.split('\n')[0]);
  }
}

// 2) manifest valid + MV3 shape
try {
  const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
  note(m.manifest_version === 3, 'manifest is MV3');
  note(m.version === '0.5.0', 'manifest version 0.5.0');
  note(Array.isArray(m.permissions) && m.permissions.includes('identity'), 'manifest requests identity');
  note(!m.permissions.includes('scripting'), 'scripting permission dropped (least privilege)');
  note(m.host_permissions.includes('https://api.x.com/*'), 'host_permissions include api.x.com');
  note(!m.host_permissions.includes('https://api.twitter.com/*'), 'legacy api.twitter.com host removed');
  note(m.icons && m.icons['128'], 'manifest has icons');
  note(readdirSync('icons').length >= 4, 'icons/ has size variants');
  note(readdirSync('lib/twitter-text').length > 0, 'vendored twitter-text present');
  note(
    m.web_accessible_resources?.[0]?.resources?.includes('panel.js'),
    'panel.js is web-accessible for iframe modules'
  );
} catch (e) {
  note(false, 'manifest parse -> ' + e.message);
}

// 3) panel.html has .sidebar shell (neon frame + flash)
try {
  const html = readFileSync('panel.html', 'utf8');
  note(html.includes('class="sidebar"'), 'panel.html wraps UI in .sidebar');
  note(html.includes('id="toggle"'), 'panel has toggle control');
} catch (e) {
  note(false, 'panel.html -> ' + e.message);
}

// 4) content.js pin + click wiring
try {
  const c = readFileSync('content.js', 'utf8');
  note(c.includes('XGROK_PINNED_TWEET'), 'content posts pinned tweet events');
  note(c.includes('parseTweetFromArticle') || c.includes('resolveFocusedTweet'), 'content can resolve tweet ids');
  note(c.includes('xgrok-pinned'), 'content marks pinned articles');
} catch (e) {
  note(false, 'content.js checks -> ' + e.message);
}

// 5) panel queue + encrypt secrets + reply safety
try {
  const p = readFileSync('panel.js', 'utf8');
  note(p.includes('enqueue('), 'panel implements offline enqueue');
  note(p.includes('users/') && p.includes('/tweets'), 'contact reply resolves latest tweet id');
  note(p.includes('SAFE_AVATAR') || p.includes('createElement(\'img\')'), 'safe avatar DOM');
  note(p.includes('pinnedTweet.text'), 'Grok receives pinned tweet text');
  note(p.includes('grok-4-latest') || p.includes('grokModel'), 'uses grok-4 / model setting');
  note(p.includes('draft-edit') || p.includes('textarea'), 'editable post proposal');
  note(p.includes('isPageOrigin'), 'panel validates postMessage origin');
  const b = readFileSync('background.js', 'utf8');
  note(b.includes('xTokenEnc') || b.includes('encryptJSON'), 'background encrypts tokens');
  note(b.includes('xErrorMessage'), 'background parses X API errors');
  note(b.includes('280'), 'background enforces 280 char post limit');
  const pop = readFileSync('popup.js', 'utf8');
  note(pop.includes('encryptSecret'), 'popup encrypts xAI key');
  note(pop.includes('SSO_LOGIN'), 'popup can Sign in with X (SSO-first)');
} catch (e) {
  note(false, 'source contract checks -> ' + e.message);
}

// 6b) post payload contract
try {
  execFileSync('node', ['verify_post_payload.mjs'], { stdio: 'pipe' });
  note(true, 'verify_post_payload.mjs');
} catch (e) {
  note(false, 'verify_post_payload.mjs -> ' + (e.stdout || e.message).toString().slice(0, 120));
}

// 6) router cascade
const cases = [
  [{ online: true, hasCloudKey: true, channel: 'grok', localReady: true, mistReady: true, osReady: true }, 'cloud'],
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: true, mistReady: false, osReady: false }, 'local'],
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: true, mistReady: false, osReady: false }, 'local'],
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: false, mistReady: false, osReady: false }, 'queued'],
  [{ online: true, hasCloudKey: true, channel: 'mist', localReady: true, mistReady: true, osReady: true }, 'mist'],
  [{ online: true, hasCloudKey: true, channel: 'mist', localReady: true, mistReady: false, osReady: false }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'os', localReady: true, mistReady: true, osReady: true }, 'os'],
  [{ online: true, hasCloudKey: true, channel: 'os', localReady: true, mistReady: true, osReady: false }, 'mist'],
  // #local always attempts local (load-on-demand), even if not yet ready
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: false, mistReady: true, osReady: true }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: true, mistReady: true, osReady: true }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'grok', localReady: false, mistReady: true, osReady: false }, 'cloud'],
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: false, mistReady: true, osReady: false }, 'mist'],
];
for (const [input, expected] of cases) {
  const got = decideTransport(input);
  note(got === expected, 'route ' + JSON.stringify(input) + ' => ' + got + ' (exp ' + expected + ')');
}

console.log('\n' + (failures === 0 ? 'ALL GREEN' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
