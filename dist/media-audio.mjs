function extractTrack(file, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./extract-worker.js', import.meta.url), {type:'module'});
    function cleanup() {
      worker.terminate();
      signal.removeEventListener('abort', cancel);
    }
    function cancel() {
      cleanup();
      reject(signal.reason);
    }
    signal.addEventListener('abort', cancel, {once:true});
    worker.onerror = () => {
      cleanup();
      reject(Error('Bộ tách âm thanh dừng bất ngờ. Hãy thử lại với file ngắn hơn.'));
    };
    worker.onmessage = ({data}) => {
      cleanup();
      if (data.error) reject(Error(data.error));
      else resolve(data);
    };
    worker.postMessage(file);
  });
}

async function decode(blob, signal) {
  const context = new OfflineAudioContext(1, 1, 16000);
  const bytes = await blob.arrayBuffer();
  signal.throwIfAborted();
  const audio = await context.decodeAudioData(bytes);
  signal.throwIfAborted();
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const samples = new Float32Array(audio.length);
  for (let ch = 0; ch < audio.numberOfChannels; ch++) {
    const channel = audio.getChannelData(ch);
    for (let i = 0; i < samples.length; i++) samples[i] += channel[i] / audio.numberOfChannels;
  }
  return samples;
}

export async function readMedia(file, signal, onExtract) {
  const video = file.type.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm|m4v|mpg|mpeg|mts|m2ts|wmv|flv|3gp|ts|vob)$/i.test(file.name || '');
  if (!video) {
    try {
      const samples = await decode(file, signal);
      if (samples.some(value => Math.abs(value) > 0.0001)) return {samples};
    } catch {
      signal.throwIfAborted();
    }
  }
  onExtract();
  try {
    return await extractTrack(file, signal);
  } catch (error) {
    signal.throwIfAborted();
    if (video) {
      try {
        return {samples:await decode(file, signal)};
      } catch {
        signal.throwIfAborted();
      }
    }
    throw error;
  }
}
