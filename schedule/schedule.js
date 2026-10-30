const MJ={c:['Core','core'],a:['Applied','applied'],p:['Pure','pure'],s:['Statistics / Data Science','statistics'],d:['Discipline elective','discipline']};
let P; // the selected major's schedule and course lists (from window.MAJORS)
const uc=c=>P.allMagenta?(c.mj==='c'?'core':'discipline'):MJ[c.mj][1];
const url=c=>'https://adelaide.edu.au/study/courses/'+c.replace(/^([A-Z]+)(\d+)$/,(m,a,b)=>a.toLowerCase()+'-'+b)+'/';
const SL={1:'Semester 1',2:'Semester 2',12:'Both semesters'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let C=[],D={};
// prerequisite parsing (same logic as the tree page): AND links are required, OR links are alternatives
function parseExpr(s){const tk=s.match(/\(|\)|AND|OR|[A-Z]{3,5}[0-9]{3,4}/g)||[];let p=0;
 const atom=()=>{const t=tk[p++];if(t==='('){const n=or();p++;return n}return{code:t}};
 const and=()=>{const k=[atom()];while(tk[p]==='AND'){p++;k.push(atom())}return k.length>1?{op:'and',k}:k[0]};
 const or=()=>{const k=[and()];while(tk[p]==='OR'){p++;k.push(and())}return k.length>1?{op:'or',k}:k[0]};
 return tk.length?or():null}
function req(n,r,o){if(!n)return;if(n.code){if(r)o.add(n.code);return}n.k.forEach(c=>req(c,r&&n.op==='and',o))}
const LK=[];
function okCol(v){if(v===undefined)throw new Error('courses.csv has no "offered" column (the browser may be showing an old copy of the file)');return v}
function csvRows(t){const rows=[];let row=[],cur='',q=false;
 for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
  else if(c==='"')q=true;else if(c===','){row.push(cur);cur=''}
  else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else if(c!=='\r')cur+=c}
 if(cur||row.length){row.push(cur);rows.push(row)}
 const h=rows.shift().map(s=>s.trim());
 return rows.filter(r=>r.some(v=>v.trim())).map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]||'').trim()])))}
function build(csv){
 const M={core:'c',applied:'a',pure:'p',statistics:'s',discipline:'d'};
 C=csvRows(csv).map(r=>({code:r['Course Code'],name:r['Course Name'],lvl:+r.level,sem:r.semester.replace(/[\s,]/g,''),pre:r['Prerequisite course(s)'],note:r['Prerequisite note(s)'],mj:M[r.major]||'c',on:okCol(r.offered).toLowerCase()==='y'}));
 D=Object.fromEntries(C.map(c=>[c.code,c]));LK.length=0;
 C.forEach(c=>{const rq=new Set();req(parseExpr(c.pre),true,rq);
  [...new Set(c.pre.match(/[A-Z]{3,5}[0-9]{3,4}/g)||[])].filter(x=>D[x]).forEach(x=>LK.push({s:x,t:c.code,alt:!rq.has(x)}))})}

// slot types: which courses can fill each placeholder
const nc=l=>C.filter(c=>c.lvl===l&&c.mj!=='c');
const WILN='Note: To take Clinic 1 and Clinic 2 as the WIL option, MATH 3013 Clinic 1 will need to be taken in the second half of Year 2 (semester 1) and MATH 3900 Clinic 2 will need to be taken in the first half of Year 3 (semester 2).';
const CCP='https://adelaide.edu.au/study/common-core/';
const CCL=[['COREX001','An Ethically Rich Life','Ethical Knowledges'],['COREX002','Fact or Fiction: Data for Everyone','Data Knowledges'],['COREX003','Igniting Change: Ideas to Action','Entrepreneurship and Design Thinking'],['COREX004','Transforming Learning through First Nations Knowledges','First Nations Knowledges'],['COREX005','Responsible AI: Bridging Ethics, Education and Industry','Artificial Intelligence'],['COREX006','Building Belonging: Navigating Cultural Complexities','Intercultural Understanding']];
const SLOT={
 L1D:{label:'Level 1 discipline elective',pick:()=>nc(1),note:'This can be switched with COMP1002.'},
 L2M:{label:'Level 2 major course',pick:()=>P.L2M?P.L2M.map(x=>D[x]):C.filter(c=>c.lvl===2&&'pas'.includes(c.mj)),get note(){return P.l2mNote}},
 L2D:{label:'Level 2 discipline elective',pick:()=>nc(2)},
 L3M:{label:'Level 3 major course',pick:()=>(P.L3M||[]).map(x=>D[x])},
 L3D:{label:'Level 3 discipline elective',pick:()=>nc(3)},
 W1:{label:'WIL 1',pick:()=>'MATH3013 MATH3901 MATHX315 MATH3902'.split(' ').map(x=>D[x]),note:WILN,mid:1},
 W2:{label:'WIL 2',pick:()=>'MATH3900 MATH3901 MATHX315 MATH3902'.split(' ').map(x=>D[x]),note:WILN,mid:1},
 FE:{label:'Free elective',msg:'Any course you are eligible for. No list is loaded for this slot.'},
 CC:{label:'Common Core',html:`<p>Common Core courses are university-wide, have no prerequisites and don’t count towards your GPA. The courses on offer can change, so check the <a href="${CCP}" target="_blank" rel="noopener">Common Core page</a> for the current list.</p><ul class="cc">${CCL.map(([c,n,a])=>`<li><a href="${url(c)}" target="_blank" rel="noopener">${n}</a> <small>${a}</small></li>`).join('')}</ul>`}}
const CLS={L1D:'discipline',L2M:'discipline',L2D:'discipline',L3M:'discipline',L3D:'discipline',W1:'core',W2:'core',CC:'core',FE:'free'};
let cur='std';;
const N1='Note: the Level 1 discipline course can be switched with COMP1002.';
const mk=(ys,mid)=>ys.map((sems,i)=>['Year '+(i+1),sems,i===0?N1:(mid&&i===2?WILN:'')]);
let PLANS;

function render(p){if(!C.length)return;cur=p;
 document.querySelectorAll('.tab[data-p]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===p));
 document.getElementById('plan').innerHTML=PLANS[p].map(([y,sems,note])=>`<section class="year"><h2>${y}</h2>${sems.map(([s,sl])=>
  `<div class="sem"><div class="sl">Semester ${s}</div>${sl.map(k=>D[k]?
   `<button class="cell ${uc(D[k])}" data-c="${k}"><b>${k}</b>${esc(D[k].name)}</button>`:
   `<button class="cell ph ${CLS[k]}" data-k="${k}" data-s="${s}">${SLOT[k].label}<small>${SLOT[k].pick||SLOT[k].html?'See options':'Details'}</small></button>`).join('')}</div>`).join('')}
  ${note?`<p class="note">${note}</p>`:''}</section>`).join('')}

const dlg=document.getElementById('dlg');let hist=[];
function go(fn){hist.push(fn);fn()}
function back(){hist.pop();hist[hist.length-1]()}
function show(html){dlg.innerHTML=`<button class="x" aria-label="Close" data-x>×</button>${hist.length>1?'<button class="back" data-back>‹ Back</button>':''}${html}`;if(!dlg.open)dlg.showModal()}
const chip=c=>`<small>${P.tags&&P.tags[c.code]?P.tags[c.code]+' · ':''}${MJ[c.mj][0]} · ${SL[c.sem]}${c.on?'':' · not currently offered'}</small>`;

function listView(k,s){
 const m=SLOT[k];let h=`<h3>${m.label}</h3><p>Slot in Semester ${s}.${m.note&&!(m.mid&&cur!=='mid')?' '+m.note:''}</p>`;
 if(!m.pick)return show(h+(m.html||`<p>${m.msg}</p>`));
 const cs=m.pick();
 [String(s),'12',s==1?'2':'1'].forEach(g=>{
  const it=cs.filter(c=>c.sem===g).sort((a,b)=>(b.on-a.on)||a.name.localeCompare(b.name));if(!it.length)return;
  const fit=g==s||g==='12';
  h+=`<h4 class="grp${fit?'':' no'}">${SL[g]}${fit?'':' (not available in this slot’s semester)'}</h4><ul class="opts">`+
   it.map(c=>`<li><button class="opt ${uc(c)}${c.on?'':' off'}" data-c="${c.code}"><b>${c.code}</b> ${esc(c.name)}${chip(c)}</button></li>`).join('')+'</ul>'});
 show(h)}

function tree(code){
 const up=new Set(),st=[code];
 while(st.length){const t=st.pop();LK.forEach(l=>{if(l.t===t&&!up.has(l.s)){up.add(l.s);st.push(l.s)}})}
 const A=new Set([code,...up]),kids=[...new Set(LK.filter(l=>l.s===code).map(l=>l.t))];
 if(A.size===1&&!kids.length)return'<p>This course has no prerequisite courses in the tree and does not lead to any listed course.</p>';
 const dp={[code]:0};
 const dep=a=>a in dp?dp[a]:(dp[a]=Math.min(...LK.filter(l=>l.s===a&&A.has(l.t)).map(l=>dep(l.t)-1)));
 up.forEach(dep);kids.forEach(k=>dp[k]=1);
 const ds=[...new Set(Object.values(dp))].sort((a,b)=>a-b),cols=ds.map(d=>Object.keys(dp).filter(c=>dp[c]===d).sort());
 const NW=132,NH=42,GX=64,GY=8,H=Math.max(...cols.map(c=>c.length))*(NH+GY)+8,W=cols.length*(NW+GX)-GX+8,pos={};
 cols.forEach((c,i)=>{const off=(H-c.length*(NH+GY))/2;c.forEach((x,j)=>pos[x]={x:4+i*(NW+GX),y:off+j*(NH+GY)+4})});
 const E=LK.filter(l=>pos[l.s]&&pos[l.t]&&((A.has(l.s)&&A.has(l.t))||l.s===code));
 const wrap=t=>{const o=[];let l='';t.split(' ').forEach(w=>{if((l+' '+w).trim().length>25&&l){o.push(l);l=w}else l=(l+' '+w).trim()});o.push(l);if(o.length>2){o.length=2;o[1]=o[1].slice(0,22)+'…'}return o};
 return`<div class="tree"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
 <marker id="au" viewBox="0 -5 10 10" refX="10" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="#F5A300"/></marker>
 <marker id="ad" viewBox="0 -5 10 10" refX="10" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="#0E9F9A"/></marker></defs>`+
 E.map(l=>{const a=pos[l.s],b=pos[l.t],x1=a.x+NW,y1=a.y+NH/2,x2=b.x,y2=b.y+NH/2,m=(x1+x2)/2,dn=l.s===code;
  return`<path class="e ${dn?'dn':'up'}${l.alt?' alt':''}" marker-end="url(#${dn?'ad':'au'})" d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}"/>`}).join('')+
 Object.keys(pos).map(k=>{const c=D[k],p=pos[k];
  return`<g class="n ${MJ[c.mj][1]}${c.on?'':' off'}${k===code?' sel':''}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" data-c="${k}" aria-label="${k} ${esc(c.name)}">
  <rect width="${NW}" height="${NH}" rx="6"/><text class="c" x="${NW/2}" y="15">${k}</text>${wrap(c.name).map((t,i)=>`<text x="${NW/2}" y="${26+i*10}">${esc(t)}</text>`).join('')}</g>`}).join('')+
 `</svg></div><p class="key"><i style="border-color:#F5A300"></i>leads to this course<i style="border-color:#0E9F9A"></i>unlocked by this course<i style="border-top-style:dashed;border-color:#555"></i>one of several alternatives</p>`}

function courseView(code){
 const c=D[code];
 show(`<h3><span class="code">${c.code}</span><br>${esc(c.name)}</h3>
 <div><b>Level ${c.lvl}</b> · ${SL[c.sem]} · ${MJ[c.mj][0]}</div>
 <div>${c.on?'Currently offered':'<b class="warn">Not currently offered</b>'}</div>
 <p><a href="${url(code)}" target="_blank" rel="noopener">Course webpage ↗</a></p>
 <p><b>Prerequisites:</b> ${esc(c.pre||'None listed')}</p>${c.note?`<p><b>Notes:</b> ${esc(c.note)}</p>`:''}${tree(code)}`)}

dlg.addEventListener('click',e=>{
 if(e.target===dlg||e.target.closest('[data-x]'))return dlg.close();
 if(e.target.closest('[data-back]'))return back();
 const n=e.target.closest('[data-c]');if(n)go(()=>courseView(n.dataset.c))});
dlg.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('g[data-c]'))go(()=>courseView(e.target.dataset.c))});
dlg.addEventListener('close',()=>{hist=[]});
document.getElementById('plan').addEventListener('click',e=>{
 const b=e.target.closest('button.cell');if(!b)return;hist=[];
 if(b.dataset.c)go(()=>courseView(b.dataset.c));else go(()=>listView(b.dataset.k,+b.dataset.s))});
document.querySelectorAll('.tab[data-p]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.p)));
const MK=Object.keys(window.MAJORS),MB=document.getElementById('majors');
MB.innerHTML='<span class="tl">Major</span>'+MK.map(k=>`<button class="tab" data-m="${k}" aria-pressed="false">${window.MAJORS[k].label}</button>`).join('');
MB.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b)setMajor(b.dataset.m)});
window.addEventListener('hashchange',()=>{if(C.length)setMajor(location.hash.slice(1))});
function setMajor(id){
 if(!window.MAJORS[id])id=MK[0];P=window.MAJORS[id];
 CLS.L2M=CLS.L3M=P.majorClass||'discipline';SLOT.FE.label=P.feLabel||'Free elective';
 PLANS={std:mk(P.std,false),mid:mk(P.mid,true)};
 document.getElementById('ttl').textContent=P.title;document.title=P.title+': program schedule';
 document.querySelectorAll('[data-m]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===id));
 if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);
 if(dlg.open)dlg.close();render(cur)}
fetch('/prereqs/courses.csv').then(r=>{if(!r.ok)throw new Error('/prereqs/courses.csv not found (HTTP '+r.status+')');return r.text()}).then(v=>{build(v);setMajor(location.hash.slice(1))}).catch(e=>{document.getElementById('plan').innerHTML='<p class="sub">Could not load the course data: '+esc(e&&e.message||'download failed')+'. If you opened this file from your computer, open it from the website instead.</p>';console.error(e)});
