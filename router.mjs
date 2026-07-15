// bitchat-style smart transport selection, extended with MIST + OS.
// Channels:
//   '#grok' (cloud)  -> cascade: cloud -> MIST -> local -> queue
//   '#local'         -> on-device Qwen (always attempt; load on demand)
//   '#mist'          -> Aurelia, sovereign local soul
//   '#os'            -> local sovereign OS HUD/command-deck runtime
export function decideTransport({ online, hasCloudKey, channel, localReady, mistReady, osReady }) {
  if (channel === 'os') {
    return osReady ? 'os' : (mistReady ? 'mist' : (localReady ? 'local' : 'queued'));
  }
  if (channel === 'mist') {
    return mistReady ? 'mist' : (localReady ? 'local' : 'queued');
  }
  // #local always routes to local — panel loads the model on demand
  if (channel === 'local') return 'local';
  // default #grok channel
  if (hasCloudKey && online) return 'cloud';
  if (mistReady) return 'mist';
  if (localReady) return 'local';
  return 'queued';
}
