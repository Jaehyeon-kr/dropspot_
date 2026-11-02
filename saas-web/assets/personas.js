const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={status:'idle',sessions:[],profiles:[]},selected=null,selectedStep=null,busy=false,frameURL='',sessionFilter='all';
const labels={queued:'대기',running:'실행 중',success:'목표 도달',simulated_dropout:'가상 이탈',agent_failure:'실행 오류',budget_exceeded:'한도 도달'};
const image=s=>s.artifact_id?'/api/artifacts/'+s.artifact_id+'?step='+s.steps:'';
const previewPath=s=>{try{return new URL(s.url).pathname;}catch{return '/';}};
async function api(path,options){const r=await fetch(path,options),v=await r.json();if(!r.ok)throw Error(v.error||'연결 오류');return v;}
function render(){
 const ready=state.status==='completed'&&state.id;$('#open-report').hidden=!ready;if(ready)$('#open-report').href='/#report/'+encodeURIComponent(state.id);$('#report-message').textContent=ready?'문제 위치 · 영향받은 세션 · 당시 화면 · 개선 가설을 확인하세요.':'실행을 완료하면 리포트가 자동으로 준비됩니다.';
 const list=state.sessions.length?state.sessions:state.profiles.map(p=>({...p,status:'queued',steps:0,reason:'실행 전'}));
 $('#start').disabled=busy||state.status==='running';$('#variant').disabled=state.status==='running';$('#task').disabled=state.status==='running';
 $('#start').textContent=state.status==='running'?'브라우저 실행 중':'실행 준비';
 $('#stats').innerHTML=[['실행 세션',state.sessions.length],['진행 중',state.sessions.filter(s=>['queued','running'].includes(s.status)).length],['목표 도달',state.sessions.filter(s=>s.status==='success').length],['가상 이탈',state.sessions.filter(s=>s.status==='simulated_dropout').length]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
 const visible=list.filter(s=>sessionFilter==='all'||s.status===sessionFilter);
 $('#cards').innerHTML=visible.map((s,i)=>`<button class="persona ${selected===s.id?'selected':''}" data-id="${esc(s.id)}" aria-label="${esc(s.name)} 상세 보기"><div class="browser-chrome"><span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="browser-address">반찬로드 ${esc(previewPath(s))}</span><span class="browser-expand" aria-hidden="true">↗</span></div>${image(s)?`<img class="preview" src="${image(s)}" alt="${esc(s.name)} 실제 화면">`:`<div class="placeholder">0${i+1}</div>`}<div class="card-body"><div class="card-head"><span class="name">${esc(s.name)}</span><span class="status session-status status-${esc(s.status)}">${esc(labels[s.status])}</span></div><span class="task-label">${esc(s.task_name||'과업 실행 전')}</span><p>${esc(s.context)}</p><div class="meta"><span>필수 입력 허용 ${s.max_required_fields}개</span><span>${s.width}px · ${s.steps}회 행동</span></div><div class="sensitivity">탐색 비용 ×${s.search_sensitivity??1} · 늦은 비용 노출 ×${s.cost_sensitivity??1}</div><div class="reason" title="${esc(s.reason)}">${esc(s.reason)}</div></div></button>`).join('');
 renderWorkspace(list,visible);renderMatrix();renderAlignment();
 const s=state.sessions.find(s=>s.id===selected);$('#detail').hidden=!s;if(!s)return;
 renderFrustration(s);
 $('#detail-title').textContent=s.name+' · '+(s.task_name||'첫 주문');$('#detail-context').textContent=(s.goal||'과업 확인')+' · '+s.context;
 const live=s.status==='running'&&s.viewer_url&&!$('#agent-popup').open;
 $('#stream').hidden=!live;$('#evidence').hidden=!!live||!image(s)||!!s.trace?.length;$('#external').hidden=!live;
 if(live){const url=s.viewer_url.replace('localhost',location.hostname);if(frameURL!==url){$('#stream').src=url;frameURL=url;}$('#external').href=url;}
 else if(frameURL){$('#stream').removeAttribute('src');frameURL='';}
 if(image(s)&&$('#evidence').getAttribute('src')!==image(s))$('#evidence').src=image(s);
 $('#live-hint').textContent=live?'실제 전송 화면입니다. 검은 원이 마우스 좌표를 표시합니다. 관찰 중에는 Take control을 누르지 마세요.':'실행은 종료됐으며 마지막 화면과 행동 기록을 표시합니다.';
 $('#events').innerHTML=(s.events||[]).map(e=>`<span class="event">${e.step}. ${esc(e.description)}</span>`).join('');
 if($('#agent-popup').open)updateAgentPopup();
}
let snapshotSignature='';
async function refresh(){try{const incoming=await api('/api/personas'),signature=JSON.stringify(incoming);$('#error').textContent='';if(signature===snapshotSignature)return;snapshotSignature=signature;state=incoming;if(!selected&&state.sessions.length)selected=state.sessions[0].id;render();}catch(e){$('#error').textContent=e.message;}}

$('#cards').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openAgentPopup(b.dataset.id);};
refresh();setInterval(refresh,1500);
const stageNames={landing:'랜딩',product:'상품',cart:'장바구니',signup:'가입',checkout:'배송 입력',complete:'과업 완료',delivery:'지역 조회',benefits:'쿠폰 탐색',coupon:'쿠폰 발급',account:'내 구독',subscription:'배송 변경'};
const causeNames={input_burden:'입력 부담',navigation:'탐색 실패',cost:'비용 충격',value:'가치 불명확',trust:'신뢰 부족',technical:'기술 오류·지연',accessibility:'접근성 장벽',unknown:'미상',none:'중단 원인 없음'};
function pointFacts(point){
 const sig=point.signals||{},facts=[];
 if(sig.new_required_fields)facts.push(`새 필수 입력 ${sig.new_required_fields}개를 만났어요`);
 if(sig.search_scroll)facts.push('다음 동작을 찾으며 화면을 더 내려봤어요');
 if(sig.revisit)facts.push('이미 방문했던 단계로 돌아왔어요');
 if(sig.unexpected_cost)facts.push('배송비 3,500원이 뒤늦게 표시됐어요');
 if(!facts.length)facts.push(point.stage==='complete'?'과업 완료 화면에 도착했어요':'추가 부담 신호 없이 진행했어요');
 return facts;
}
function renderFrustration(s){
 const technicalOpen=$('#frustration .journey-technical')?.open;
 const trace=s.trace||[],model=state.frustration_model;
 if(!trace.length){$('#frustration').innerHTML='<h2>어디서 흐름이 끊겼나요?</h2><p>브라우저가 움직이면 방문 경로와 부담이 생긴 순간을 여기에 표시합니다.</p>';return;}
 const peak=trace.reduce((best,p)=>p.score>best.score?p:best,trace[0]);
 const stopped=trace.find(p=>p.crossed),defaultPoint=stopped||(peak.score>0?peak:trace.at(-1));
 const point=trace.find(p=>p.step===selectedStep)||defaultPoint,max=Math.max(100,...trace.map(p=>p.score),point.threshold*1.2);
 const groups=[];
 for(const p of trace){const last=groups.at(-1);if(last?.stage===p.stage)last.points.push(p);else groups.push({stage:p.stage,points:[p]});}
 const x=i=>45+i*680/Math.max(1,trace.length-1),y=v=>175-v/max*145;
 const success=s.status==='success',drop=s.status==='simulated_dropout';
 const title=drop?`${stageNames[stopped?.stage||s.terminal_stage]||'이 단계'}에서 멈췄어요`:success?'목표까지 진행했어요':['queued','running'].includes(s.status)?'지금까지의 이동 경로예요':'실행을 끝까지 확인하지 못했어요';
 $('#frustration').innerHTML=`<div class="section-head"><h2>어디서 흐름이 끊겼나요?</h2><span class="status">가상 사용자 관측</span></div>
 <div class="journey-summary ${drop?'journey-stop':success?'journey-success':'journey-working'}"><span class="journey-summary-icon">${success?'<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>':drop?'!':'…'}</span><div><h3>${esc(title)}</h3><p>${drop?esc(pointFacts(stopped||point).join(' · '))+' — 설정한 모의 중단 기준을 넘었습니다.':success?`${esc(s.task_name||'과업')} 완료. 아래에서 각 단계에 어떤 요구가 있었는지 확인하세요.`:esc(s.reason)}</p></div></div>
 <p class="journey-guide">단계를 누르면 당시 화면과 관측한 내용을 볼 수 있어요.</p>
 <div class="journey-track">${groups.map((group,i)=>{const representative=group.points.find(p=>p.crossed)||group.points.reduce((best,p)=>p.score>best.score?p:best,group.points[0]);const selected=group.points.some(p=>p.step===point.step);const tone=group.points.some(p=>p.crossed)?'stop':representative.score>representative.threshold*.65?'warning':'pass';const stateLabel=tone==='stop'?'여기서 중단':group.stage==='complete'?'과업 완료':i<groups.length-1?'다음 단계로 이동':'확인한 단계';return `<button class="journey-stage ${tone} ${selected?'selected':''}" aria-pressed="${selected}" data-step="${representative.step}"><span class="journey-step-number">${i+1}</span><strong>${esc(stageNames[group.stage]||group.stage)}</strong><small>${stateLabel}</small>${representative.signals.new_required_fields?`<span class="journey-clue">필수 입력 ${representative.required_fields}개</span>`:representative.signals.unexpected_cost?'<span class="journey-clue">배송비 추가</span>':representative.signals.search_scroll?'<span class="journey-clue">화면 탐색</span>':'<span class="journey-clue">화면 확인</span>'}</button>`;}).join('')}</div>
 <div class="journey-insight"><div><span class="eyebrow">선택한 순간 / 관측 ${point.step}</span><h3>${esc(stageNames[point.stage])}에서 있었던 일</h3><ul>${pointFacts(point).map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p>${point.crossed?'이 관측 직후 에이전트가 가상 이탈했습니다.':'이 순간에는 모의 중단 기준을 넘지 않았습니다.'}</p><small>실제 사람의 감정이나 중단 이유를 확인한 결과는 아닙니다.</small></div>${point.artifact_id?`<a class="journey-screenshot" href="/api/artifacts/${point.artifact_id}" target="_blank" rel="noopener"><img src="/api/artifacts/${point.artifact_id}" alt="관측 ${point.step} ${esc(stageNames[point.stage])} 화면 근거"><span>당시 화면 크게 보기 ↗</span></a>`:''}</div>
 <details class="journey-technical" ${technicalOpen?'open':''}><summary>점수 그래프와 계산 근거 보기</summary><p>초기 가중치를 적용한 모형 값입니다. 실제 이탈 확률이 아니며 사람 데이터로 보정하지 않았습니다.</p><p class="formula">${esc(model.formula)}</p><svg class="score-chart" viewBox="0 0 760 210" role="img" aria-label="${esc(s.name)} 좌절 점수 추이와 임계치 ${point.threshold}"><line x1="45" x2="725" y1="175" y2="175" stroke="#ddd"/><text x="5" y="180">0</text><text x="5" y="30">${Math.round(max)}</text><line x1="45" x2="725" y1="${y(point.threshold)}" y2="${y(point.threshold)}" stroke="#999" stroke-dasharray="5 5"/><text x="600" y="${Math.max(15,y(point.threshold)-8)}">임계치 ${point.threshold}</text><polyline fill="none" stroke="#111" stroke-width="2" points="${trace.map((p,i)=>`${x(i)},${y(p.score)}`).join(' ')}"/>${trace.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.score)}" r="${p.step===point.step?5:3}" fill="#111"/>`).join('')}</svg><div class="trace-steps">${trace.map(p=>`<button class="trace-step ${p.step===point.step?'active':''}" data-step="${p.step}">${p.step}. ${esc(stageNames[p.stage]||p.stage)} <b>${p.score.toFixed(1)}</b></button>`).join('')}</div><p class="calculation">${point.terms.retained.toFixed(2)} (이전 점수 × 0.85) + ${point.terms.input} (입력) + ${point.terms.revisit} (재방문) + ${point.terms.search||0} (탐색) + ${point.terms.cost||0} (비용) − ${point.terms.progress_reward} (진전) = <b>${point.score.toFixed(2)}</b> / 임계치 ${point.threshold}</p></details>`;
}

let alignmentSignature='';
function renderAlignment(){
 const a=state.alignment||{status:'unverified',participants:0,observations:0,excluded:0,metrics:{}},signature=JSON.stringify([state.id,state.status,state.human_observations,a]);
 // Preserve partially entered human observations across polling updates.
 if(signature===alignmentSignature)return;alignmentSignature=signature;
 const metric=(key,title)=>{const m=a.metrics[key]||{total:0};return `<div class="stat"><span>${title}</span><strong>${m.total?Math.round(m.rate*100)+'%':'—'}</strong><small>${m.total?`${m.matched} / ${m.total}건 일치`:'비교 가능한 관측 없음'}</small></div>`;};
 $('#alignment').innerHTML=`<div class="section-head"><div><span class="eyebrow">HUMAN ALIGNMENT</span><h2>실제 사람과 얼마나 일치했나요?</h2></div><span class="status">${a.observations?'수동 관측 · 독립 검증 전':'미검증 · 사람 관측 없음'}</span></div><p>현재 실행의 같은 버전·과업·기기 조건에서 관찰한 사람을 페르소나에 대응시킵니다. 종합 신뢰도는 산출하지 않습니다.</p><div class="alignment-metrics">${metric('outcome','완료·중단 결과 일치')}${metric('stage','사람이 중단한 단계 일치')}${metric('cause','사람이 보고한 중단 원인 일치')}</div><p class="sample-note">익명 참여자 ${a.participants}명 · 사람×과업 관측 ${a.observations}건 · 에이전트 미완료·기술 실패로 비교 제외 ${a.excluded}건. 단계 지표는 사람 중단 건만, 원인 지표는 그중 원인을 아는 건만 계산합니다.</p><p>수동 입력 기록이며 진위는 독립 검증하지 않았습니다. 한 사람이 여러 과업을 수행한 관측은 독립 표본이 아닙니다. 적은 표본의 일치율을 전체 고객의 이탈 예측 정확도로 해석할 수 없습니다.</p><details><summary>실제 사람의 관측 등록</summary><p>실제로 수행한 테스트만 입력하세요. 같은 과업의 같은 익명 참여자 ID는 중복 집계하지 않고 기존 관측을 수정합니다. 이름·연락처 대신 연구용 익명 ID를 사용하세요.</p><form id="human-form"><fieldset ${state.status==='completed'?'':'disabled'}><div class="human-fields"><label>대응 페르소나<select name="persona_id" aria-label="대응 페르소나">${state.sessions.map(s=>`<option value="${esc(s.id)}">${esc(s.task_name||'첫 주문')} / ${esc(s.name)} · ${s.width}px</option>`).join('')}</select></label><label>익명 참여자 ID<input name="participant_id" required maxlength="40" pattern="[A-Za-z0-9_-]+" placeholder="예: P01"></label><label>관측 결과<select name="outcome" aria-label="관측 결과"><option value="dropout">중단</option><option value="success">과업 완료</option></select></label><label>종료 단계<select name="stage" aria-label="종료 단계">${Object.entries(stageNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>참여자가 말한 중단 원인<select name="cause" aria-label="참여자가 말한 중단 원인">${Object.entries(causeNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>관측 출처·기록<input name="source" required minlength="3" maxlength="300" placeholder="테스트 날짜·기록 위치·같은 과업 여부"></label></div><p>현재 비교: ${state.variant==='problem'?'마찰 포함':'정상'} 버전 · 선택한 세션의 과업. 사람에게도 대응 페르소나의 화면 크기를 적용하고, 원인은 참여자 설명을 기준으로 기록하세요.</p><button type="submit">사람 관측 저장</button><span id="human-result" role="status"></span></fieldset></form>${state.status!=='completed'?'<p>페르소나 실행을 완료하면 입력할 수 있습니다.</p>':''}</details>${(state.human_observations||[]).length?`<div class="human-records">${state.human_observations.map(r=>`<p><b>${esc(r.participant_id)}</b> → ${esc(state.sessions.find(s=>s.id===r.persona_id)?.name)} / ${esc(state.tasks?.find(t=>t.id===r.task_id)?.name||'첫 주문')} · ${r.outcome==='success'?'완료':'중단'} · ${esc(stageNames[r.stage])} · ${esc(causeNames[r.cause])}<br><small>${esc(r.source)}</small></p>`).join('')}</div>`:''}`;
}
$('#frustration').onclick=e=>{const b=e.target.closest('[data-step]');if(b){selectedStep=Number(b.dataset.step);const s=state.sessions.find(s=>s.id===selected);if(s)renderFrustration(s);}};
$('#alignment').addEventListener('change',e=>{if(e.target.name==='outcome'){const form=$('#human-form');if(e.target.value==='success'){form.elements.stage.value='complete';form.elements.cause.value='none';}else{form.elements.stage.value='checkout';form.elements.cause.value='unknown';}}});
$('#alignment').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit]');button.disabled=true;try{const body={...Object.fromEntries(new FormData(form)),run_id:state.id};state=await api('/api/personas/human',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});render();}catch(error){$('#human-result').textContent=error.message;button.disabled=false;}});
new ResizeObserver(()=>parent.postMessage({type:'personas-height',height:Math.ceil(document.body.getBoundingClientRect().height)+24},location.origin)).observe(document.body);

function renderMatrix(){
 const tasks=(state.tasks||[]).filter(t=>state.sessions.some(s=>s.task_id===t.id));
 if(!tasks.length){$('#matrix').innerHTML='';return;}
 $('#matrix').innerHTML=`<div class="task-matrix"><table><thead><tr><th>과업 / 페르소나</th>${state.profiles.map(p=>`<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${tasks.map(t=>`<tr><th>${esc(t.name)}<small>${esc(t.goal)}</small></th>${state.profiles.map(p=>{const s=state.sessions.find(s=>s.task_id===t.id&&(s.profile_id||s.id)===p.id);return `<td>${s?`<button data-session="${esc(s.id)}">${esc(labels[s.status])}<small>${esc(stageNames[s.terminal_stage]||'준비 중')}${s.issue?' · '+esc(causeNames[s.issue.category]):''}</small></button>`:'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
$('#task').onchange=render;
$('#matrix').onclick=e=>{const b=e.target.closest('[data-session]');if(b){selected=b.dataset.session;selectedStep=null;render();}};

function renderWorkspace(list,visible){
 const actual=state.sessions,groups=new Map();
 for(const s of actual.filter(s=>s.status==='simulated_dropout')){
  const key=[s.task_id,s.terminal_stage,s.issue?.category].join('/');
  if(!groups.has(key))groups.set(key,{session:s,count:0});groups.get(key).count++;
 }
 const findings=[...groups.values()].sort((a,b)=>b.count-a.count),failed=actual.filter(s=>['agent_failure','budget_exceeded','blocked_auth','site_failure'].includes(s.status));
 $('#run-state').textContent=(state.status==='running'?'실행 중':state.status==='completed'?'실행 완료':'실행 전')+(state.id?' · '+(state.variant==='problem'?'마찰 포함':'정상 흐름'):'');
 $('#run-finding').textContent=state.status==='running'?`${actual.filter(s=>!['queued','running'].includes(s.status)).length}/${actual.length}개 세션 종료 · ${findings.length}곳의 중단 지점을 확인 중입니다.`:state.status==='completed'?`${actual.length}개 세션에서 ${findings.length}곳의 가상 중단 지점을 확인했습니다.`:'첫 주문부터 배송 변경까지, 같은 과업을 다른 조건으로 확인합니다.';
 $('#session-filters').innerHTML=[['all','전체'],['running','실행 중'],['success','목표 도달'],['simulated_dropout','가상 이탈']].map(([key,title])=>`<button data-session-filter="${key}" aria-pressed="${key===sessionFilter}" class="${key===sessionFilter?'active':''}">${title}<span> ${key==='all'?actual.length:actual.filter(s=>s.status===key).length}</span></button>`).join('');
 $('#board-count').textContent=actual.length?`${visible.length}개 화면`:'실행 대기';
 if(!visible.length)$('#cards').innerHTML='<div class="board-empty">이 상태의 세션이 없습니다.</div>';
 $('#review-queue').innerHTML=`<div class="rail-heading"><h2>먼저 볼 곳</h2><span>${findings.length}</span></div>${findings.length?findings.slice(0,5).map(({session:s,count})=>`<button class="review-item" data-review-session="${esc(s.id)}"><span class="review-mark" aria-hidden="true"></span><span><b>${esc(s.task_name||'첫 주문')}</b><small>${esc(stageNames[s.terminal_stage]||s.terminal_stage)} · ${esc(causeNames[s.issue?.category]||'모의 중단')}</small></span><span class="review-count">${count}<small>세션</small></span></button>`).join(''):`<div class="review-empty">${state.status==='completed'?'가상 중단이 없었습니다.':'세션이 진행되면 중단 위치가 여기에 모입니다.'}<small>입력·탐색·배송비 신호를 기준으로 확인합니다.</small></div>`}${failed.length?`<div class="execution-notice">실행 오류·한도 ${failed.length}건<small>가상 이탈과 별도로 확인하세요.</small></div>`:''}`;
}
$('#session-filters').onclick=e=>{const b=e.target.closest('[data-session-filter]');if(b){sessionFilter=b.dataset.sessionFilter;render();}};
$('#review-queue').onclick=e=>{const b=e.target.closest('[data-review-session]');if(b){selected=b.dataset.reviewSession;selectedStep=null;render();$('#detail').scrollIntoView({behavior:'smooth',block:'start'});}};

let popupFrameURL='',popupScroll=0,popupOverflow='';
const autoExplanationAttempts=new Set();
function openAgentPopup(id){
 const session=state.sessions.find(s=>s.id===id);
 if(!session)return;
 selected=id;selectedStep=null;
 popupScroll=parent.scrollY;popupOverflow=parent.document.documentElement.style.overflow;
 parent.scrollTo(0,0);parent.document.documentElement.style.overflow='hidden';
 const popup=$('#agent-popup');popup.style.height=Math.floor(Math.min(760,Math.min(innerHeight,parent.innerHeight)*.84))+'px';
 popup.showModal();render();$('#agent-popup-close').focus({preventScroll:true});
}
function updateAgentPopup(){
 const s=state.sessions.find(s=>s.id===selected);if(!s){$('#agent-popup').close();return;}
 $('#agent-popup-title').textContent=s.name+' · '+(s.task_name||'첫 주문');
 const status=$('#agent-popup-status');status.textContent=labels[s.status]||s.status;status.className='status session-status status-'+s.status;
 $('#agent-popup-goal').textContent=s.goal||s.context;
 $('#agent-popup-action').textContent=s.reason||'브라우저를 준비하고 있습니다.';
 $('#agent-popup-path').textContent=previewPath(s);
 $('#agent-popup-facts').innerHTML=`<span>${s.width}px 화면</span><span>${s.steps}회 행동</span>`;
 const live=s.status==='running'&&s.viewer_url;
 $('#agent-popup-stream').hidden=!live;$('#agent-popup-image').hidden=!!live||!image(s);
 $('#agent-popup-empty').hidden=!!live||!!image(s);
 $('#agent-popup-empty').textContent=s.status==='queued'?'실행 순서를 기다리고 있습니다.':'브라우저 화면을 연결하고 있습니다.';
 $('#agent-popup-mode').textContent=live?'실시간 관찰':s.status==='running'?'현재 진행 상황':'종료된 세션 · 마지막 관측';
 if(live){const url=s.viewer_url.replace('localhost',location.hostname);if(url!==popupFrameURL){$('#agent-popup-stream').src=url;popupFrameURL=url;}}
 else if(popupFrameURL){$('#agent-popup-stream').removeAttribute('src');popupFrameURL='';}
 if(image(s)&&$('#agent-popup-image').getAttribute('src')!==image(s))$('#agent-popup-image').src=image(s);
 $('#agent-popup-events').innerHTML=(s.events||[]).slice(-8).map(e=>`<li><span>${e.step}</span><div>${esc(e.description)}</div><button type="button" data-ask-step="${e.step}" aria-label="행동 ${e.step} 설명 묻기">왜?</button></li>`).join('')||'<li class="no-actions">아직 실행한 행동이 없습니다.</li>';
 renderPopupAnswers(s);
 const autoKey=state.id+'/'+s.id;
 if(!['queued','running'].includes(s.status)&&!(s.answers||[]).some(a=>a.question==='왜 멈췄나요?')&&!autoExplanationAttempts.has(autoKey)){
  autoExplanationAttempts.add(autoKey);
  $('#agent-popup-answers').textContent='종료 이유를 실행 기록에서 확인하고 있습니다…';
  askSession('왜 멈췄나요?',undefined,true);
 }
}
$('#agent-popup-close').onclick=()=>$('#agent-popup').close();
$('#agent-popup').addEventListener('close',()=>{
 $('#agent-popup-stream').removeAttribute('src');popupFrameURL='';
 parent.document.documentElement.style.overflow=popupOverflow;parent.scrollTo(0,popupScroll);
 render();document.querySelector(`[data-id="${CSS.escape(selected||'')}"]`)?.focus({preventScroll:true});
});
$('#agent-popup').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();});

let answerSignature='';
function renderPopupAnswers(s){
 const signature=JSON.stringify([s.id,s.answers||[]]);if(signature===answerSignature)return;answerSignature=signature;
 $('#agent-popup-answers').innerHTML=[...(s.answers||[])].sort((a,b)=>Number(b.question==='왜 멈췄나요?')-Number(a.question==='왜 멈췄나요?')).map(a=>`<article class="session-answer"><div class="asked-question">${esc(a.question)}</div><p>${esc(a.answer)}</p>${a.sources?.length?`<div class="answer-sources">${a.sources.map(source=>source.artifact_id?`<a href="/api/artifacts/${esc(source.artifact_id)}" target="_blank" rel="noopener">관측 ${source.step} · ${esc(source.stage_name)} 화면 ↗</a>`:`<span>관측 ${source.step} · ${esc(source.stage_name)}</span>`).join('')}</div>`:''}<small>${a.supported_by_record?'실행 기록 기반 설명':'기록으로 확인할 수 없음'}</small></article>`).join('');
}
async function askSession(question,step,automatic=false){
 const sid=selected,run=state.id,button=$('#agent-question-send');button.disabled=true;$('#agent-question-error').textContent='';
 try{
  const body={run_id:run,session_id:sid,question,...(step?{step}:{})};
  const answer=await api('/api/personas/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(state.id===run){const s=state.sessions.find(s=>s.id===sid);if(s){if(!(s.answers||[]).some(existing=>existing.id===answer.id))s.answers=[...(s.answers||[]),answer].slice(-20);if(selected===sid){renderPopupAnswers(s);if(!automatic){$('#agent-question').value='';$('#agent-popup-answers').lastElementChild?.scrollIntoView({block:'nearest'});}}}}
 }catch(e){$('#agent-question-error').textContent=e.message;}finally{button.disabled=false;}
}
$('#agent-question-form').onsubmit=e=>{e.preventDefault();askSession($('#agent-question').value);};
$('#agent-popup').addEventListener('click',e=>{const question=e.target.closest('[data-question]'),step=e.target.closest('[data-ask-step]');if(question)askSession(question.dataset.question);if(step)askSession(`행동 ${step.dataset.askStep}은 왜 했나요?`,Number(step.dataset.askStep));});
