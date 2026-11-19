// Extract complete statements, rank by topic vocabulary, retain details in lecture order.
const stop=new Set('the a an this that those these with from for and or to in is are of it be on we you they i as at so but have has will just can do then là và của cho thì các những một cái mà có trong được đó với này cũng sẽ về để khi der die das und ist ein eine les des une est pour'.split(' '));
const words=s=>(s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(x=>x.length>1&&!stop.has(x));
export function outline(parts){
 const blocks=[];let current=[];
 for(const p of parts){if(current.length&&p.time-current[0].time>=150){blocks.push(current);current=[]}current.push(p)}
 if(current.length)blocks.push(current);
 return blocks.map(block=>{
  const sentences=block.map(s=>s.text).join(' ').match(/[^.!?。！？]+(?:[.!?。！？]+|$)/gu)?.map(x=>x.trim()).filter(Boolean)||block.map(s=>s.text);
  const statements=sentences.flatMap(s=>{
   if(s.length<125)return [s];
   const clauses=s.split(/[,;，]\s*/u);
   return clauses.length>1 && clauses.every(c=>words(c).length>=3)?clauses:[s];
  });
  const rows=[...new Set(statements)].map((text,i)=>({text,i,terms:new Set(words(text))}));
  const count=new Map();for(const r of rows)for(const t of r.terms)count.set(t,(count.get(t)||0)+1);
  for(const r of rows)r.score=[...r.terms].reduce((s,w)=>s+Math.log(1+count.get(w)),0)/Math.sqrt(Math.max(1,r.terms.size))*(r.text.length<22?.5:1);
  const ranked=rows.slice().sort((a,b)=>b.score-a.score);const main=ranked.shift();
  const covered=new Set(main.terms),details=[];
  while(details.length<4&&ranked.length){const novelty=r=>r.score*[...r.terms].filter(t=>!covered.has(t)).length/Math.max(r.terms.size,1);
   ranked.sort((a,b)=>novelty(b)-novelty(a));const r=ranked.shift();if(!novelty(r))break;details.push(r);for(const t of r.terms)covered.add(t)}
  return {time:block[0].time,main:main.text,details:details.sort((a,b)=>a.i-b.i).map(r=>r.text)};
 });
}
