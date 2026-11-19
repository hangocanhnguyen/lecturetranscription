// Whisper revises the current phrase as more audio arrives. Freeze it at a
// pause or after eight seconds, and process completed phrases in order.
export async function startCaptions(stream, onCaption, onStatus, onFailure) {
  const context = new AudioContext({sampleRate: 16000});
  let worker;
  let input;
  let node;
  let closed = false;
  let ended = false;
  let ready = false;
  let pending = null;
  const phrases = [];
  let current = null;
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });

  function close() {
    if (closed) return;
    closed = true;
    input?.disconnect();
    node?.disconnect();
    node?.port.close();
    worker?.terminate();
    context.close().catch(() => {});
    resolveDone();
  }

  function fail(message) {
    if (closed) return;
    close();
    onFailure(message);
  }

  function dispatch() {
    if (closed || pending) return;
    const phrase = phrases[0];
    if (!phrase) {
      if (ended) close();
      return;
    }
    if (!ready) return;
    if (!phrase.final && phrase.length - phrase.sent < 16000) return;
    if (phrase.final && phrase.length === phrase.sent) {
      onCaption(phrase.text, true);
      phrases.shift();
      dispatch();
      return;
    }
    const samples = new Float32Array(phrase.length);
    let offset = 0;
    for (const frame of phrase.frames) {
      samples.set(frame, offset);
      offset += frame.length;
    }
    phrase.sent = samples.length;
    pending = phrase;
    worker.postMessage({samples, speed:'fast', live:true}, [samples.buffer]);
  }

  function receive(frame) {
    if (closed) return;
    if (frame === null) {
      ended = true;
      if (current) current.final = true;
      dispatch();
      return;
    }
    let energy = 0;
    for (const sample of frame) energy += sample * sample;
    const speech = energy / frame.length > 0.000002;
    if (!current) {
      if (!speech) return;
      current = {frames:[], length:0, quiet:0, sent:0, final:false, text:''};
      phrases.push(current);
    }
    current.frames.push(frame);
    current.length += frame.length;
    current.quiet = speech ? 0 : current.quiet + frame.length;
    if (current.quiet >= 8000 || current.length >= 128000) {
      current.final = true;
      current = null;
    }
    if (phrases.reduce((sum, phrase) => sum + phrase.length, 0) > 16000 * 120) {
      fail('Máy xử lý phụ đề chậm hơn tốc độ nói.');
      return;
    }
    dispatch();
  }

  try {
    await context.resume();
    await context.audioWorklet.addModule(new URL('./mic-frames.js', import.meta.url));
    node = new AudioWorkletNode(context, 'mic-frames', {channelCount:1, channelCountMode:'explicit'});
    input = context.createMediaStreamSource(stream);
    worker = new Worker(new URL('./asr.js', import.meta.url), {type:'module'});
    worker.onerror = () => fail('Không tải được bộ xử lý phụ đề.');
    worker.onmessage = ({data}) => {
      if (closed) return;
      if (data.error) return fail(data.error);
      if (data.status) {
        if (!ready) onStatus(data.status);
        return;
      }
      if (data.ready) {
        ready = true;
        onStatus('Đang nghe tiếng Anh…');
      } else {
        pending.text = data.paragraphs.join(' ');
        onCaption(pending.text, false);
        pending = null;
      }
      dispatch();
    };
    node.port.onmessage = ({data}) => receive(data);
    input.connect(node);
    node.connect(context.destination); // The worklet outputs silence.
    worker.postMessage({prepare:true, speed:'fast'});
    return {
      stop() {
        if (!closed) {
          input.disconnect();
          node.port.postMessage('flush');
        }
        return done;
      },
      close
    };
  } catch (error) {
    close();
    throw error;
  }
}
