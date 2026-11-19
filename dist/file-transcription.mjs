// The decoder sees each source sample once per pass. Keep each window within
// Whisper's 30-second input and prefer a low-energy frame near each cut.
const rate = 16000;

function quietCut(audio, target, radius) {
  const frame = 320;
  const first = Math.max(0, target - radius);
  const last = Math.min(audio.length, target + radius);
  let cut = target;
  let lowest = Infinity;
  for (let start = first; start + frame <= last; start += frame) {
    let energy = 0;
    for (let i = start; i < start + frame; i++) energy += audio[i] * audio[i];
    const middle = start + frame / 2;
    if (energy < lowest || (energy === lowest && Math.abs(middle - target) < Math.abs(cut - target))) {
      lowest = energy;
      cut = middle;
    }
  }
  return cut;
}

function repeatedSpans(text) {
  const tokens = Array.from(text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu));
  const words = tokens.map(token => token[0].toLowerCase().replaceAll('’', "'"));
  const spans = [];
  for (let i = 0; i < words.length; i++) {
    for (let size = 1; size <= 24 && i + 4 * size <= words.length; size++) {
      let end = i + size;
      while (end < words.length && words[end] === words[end - size]) end++;
      // Keep the opening words of a following sentence that starts the same way.
      end -= (end - i) % size;
      if (end - i < Math.max(20, 4 * size)) continue;
      const last = tokens[end - 1];
      spans.push([tokens[i].index, last.index + last[0].length]);
      i = end - 1;
      break;
    }
  }
  return spans;
}

export async function transcribeFile(samples, decode, progress) {
  const paragraphs = [];
  let uncertain = false;

  async function readWindow(audio) {
    if (!audio.some(sample => sample !== 0)) return '';
    const text = (await decode(audio)).text.trim();
    const repeats = repeatedSpans(text);
    if (!repeats.length) return text;
    if (audio.length > 6 * rate) {
      const middle = quietCut(audio, Math.floor(audio.length / 2), rate / 2);
      const left = await readWindow(audio.subarray(0, middle));
      const right = await readWindow(audio.subarray(middle));
      return [left, right].filter(Boolean).join(' ');
    }
    // Allow plausible spoken repetitions in an independently decoded short clip.
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= Math.max(12, 5 * audio.length / rate)) return text;
    uncertain = true;
    let marked = text;
    for (const [start, end] of repeats.reverse()) {
      marked = marked.slice(0, start) + '[không nghe rõ]' + marked.slice(end);
    }
    return marked;
  }

  let start = 0;
  while (start < samples.length) {
    progress(start / rate);
    const remaining = samples.subarray(start);
    const length = remaining.length <= 30 * rate ? remaining.length : quietCut(remaining, 26 * rate, 2 * rate);
    const text = await readWindow(remaining.subarray(0, length));
    if (text) paragraphs.push(text);
    start += length;
  }
  return {paragraphs, uncertain};
}
