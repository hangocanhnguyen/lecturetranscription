import {transcribeFile} from './file-transcription.mjs';
let recognizer = null;
let loadedModel = '';
self.onmessage=async ({data:{samples,speed,prepare,live}})=>{
 try{
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  env.backends.onnx.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
  const setupStart = performance.now();
  const model = speed === 'accurate' ? 'Xenova/whisper-base' : 'Xenova/whisper-tiny.en';
  if (loadedModel !== model) {
   if (recognizer) await recognizer.dispose();
   recognizer = null;
   loadedModel = '';
   recognizer = await pipeline('automatic-speech-recognition',model,{quantized:true,progress_callback:p=>{
   if(p.status==='progress')self.postMessage({status:'Đang tải mô hình · '+p.file+' · '+Math.round(p.progress)+'%'});
  }});
   loadedModel = model;
  }
  if (prepare) { self.postMessage({ready:true}); return; }
  const setupSeconds = ((performance.now()-setupStart)/1000).toFixed(1);
  const processingStart = performance.now();
  const options = model.endsWith('.en') ? {} : {task:'transcribe', language:'english'};
  const decode = audio => recognizer(audio, options);
  let result;
  if (live) {
   const text = (await decode(samples)).text.trim();
   result = {paragraphs: text ? [text] : []};
  } else {
   result = await transcribeFile(samples, decode, seconds => {
    self.postMessage({status:'Đang chép lời · phút ' + (Math.floor(seconds / 60) + 1) + ' / ' + Math.ceil(samples.length / 960000)});
   });
  }
  self.postMessage({...result,setupSeconds,processingSeconds:((performance.now()-processingStart)/1000).toFixed(1)});
 }catch(e){self.postMessage({error:'Không thể chạy mô hình. Kiểm tra mạng, bộ nhớ trống rồi thử lại. '+e.message})}
};
