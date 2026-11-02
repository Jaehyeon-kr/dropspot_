const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requestedRun=new URLSearchParams(location.search).get('run_id');
async function load(){
 $('#reload').disabled=true;$('#report-error').textContent='';
 try{
  let history=[];
  try{history=(await (await fetch('/api/personas/reports')).json()).reports||[];
   $('#report-run').innerHTML=history.map(item=>`<option value="${esc(item.run_id)}">${esc(item.created_at?new Date(item.created_at).toLocaleString('ko-KR'):item.run_id.slice(0,8))} · ${item.variant==='problem'?'마찰 포함':'정상'} · ${item.sessions}세션</option>`).join('');
  }catch{/* A pinned report still works if the history listing fails. */}
  const target=requestedRun||history[0]?.run_id;
  const response=await fetch('/api/personas/report'+(target?'?run_id='+encodeURIComponent(target):'')),r=await response.json();
  if(!response.ok)throw Error(r.error||'리포트를 불러오지 못했습니다.');
  render(r);$('#report').hidden=false;$('#report-run').value=r.run_id;
 }catch(e){$('#report').hidden=true;$('#download').hidden=true;$('#download-pdf').hidden=true;loadedRun=null;$('#subtitle').textContent='완료된 실행이 필요합니다.';$('#report-error').textContent=e.message;}
 finally{$('#reload').disabled=false;}
}
let screens=[],loadedRun=null;
function screenMarkup(e,title){
 if(!e?.artifact_id)return '<div class="missing-screen">문제 시점 캡처 없음</div>';
 const index=screens.push({url:'/api/artifacts/'+e.artifact_id,title,annotation:e.annotation})-1;
 return `<button class="screen-button" data-screen="${index}">${screenGraphic(screens[index],true)}<span>문제 영역 확대 · 클릭하면 원본과 박스를 크게 봅니다 ↗</span></button><p class="annotation-note">${esc(e.annotation?.note||'요소 좌표 미기록')}</p>`;
}
function screenGraphic(item,focus){
 const a=item.annotation,v=a?.viewport,regions=a?.regions||[];
 if(!v?.width||!v?.height)return `<img class="finding-screen" src="${esc(item.url)}" alt="${esc(item.title)}">`;
 let view=[0,0,v.width,v.height];
 if(focus&&regions.length){
  const left=Math.min(...regions.map(r=>r.box.x)),top=Math.min(...regions.map(r=>r.box.y));
  const right=Math.max(...regions.map(r=>r.box.x+r.box.width)),bottom=Math.max(...regions.map(r=>r.box.y+r.box.height));
  const width=Math.min(v.width,Math.max(600,right-left+60)),height=Math.min(v.height,Math.max(250,bottom-top+70));
  view=[Math.max(0,Math.min(v.width-width,(left+right-width)/2)),Math.max(0,Math.min(v.height-height,(top+bottom-height)/2)),width,height];
 }
 return `<svg class="finding-screen annotated" role="img" aria-label="${esc(item.title)}" viewBox="${view.join(' ')}"><image href="${esc(item.url)}" width="${v.width}" height="${v.height}"/>${regions.map((r,i)=>`<rect class="bbox" x="${r.box.x}" y="${r.box.y}" width="${r.box.width}" height="${r.box.height}"><title>${esc(r.label)}</title></rect><text class="bbox-number" x="${r.box.x+5}" y="${r.box.y+16}">${i+1}</text>`).join('')}</svg>`;
}
function mockupMarkup(f){
 if(!f.mockup)return '';
 const index=screens.push({url:f.mockup.image_url,title:f.mockup.label,annotation:{note:f.mockup.note,regions:[]}})-1;
 return `<section class="mockup-section"><h4>현재 화면과 개선 가설 비교</h4><p>${esc(f.mockup.note)}</p><div class="mockup-comparison"><div><span class="comparison-label">현재 · 실제 관측 화면</span>${screenMarkup(f.evidence[0],f.title+' 현재 화면')}</div><div><span class="comparison-label">${esc(f.mockup.label)}</span><button class="screen-button" data-screen="${index}"><img class="finding-screen" src="${esc(f.mockup.image_url)}" alt="AI가 생성한 가입 단계 개선 목업"><span>개선 목업 크게 보기 ↗</span></button></div></div></section>`;
}
let viewerPreviousScroll=0;
function openScreen(index){
 const item=screens[index];if(!item)return;
 $('#viewer-title').textContent=item.title;$('#viewer-note').textContent=item.annotation?.note||'원본 크기로 확인할 수 있습니다.';
 $('#viewer-scroll').innerHTML=screenGraphic(item,false);viewerPreviousScroll=parent.scrollY;parent.scrollTo(0,0);
 $('#screen-dialog').style.height=Math.floor(Math.min(innerHeight,parent.innerHeight)*.86)+'px';
 $('#screen-dialog').style.maxHeight=$('#screen-dialog').style.height;
 $('#screen-dialog').dataset.index=index;$('#screen-dialog').showModal();zoomViewer('fit');
}
function zoomViewer(level){
 const graphic=$('#viewer-scroll').firstElementChild;if(!graphic)return;
 const index=Number($('#screen-dialog').dataset.index),item=screens[index],width=item?.annotation?.viewport?.width||graphic.naturalWidth||1200;
 const height=item?.annotation?.viewport?.height||graphic.naturalHeight||900;
 graphic.style.width=(level==='fit'?Math.min($('#viewer-scroll').clientWidth,$('#viewer-scroll').clientHeight*width/height):width*Number(level))+'px';
}
function render(r){
 screens=[];loadedRun=r.run_id;$('#download-pdf').hidden=false;$('#pdf-meta').textContent='실행 ID: '+r.run_id;const s=r.summary;
 $('#subtitle').textContent=`${r.target} · ${r.variant==='problem'?'마찰 포함 흐름':'정상 흐름'} · ${r.run_id.slice(0,8)} · ${r.created_at?new Date(r.created_at).toLocaleString('ko-KR'):''}${r.audience?.age_labels?.length?' · 타겟 '+r.audience.age_labels.join(', '):''}`;
 $('#download').hidden=false;$('#download').href='/api/personas/report.md?run_id='+encodeURIComponent(r.run_id);$('#download').download='dropspot-report-'+r.run_id+'.md';
 $('#report').innerHTML=`<div class="report-scope">실제 브라우저 실행 근거 · 고정 행동 규칙 · 좌절 가중치 보정 전</div><section class="stats">${[['검토할 문제 위치',s.findings],['목표 도달',s.success],['가상 이탈',s.simulated_dropout],['기술 실패·한도',s.technical]].map(([label,n])=>`<div class="stat"><span>${label}</span><strong>${n}</strong></div>`).join('')}</section>
 <section class="report-section"><h2>먼저 확인할 부분</h2><p>같은 과업·단계·원인으로 중단한 세션을 묶었습니다. 검토 순서는 해당 문제에 걸린 가상 세션 수를 기준으로 하며, 실제 고객 영향도 순위는 아닙니다.</p>${r.findings.length?`<div class="finding-index">${r.findings.map((f,i)=>`<button data-finding="${esc(f.id)}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(f.title)}<small>${esc(f.task_name)} · ${esc(f.stage_name)}</small></span><strong>${f.affected_sessions}/${f.task_sessions}<small>과업 세션</small></strong></button>`).join('')}</div>`:'<div class="empty-report">현재 검사 규칙에 해당하는 문제가 발견되지 않았습니다. 모든 UX 문제가 없다는 뜻은 아닙니다.</div>'}</section>
 <section class="report-section"><h2>과업별 결과</h2><div class="task-matrix"><table><thead><tr><th>과업</th><th>세션</th><th>목표 도달</th><th>가상 이탈</th><th>기술 실패·한도</th></tr></thead><tbody>${r.tasks.map(t=>`<tr><th>${esc(t.name)}</th><td>${t.total}</td><td>${t.success}</td><td>${t.dropout}</td><td>${t.technical}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="report-section"><h2>문제 위치와 관측 근거</h2>${s.missing_evidence?`<div class="evidence-warning">문제 시점 화면 ${s.missing_evidence}건이 없습니다. 근거 누락을 확인해주세요.</div>`:''}${r.findings.map((f,i)=>`<article class="finding" id="finding-${esc(f.id)}"><div class="finding-heading"><div><span class="eyebrow">${esc(f.task_name)} / ${esc(f.stage_name)}</span><h3>${i+1}. ${esc(f.title)}</h3></div><span class="status">${f.affected_sessions}/${f.task_sessions} 과업 세션</span></div><div class="finding-overview"><div><h4>어디에서</h4><p>${esc(f.task_name)} → ${esc(f.stage_name)} <code>${esc(f.evidence[0]?.path||'경로 미기록')}</code></p><h4>무엇이 관측됐나</h4>${[...new Set(f.evidence.flatMap(e=>e.observations))].map(o=>`<p class="observed">${esc(o)}</p>`).join('')||'<p>상세 관측이 기록되지 않았습니다.</p>'}<h4>모형의 판단</h4><p>${esc(f.interpretation)}</p><h4>개선 가설</h4><p>${esc(f.recommendation)}</p></div><div>${screenMarkup(f.evidence[0],f.title+' 당시 실제 화면')}</div></div>${mockupMarkup(f)}<details><summary>영향받은 ${f.affected_sessions}개 세션의 경로·점수·화면</summary><div class="session-evidence">${f.evidence.map(e=>`<div><h4>${esc(e.persona_name)} · ${e.width||'—'}px</h4><p>${esc(e.session_id)} · 관측 ${e.step??'—'}</p><p>${e.steps_before.length?esc(e.steps_before.join(' → ')):'직전 행동 기록 없음'} → ${esc(f.stage_name)}</p><p>좌절 점수 ${e.score??'—'} / 임계치 ${e.threshold??'—'}</p>${e.artifact_id?`<a href="/api/artifacts/${esc(e.artifact_id)}" target="_blank" rel="noopener">해당 세션의 문제 화면 ↗</a>`:'<span class="status">문제 시점 화면 누락</span>'}</div>`).join('')}</div></details></article>`).join('')||'<p>관측된 문제 없음</p>'}</section>
 <section class="report-section"><h2>실행 오류는 따로 확인하세요</h2>${r.technical_failures.length?r.technical_failures.map(e=>`<div class="technical"><b>${esc(e.task_name)} / ${esc(e.persona_name)}</b><p>${esc(e.status)} · ${esc(e.reason)}</p></div>`).join(''):'<p>기술 실패·인증 차단·시간/행동 한도 초과는 없었습니다.</p>'}</section>
 <section class="report-section"><h2>Human Alignment</h2><p>사람 ${r.alignment.participants||0}명 · 사람×과업 관측 ${r.alignment.observations||0}건 · ${r.alignment.observations?'수동 관측, 독립 검증 전':'미검증 · 사람 관측 없음'}</p><div class="alignment-metrics">${[['outcome','완료·중단 결과'],['stage','중단 단계'],['cause','중단 원인']].map(([key,title])=>{const m=r.alignment.metrics?.[key];return `<div class="stat"><span>${title} 일치</span><strong>${m?.total?Math.round(m.rate*100)+'%':'—'}</strong><small>${m?.total?`${m.matched}/${m.total}건`:'비교 관측 없음'}</small></div>`;}).join('')}</div></section><footer>${r.limitations.map(l=>`<p>${esc(l)}</p>`).join('')}</footer>`;
}
$('#report').onclick=e=>{const image=e.target.closest('[data-screen]');if(image){openScreen(Number(image.dataset.screen));return;}const b=e.target.closest('[data-finding]');if(b)document.getElementById('finding-'+b.dataset.finding)?.scrollIntoView({behavior:'smooth',block:'start'});};
$('#reload').onclick=load;
new ResizeObserver(()=>parent.postMessage({type:'report-height',height:Math.ceil(document.body.getBoundingClientRect().height)+24},location.origin)).observe(document.body);
load();

$('#report-run').onchange=()=>{const id=$('#report-run').value;if(!id)return;if(parent!==window)parent.location.hash='report/'+encodeURIComponent(id);else location.search='?run_id='+encodeURIComponent(id);};

$('#viewer-close').onclick=()=>$('#screen-dialog').close();
$('#screen-dialog').addEventListener('click',e=>{const button=e.target.closest('[data-zoom]');if(button)zoomViewer(button.dataset.zoom);});

$('#screen-dialog').addEventListener('close',()=>parent.scrollTo(0,viewerPreviousScroll));

$('#download-pdf').onclick=async()=>{
 const run=loadedRun;if(!run)return;
 const button=$('#download-pdf');button.disabled=true;button.textContent='PDF 생성 중…';$('#report-error').textContent='';
 try{
  const response=await fetch('/api/personas/report.pdf?run_id='+encodeURIComponent(run));
  if(!response.ok){const error=await response.json();throw Error(error.error||'PDF를 생성하지 못했습니다.');}
  const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='dropspot-report-'+run+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){$('#report-error').textContent=e.message;}
 finally{button.disabled=false;button.textContent='PDF 내보내기';}
};
