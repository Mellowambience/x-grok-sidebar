// Headless verification of the bitchat-style transport router.
// No browser needed — stub nothing, just assert the pure decision logic.
import { decideTransport } from './router.mjs';

const cases = [
  // online + cloud key + grok channel + local available  -> cloud (preferred)
  [{ online: true, hasCloudKey: true, channel: 'grok', localReady: true }, 'cloud'],
  // cloud key missing, local ready                       -> local fallback (BLE->Nostr)
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: true }, 'local'],
  // offline, local ready, grok channel                   -> local (on-device works w/o net, bitchat-style)
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: true }, 'local'],
  // offline, NO local, grok channel                      -> queued (true store-and-forward)
  [{ online: false, hasCloudKey: false, channel: 'grok', localReady: false }, 'queued'],
  // no cloud key, no local, online                       -> queued (nothing to route)
  [{ online: true, hasCloudKey: false, channel: 'grok', localReady: false }, 'queued'],
  // #local channel, local ready                          -> local (private mesh)
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: true }, 'local'],
  // #local channel, local NOT ready                      -> queued
  [{ online: true, hasCloudKey: true, channel: 'local', localReady: false }, 'queued']
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
