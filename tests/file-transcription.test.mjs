import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeFile} from '../dist/file-transcription.mjs';

const rate = 16000;
const audio = seconds => new Float32Array(rate * seconds).fill(0.1);
const loop = 'Now turn to the following page. '.repeat(20);

test('shorter decodes recover speech from the same samples in order', async () => {
  const input = audio(25);
  const recovered = [];
  const result = await transcribeFile(input, async clip => {
    if (clip.length > rate * 7) return {text:loop};
    recovered.push([clip.byteOffset, clip.byteLength]);
    return {text:'Part ' + recovered.length + '.'};
  }, () => {});
  let consumed = 0;
  for (const [offset, length] of recovered) {
    assert.equal(offset, consumed);
    consumed += length;
  }
  assert.equal(consumed, input.byteLength);
  assert.deepEqual(result, {paragraphs:['Part 1. Part 2. Part 3. Part 4.'], uncertain:false});
});

test('persistent runaway output is marked while surrounding speech survives', async () => {
  const result = await transcribeFile(audio(4), async () => ({
    text:'Welcome. ' + loop + 'Now turn to the next chapter.'
  }), () => {});
  assert.deepEqual(result, {paragraphs:['Welcome. [không nghe rõ]. Now turn to the next chapter.'], uncertain:true});
});

test('ordinary emphasis and plausible repetitions survive', async () => {
  for (const text of ['Wait, wait. Listen again. Listen again.', 'One two three four five. '.repeat(4).trim()]) {
    const result = await transcribeFile(audio(6), async () => ({text}), () => {});
    assert.deepEqual(result, {paragraphs:[text], uncertain:false});
  }
});

test('long files have no dropped or duplicated samples at window boundaries', async () => {
  const input = audio(123);
  let consumed = 0;
  await transcribeFile(input, async clip => {
    assert.ok(clip.length <= 30 * rate);
    assert.equal(clip.byteOffset, consumed);
    consumed += clip.byteLength;
    return {text:'Distinct speech.'};
  }, () => {});
  assert.equal(consumed, input.byteLength);
});

test('digital silence does not trigger a decode', async () => {
  const result = await transcribeFile(new Float32Array(rate * 31), () => assert.fail(), () => {});
  assert.deepEqual(result, {paragraphs:[], uncertain:false});
});
