// The single-threaded build runs on static hosts without cross-origin isolation.
self.onmessage = async ({data: file}) => {
  let core;
  try {
    const {default: createCore} = await import('./vendor/ffmpeg-0.12.10/ffmpeg-core.js');
    core = await createCore();
  } catch {
    self.postMessage({error:'Không tải được bộ tách âm thanh. Hãy kiểm tra kết nối rồi thử lại.'});
    return;
  }

  try {
    // Read slices of the original Blob on demand, including large video tracks.
    core.FS.mkdir('/input');
    const suffix = file.name?.match(/\.[a-z0-9]{1,8}$/i)?.[0] || '';
    const name = 'media' + suffix;
    core.FS.mount(core.FS.filesystems.WORKERFS, {blobs:[{name, data:file}]}, '/input');
    const input = ['-v', 'error', '-protocol_whitelist', 'file', '-i', '/input/' + name];
    core.ffprobe(...input, '-select_streams', 'a', '-show_entries', 'stream=index',
      '-of', 'json', '-o', '/tracks');
    // This single-thread build can return -1 even after a successful ffprobe.
    const result = core.FS.readFile('/tracks', {encoding:'utf8'});
    const tracks = JSON.parse(result || '{}').streams;
    if (!Array.isArray(tracks)) throw Error('Không mở được file. File có thể bị hỏng hoặc định dạng chưa được hỗ trợ.');
    if (!tracks.length) throw Error('File không có rãnh âm thanh.');

    let decoded = false;
    for (const track of tracks) {
      core.reset();
      const code = core.exec(...input, '-map', '0:' + track.index, '-vn', '-sn', '-dn',
        '-ac', '1', '-ar', '16000', '-f', 's16le', '/speech.pcm');
      if (code !== 0) continue;
      decoded = true;
      const bytes = core.FS.readFile('/speech.pcm');
      core.FS.unlink('/speech.pcm');
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      if (!pcm.some(value => Math.abs(value) > 3)) continue;
      const samples = Float32Array.from(pcm, value => value / 32768);
      self.postMessage({samples, preview:waveBlob(bytes)}, [samples.buffer]);
      return;
    }
    throw Error(decoded ? 'Không tìm thấy tín hiệu âm thanh trong các rãnh tiếng.' :
      'Không giải mã được rãnh tiếng. File có thể được bảo vệ hoặc dùng codec chưa hỗ trợ.');
  } catch (error) {
    self.postMessage({error:error.message || 'Không đủ bộ nhớ để tách âm thanh.'});
  }
};

// Wrap the decoded mono 16 kHz, 16-bit PCM for the browser's audio player.
function waveBlob(pcm) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  function tag(offset, value) {
    new Uint8Array(header, offset, 4).set(new TextEncoder().encode(value));
  }
  tag(0, 'RIFF');
  view.setUint32(4, pcm.byteLength + 36, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  return new Blob([header, pcm], {type:'audio/wav'});
}
