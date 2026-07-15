// On-device fallback brain.
// MV3 FORBIDS remotely-hosted CODE, so the transformers.js LIB is vendored locally
// (npm i @xenova/transformers  ->  copy dist ESM to ./lib/transformers.js). Only the
// model WEIGHTS stream from HuggingFace at runtime — that's data, which is allowed.
// We import dynamically so a missing lib degrades to cloud-only instead of 404-breaking the panel.
let gen = null;
let loading = null;

export function isLocalReady() { return !!gen; }

export async function loadLocalModel() {
  if (gen) return gen;
  if (loading) return loading;

  loading = (async () => {
    const { pipeline } = await import('./lib/transformers.js');
    try {
      gen = await pipeline('text-generation', 'Xenova/Qwen2.5-0.5B-Instruct', {
        device: 'webgpu', dtype: 'q4'
      });
    } catch (webgpuErr) {
      // WebGPU may be unavailable (e.g. old GPU); retry on WASM.
      gen = await pipeline('text-generation', 'Xenova/Qwen2.5-0.5B-Instruct', {
        device: 'wasm'
      });
    }
    return gen;
  })();

  try {
    return await loading;
  } catch (e) {
    loading = null; // allow retry after a failed download / import
    throw e;
  }
}

export async function localGenerate(messages) {
  const p = await loadLocalModel();
  // Cap context so tiny on-device models stay responsive
  const recent = messages.filter((m) => m.role !== 'system').slice(-12);
  const prompt = recent
    .map((m) => (m.role === 'user' ? 'User: ' : 'Grok: ') + m.content)
    .join('\n') + '\nGrok:';
  const out = await p(prompt, { max_new_tokens: 220, do_sample: false });
  return out[0].generated_text.replace(prompt, '').trim();
}
