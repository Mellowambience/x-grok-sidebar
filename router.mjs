// bitchat-style smart transport selection, extended with MIST + OS.
// Channels:
//   '#grok' (cloud)  -> cascade: cloud -> MIST -> local -> queue
//   '#local'         -> generic on-device Qwen
//   '#mist'          -> Aurelia, sovereign local soul (preferred over generic local)
//   '#os'            -> local sovereign OS HUD/command-deck runtime
export function decideTransport({ online, hasCloudKey, channel, localReady, mistReady, osReady }) {
  if (channel === 'os') return osReady ? 'os' : (mistReady ? 'mist' : (localReady ? 'local' : 'queued'));
  if (channel === 'mist') return mistReady ? 'mist' : (localReady ? 'local' : 'queued');
  if (channel === 'local') return localReady ? 'local' : 'queued';
  // default #grok channel
  if (hasCloudKey && online) return 'cloud';
  if (mistReady) return 'mist';
  if (localReady) return 'local';
  return 'queued';
}
