// Headless verification of the bitchat-style transport router.
import { decideTransport } from './router.mjs';

const cases = [
  // online + cloud key + grok channel + local available  -> cloud
  [{ online: true, hasCloudKey: true, channel: 'grok', localReady: true }, 'cloud'],
  // cloud key missing, local ready                       -> local
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: true }, 'local'],
  // offline, local ready, grok channel                   -> local
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: true }, 'local'],
  // offline, NO local, grok channel                      -> queued
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: false }, 'queued'],
  // no cloud key, no local, online                       -> queued
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: false }, 'queued'],
  // #local channel always routes local (load-on-demand)
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: true }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: false }, 'local'],
  // mist / os
  [{ online: true, hasCloudKey: true, channel: 'mist', mistReady: true, localReady: false }, 'mist'],
  [{ online: true, hasCloudKey: true, channel: 'mist', mistReady: false, localReady: true }, 'local'],
  [{ online: true, hasCloudKey: true, channel: 'os', osReady: true }, 'os'],
  [{ online: true, hasCloudKey: true, channel: 'os', osReady: false, mistReady: true }, 'mist'],
];

let pass = 0;
for (const [input, expected] of cases) {
  const got = decideTransport(input);
  const ok = got === expected;
  pass += ok ? 1 : 0;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + JSON.stringify(input) + '  =>  ' + got + '  (exp ' + expected + ')');
}
console.log('\n' + pass + '/' + cases.length + ' passed');
process.exit(pass === cases.length ? 0 : 1);
