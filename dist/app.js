import {outline} from './outline.mjs';
const $=id=>document.getElementById(id);
for(let i=0;i<52;i++){const bar=document.createElement('i');bar.style.height=(8+Math.abs(Math.sin(i*.38)*Math.cos(i*.15))*(35+85*Math.sin(i*Math.PI/52)))+'px';$('wave').append(bar)}
const stamp=t=>[Math.floor(t/60),Math.floor(t%60)].map(x=>String(x).padStart(2,'0')).join(':');
let media=null,url='',rec=null,timer,worker=null,busy=false,job=0,parts=[],notes=[];
function lock(locked){busy=locked;for(const id of ['micMode','fileMode','file','record','lang','speed'])$(id).disabled=locked;$('generate').disabled=locked||!media}
function mode(mic){$('micMode').setAttribute('aria-pressed',mic);$('fileMode').setAttribute('aria-pressed',!mic);$('micBox').hidden=!mic;$('fileBox').hidden=mic}
$('micMode').onclick=()=>mode(true);$('fileMode').onclick=()=>mode(false);
function select(blob,name,recorded){
 if(url)URL.revokeObjectURL(url);
 media=blob;url=URL.createObjectURL(blob);$('audio').src=url;$('filename').textContent=name;$('source').hidden=false;
 $('backup').href=url;$('backup').download=name;$('backup').hidden=!recorded;$('status').textContent='';$('results').hidden=true;parts=[];notes=[];lock(false);
}
$('file').onchange=e=>{const f=e.target.files[0];if(f)select(f,f.name,false)};
$('record').onclick=async()=>{
 if(rec?.state==='recording'){rec.stop();$('record').disabled=true;return}
 let stream;
 try{
 lock(true);stream=await navigator.mediaDevices.getUserMedia({audio:true});
 rec=new MediaRecorder(stream);const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 rec.onstop=()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());$('record').textContent='●  Bắt đầu ghi âm';const type=rec.mimeType||chunks[0]?.type||'audio/webm';rec=null;
 if(chunks.length)select(new Blob(chunks,{type}),'lecture-'+new Date().toISOString().replaceAll(':','-').slice(0,19)+(type.includes('mp4')?'.m4a':type.includes('ogg')?'.ogg':'.webm'),true);
 else{lock(false);$('status').textContent='Bản ghi trống. Kiểm tra micro rồi thử lại.'}};
 rec.start(1000);$('record').disabled=false;$('record').textContent='■  Dừng ghi âm';$('status').textContent='Đang ghi âm từ micro.';const start=Date.now();$('clock').textContent='00:00';timer=setInterval(()=>$('clock').textContent=stamp((Date.now()-start)/1000),300);
 }catch(e){stream?.getTracks().forEach(t=>t.stop());lock(false);$('status').textContent='Không mở được micro. Kiểm tra quyền micro trong trình duyệt hoặc chọn file. '+e.message}
};
function finish(terminate=false){if(terminate){worker?.terminate();worker=null;}$('cancel').hidden=true;lock(false)}
$('cancel').onclick=()=>{job++;finish(true);$('status').textContent='Đã hủy. Bạn có thể xử lý lại file này.'};
function element(tag,text){const e=document.createElement(tag);e.textContent=text;return e}
function jump(t){const b=element('button',stamp(t));b.className='stamp';b.title='Nghe lại từ '+stamp(t);b.onclick=()=>{$('audio').currentTime=t;$('audio').play().catch(()=>{})};return b}
function display(){
 notes=outline(parts);$('notes').replaceChildren();$('transcript').replaceChildren();
 for(const n of notes){const a=document.createElement('article'),h=element('h3',n.main),ul=document.createElement('ul');h.prepend(jump(n.time));for(const d of n.details)ul.append(element('li',d));a.append(h,ul);$('notes').append(a)}
 for(const p of parts){const line=element('p',p.text);line.prepend(jump(p.time));$('transcript').append(line)}
 $('results').hidden=false;
}
$('generate').onclick=async()=>{
 if(!media||busy)return;
 const id=++job;lock(true);$('cancel').hidden=false;$('status').textContent='Đang đọc âm thanh…';
 let context;
 try{
 context=new AudioContext({sampleRate:16000});const buf=await context.decodeAudioData(await media.arrayBuffer());
 if(id!==job)return;
 const samples=new Float32Array(buf.length);for(let ch=0;ch<buf.numberOfChannels;ch++){const channel=buf.getChannelData(ch);for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/buf.numberOfChannels}
 if(!samples.some(v=>Math.abs(v)>.0001))throw Error('File không có tín hiệu âm thanh.');
 worker ??= new Worker(new URL('./asr.js',import.meta.url),{type:'module'});$('status').textContent='Đang khởi động Whisper. Lần đầu có thể mất vài phút…';
 worker.onerror=e=>{if(id!==job)return;$('status').textContent='Không tải được bộ xử lý. '+e.message;finish(true)};
 worker.onmessage=({data})=>{if(id!==job)return;if(data.status){$('status').textContent=data.status;return}finish(Boolean(data.error));if(data.error){$('status').textContent=data.error;return}parts=data.parts;if(!parts.length){$('status').textContent='Không nhận diện được lời nói.';return}display();$('status').textContent='Đã xong · xử lý '+data.processingSeconds+' giây, chuẩn bị mô hình '+data.setupSeconds+' giây. Bấm mốc thời gian để nghe lại.'};
 worker.postMessage({samples,language:$('lang').value,speed:$('speed').value},[samples.buffer]);
 }catch(e){if(id===job){finish();$('status').textContent='Không đọc được âm thanh. Nếu codec không được hỗ trợ, hãy thử MP3 hoặc WAV. '+e.message}}
 finally{if(context)await context.close().catch(()=>{})}
};
$('save').onclick=()=>{const name=$('filename').textContent;const md=['# '+name,'','## Dàn ý','',...notes.flatMap(n=>['### '+stamp(n.time)+' · '+n.main,...n.details.map(d=>'- '+d),'']),'## Transcript','',...parts.map(p=>'['+stamp(p.time)+'] '+p.text)].join('\n');const link=document.createElement('a');const u=URL.createObjectURL(new Blob([md],{type:'text/markdown;charset=utf-8'}));link.href=u;link.download=name.replace(/\.[^.]+$/,'')+'.md';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
