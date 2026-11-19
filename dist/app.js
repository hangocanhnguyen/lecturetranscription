import {createDocx} from './docx.mjs';
import {startCaptions} from './live-captions.mjs';
const $=id=>document.getElementById(id);
for(let i=0;i<52;i++){const bar=document.createElement('i');bar.style.height=(8+Math.abs(Math.sin(i*.38)*Math.cos(i*.15))*(35+85*Math.sin(i*Math.PI/52)))+'px';$('wave').append(bar)}
const stamp=t=>[Math.floor(t/60),Math.floor(t%60)].map(x=>String(x).padStart(2,'0')).join(':');
let media=null,url='',rec=null,timer,worker=null,busy=false,job=0;
function lock(locked){busy=locked;for(const id of ['micMode','fileMode','file','record','speed'])$(id).disabled=locked;$('generate').disabled=locked||!media}
function mode(mic){$('micMode').setAttribute('aria-pressed',mic);$('fileMode').setAttribute('aria-pressed',!mic);$('micBox').hidden=!mic;$('fileBox').hidden=mic}
$('micMode').onclick=()=>mode(true);$('fileMode').onclick=()=>mode(false);
let liveSession = null;

function clearCaptions() {
 const session = liveSession;
 liveSession = null;
 session?.controller?.close();
 $('captions').hidden = true;
}

function beginCaptions(stream) {
 clearCaptions();
 const session = {lines:[], controller:null, error:''};
 liveSession = session;
 $('captions').hidden = false;
 $('captionText').textContent = '';
 $('captionStatus').textContent = 'Đang chuẩn bị phụ đề trên thiết bị…';
 const update = (text, final) => {
  if (liveSession !== session) return;
  if (final && text) session.lines.push(text);
  $('captionText').textContent = [session.lines.at(-1), final ? '' : text].filter(Boolean).join(' ');
 };
 const failure = message => {
  if (liveSession !== session) return;
  session.error = message + ' Bạn có thể chép lại từ bản ghi sau khi dừng.';
  $('captionStatus').textContent = session.error;
 };
 session.started = startCaptions(stream, update, message => {
  if (liveSession === session) $('captionStatus').textContent = message;
 }, failure).then(controller => {
  if (liveSession === session) session.controller = controller;
  else controller.close();
 }).catch(error => failure('Phụ đề trực tiếp chưa khả dụng. ' + error.message));
 return session;
}

function showTranscript(lines) {
 $('copyStatus').textContent = '';
 const paragraphs = lines.map(text => {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  return paragraph;
 });
 $('transcript').replaceChildren(...paragraphs);
 $('results').hidden = false;
}

async function finishCaptions(session) {
 await session.started;
 await session.controller?.stop();
 if (liveSession !== session) return;
 if (session.lines.length) showTranscript(session.lines);
 $('captionStatus').textContent = session.error || (session.lines.length ? 'Đã chép xong bản ghi.' : 'Không nhận diện được lời nói.');
}
function select(blob,name,recorded){
 if (!recorded) clearCaptions();
 if(url)URL.revokeObjectURL(url);
 media=blob;url=URL.createObjectURL(blob);$('audio').src=url;$('filename').textContent=name;$('source').hidden=false;
 $('backup').href=url;$('backup').download=name;$('backup').hidden=!recorded;$('status').textContent='';$('results').hidden=true;$('transcript').replaceChildren();lock(false);
}
$('file').onchange=e=>{const f=e.target.files[0];if(f)select(f,f.name,false)};
$('record').onclick=async()=>{
 if(rec?.state==='recording'){rec.stop();$('record').disabled=true;return}
 let stream;
 try{
 lock(true);stream=await navigator.mediaDevices.getUserMedia({audio:true});
 let session;
 rec=new MediaRecorder(stream);const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 rec.onstop=()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());$('record').textContent='●  Bắt đầu ghi âm';const type=rec.mimeType||chunks[0]?.type||'audio/webm';rec=null;
 if(chunks.length)select(new Blob(chunks,{type}),'lecture-'+new Date().toISOString().replaceAll(':','-').slice(0,19)+(type.includes('mp4')?'.m4a':type.includes('ogg')?'.ogg':'.webm'),true);
 else{lock(false);$('status').textContent='Bản ghi trống. Kiểm tra micro rồi thử lại.'}
 if (session) {
  if (!session.error) $('captionStatus').textContent = 'Đang hoàn tất phụ đề…';
  finishCaptions(session);
 }
 };
 rec.start(1000);$('results').hidden=true;session=beginCaptions(stream);$('record').disabled=false;$('record').textContent='■  Dừng ghi âm';$('status').textContent='Đang ghi âm từ micro.';const start=Date.now();$('clock').textContent='00:00';timer=setInterval(()=>$('clock').textContent=stamp((Date.now()-start)/1000),300);
 }catch(e){stream?.getTracks().forEach(t=>t.stop());lock(false);$('status').textContent='Không mở được micro. Kiểm tra quyền micro trong trình duyệt hoặc chọn file. '+e.message}
};
function finish(terminate=false){if(terminate){worker?.terminate();worker=null;}$('cancel').hidden=true;lock(false)}
$('cancel').onclick=()=>{job++;finish(true);$('status').textContent='Đã hủy. Bạn có thể xử lý lại file này.'};
$('generate').onclick=async()=>{
 if(!media||busy)return;
 clearCaptions();
 $('results').hidden=true;
 const id=++job;lock(true);$('cancel').hidden=false;$('status').textContent='Đang đọc âm thanh…';
 let context;
 try{
 context=new AudioContext({sampleRate:16000});const buf=await context.decodeAudioData(await media.arrayBuffer());
 if(id!==job)return;
 const samples=new Float32Array(buf.length);for(let ch=0;ch<buf.numberOfChannels;ch++){const channel=buf.getChannelData(ch);for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/buf.numberOfChannels}
 if(!samples.some(v=>Math.abs(v)>.0001))throw Error('File không có tín hiệu âm thanh.');
 worker ??= new Worker(new URL('./asr.js',import.meta.url),{type:'module'});$('status').textContent='Đang khởi động Whisper. Lần đầu có thể mất vài phút…';
 worker.onerror=e=>{if(id!==job)return;$('status').textContent='Không tải được bộ xử lý. '+e.message;finish(true)};
 worker.onmessage = ({data}) => {
  if (id !== job) return;
  if (data.status) {
   $('status').textContent = data.status;
   return;
  }
  finish(Boolean(data.error));
  if (data.error || !data.paragraphs.length) {
   $('status').textContent = data.error || 'Không nhận diện được lời nói.';
   return;
  }
  showTranscript(data.paragraphs);
  $('status').textContent = 'Đã chép xong · xử lý ' + data.processingSeconds + ' giây, chuẩn bị mô hình ' + data.setupSeconds + ' giây.';
  if (data.uncertain) $('status').textContent += ' Chỗ ghi [không nghe rõ] cần nghe lại bản gốc.';
 };
 worker.postMessage({samples,speed:$('speed').value},[samples.buffer]);
 }catch(e){if(id===job){finish();$('status').textContent='Không đọc được âm thanh. Nếu codec không được hỗ trợ, hãy thử MP3 hoặc WAV. '+e.message}}
 finally{if(context)await context.close().catch(()=>{})}
};
function transcriptParagraphs() {
 return Array.from($('transcript').children, paragraph => paragraph.textContent);
}

$('copy').onclick = async () => {
 const transcript = $('transcript');
 const first = transcript.firstElementChild;
 if (!first) return;
 let message = 'Đã sao chép toàn bộ bản chép lời.';
 try {
  await navigator.clipboard.writeText(transcriptParagraphs().join('\n\n'));
 } catch {
  if (first !== transcript.firstElementChild || $('results').hidden) return;
  const selection = window.getSelection();
  selection.selectAllChildren(transcript);
  try {
   if (document.execCommand('copy')) selection.removeAllRanges();
   else message = 'Đã chọn toàn bộ bản chép lời. Hãy dùng lệnh Sao chép trên thiết bị.';
  } catch {
   message = 'Đã chọn toàn bộ bản chép lời. Hãy dùng lệnh Sao chép trên thiết bị.';
  }
 }
 if (first === transcript.firstElementChild) $('copyStatus').textContent = message;
};

$('save').onclick = () => {
 const paragraphs = transcriptParagraphs();
 const url = URL.createObjectURL(createDocx(paragraphs));
 const link = document.createElement('a');
 link.href = url;
 link.download = ($('filename').textContent.replace(/\.[^.]+$/, '') || 'Ban chep loi') + '.docx';
 link.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
