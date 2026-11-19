self.onmessage=async ({data:{samples,language}})=>{
 try{
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  env.backends.onnx.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
  const recognize=await pipeline('automatic-speech-recognition','Xenova/whisper-base',{progress_callback:p=>{
   if(p.status==='progress')self.postMessage({status:'Đang tải mô hình · '+p.file+' · '+Math.round(p.progress)+'%'});
  }});
  const parts=[];
  const rate=16000;
  let start=0;
  while(start<samples.length){
   let end=Math.min(start+rate*120,samples.length);
   // Split near a quiet frame to reduce the chance of cutting a word.
   if(end<samples.length){let min=Infinity,best=end;for(let pos=end-rate*2;pos<end;pos+=320){let energy=0;for(let i=pos;i<pos+320;i++)energy+=samples[i]*samples[i];if(energy<min){min=energy;best=pos+160}}end=best}
   self.postMessage({status:'Đang chép lời · phút '+Math.floor(start/rate/60+1)+' / '+Math.ceil(samples.length/rate/60)});
   const r=await recognize(samples.subarray(start,end),{task:'transcribe',...(language?{language}:{}),chunk_length_s:30,stride_length_s:5,return_timestamps:true});
   const chunks=r.chunks?.length?r.chunks:[{text:r.text,timestamp:[0,null]}];
   for(const c of chunks)if(c.text.trim())parts.push({time:start/rate+(c.timestamp[0]??0),text:c.text.trim()});
   start=end;
  }
  self.postMessage({parts});
 }catch(e){self.postMessage({error:'Không thể chạy mô hình. Kiểm tra mạng, bộ nhớ trống rồi thử lại. '+e.message})}
};
