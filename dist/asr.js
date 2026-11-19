let recognizer = null;
let loadedModel = '';
self.onmessage=async ({data:{samples,speed,prepare}})=>{
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
  const paragraphs=[];
  const rate=16000;
  let start=0;
  while(start<samples.length){
   let end=Math.min(start+rate*120,samples.length);
   // Split near a quiet frame to reduce the chance of cutting a word.
   if(end<samples.length){let min=Infinity,best=end;for(let pos=end-rate*2;pos<end;pos+=320){let energy=0;for(let i=pos;i<pos+320;i++)energy+=samples[i]*samples[i];if(energy<min){min=energy;best=pos+160}}end=best}
   self.postMessage({status:'Đang chép lời · phút '+Math.floor(start/rate/60+1)+' / '+Math.ceil(samples.length/rate/60)});
   const r=await recognizer(samples.subarray(start,end),{...(!model.endsWith('.en') ? {task:'transcribe', language:'english'} : {}),chunk_length_s:30,stride_length_s:5});
   const text = r.text.trim();
   if (text) paragraphs.push(text);
   start=end;
  }
  self.postMessage({paragraphs,setupSeconds,processingSeconds:((performance.now()-processingStart)/1000).toFixed(1)});
 }catch(e){self.postMessage({error:'Không thể chạy mô hình. Kiểm tra mạng, bộ nhớ trống rồi thử lại. '+e.message})}
};
