// Reads the major-course spreadsheets (level2.xlsx, level3.xlsx, level4.xlsx). Shared by the Major courses page and the schedule.
(function(){
const ALIAS={uns:'uns',pmth:'pure',pure:'pure',appm:'applied',applied:'applied',stat:'statistics',stats:'statistics',statistics:'statistics',dats:'datascience',ds:'datascience',datascience:'datascience'};
const key=n=>ALIAS[String(n).toLowerCase().replace(/[^a-z]/g,'')];
const sheet=async f=>{if(!window.XLSX)throw new Error('the Excel reader could not be loaded');const r=await fetch(f);if(!r.ok)throw new Error(f+' not found (HTTP '+r.status+')');
 const wb=XLSX.read(await r.arrayBuffer(),{type:'array'});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''})};
// read the spreadsheet: a header row naming the majors, then each major's titles (and codes, if there is a "Course Code" column)
function groups(g){const hr=g.findIndex(r=>r.filter(x=>String(x).trim()).length>=2);if(hr<0)return[];
 const sub=g[hr+1]||[],start=hr+1+(sub.some(x=>/title|code/i.test(x))?1:0);
 return g[hr].map((h,j)=>({name:String(h).trim(),j})).filter(x=>x.name).map(({name,j})=>{
  const hc=/code/i.test(sub[j+1]||''),hn=hc&&/note/i.test(sub[j+2]||''),items=[];
  for(let i=start;i<g.length;i++){const t=String(g[i][j]||'').trim(),c=hc?String(g[i][j+1]||'').trim():'',note=hn?String(g[i][j+2]||'').trim():'';if(t||c)items.push({title:t,code:c,note})}
  return{name,items}})}
window.MajorLists={ALIAS,key,sheet,groups};
})();
