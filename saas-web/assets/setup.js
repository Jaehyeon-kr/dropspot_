/* Three short confirmations. No personas execute until the final explicit action. */
(()=>{
 let plan=null,step=0,features=new Set(),tasks=new Set(),ages=new Set(['any']),context='',additional='',confirming=false,previousScroll=0,previousOverflow='';
 const dialog=$('#setup-dialog');
 function draw(){
  $('#setup-error').textContent='';$('#setup-back').hidden=step<2;$('#setup-next').hidden=step===0;$('#setup-next').disabled=confirming;
  $('#setup-next').textContent=step===3?'확인하고 실행':'다음';$('#setup-next').classList.toggle('setup-primary',true);
  $('#setup-count').textContent=step>=2?`3개 페르소나 × ${tasks.size}개 과업`:'';
  document.querySelectorAll('.setup-progress li').forEach((li,i)=>li.classList.toggle('current',i+1===step));
  if(step===0){$('#setup-title').textContent='사이트를 먼저 살펴보고 있어요.';$('#setup-content').innerHTML='<div class="setup-loading">시작 화면의 메뉴와 기능을 읽고 있습니다.<small>입력·주문·계정 변경은 하지 않습니다.</small></div>';return;}
  if(step===1){$('#setup-title').textContent='이런 기능이 있는 서비스가 맞나요?';$('#setup-content').innerHTML=`<p>시작 화면에서 아래 기능의 진입 메뉴를 찾았어요. 맞는 기능만 남겨주세요.</p><div class="setup-options">${plan.features.map(f=>`<label class="setup-option"><input type="checkbox" data-feature="${f.id}" ${features.has(f.id)?'checked':''}><span><b>${esc(f.name)}</b><small>발견한 메뉴: ${esc(f.evidence.label)} · ${esc(f.evidence.path)}</small></span></label>`).join('')}</div><p class="setup-note">메뉴가 존재한다는 확인입니다. 기능이 정상 작동하는지는 실행하면서 확인합니다.</p>`;}
  if(step===2){$('#setup-title').textContent='이 과업들로 확인해볼까요?';const available=plan.tasks.filter(t=>features.has(t.feature_id));$('#setup-content').innerHTML=`<p>빼고 싶은 과업은 선택을 해제하고, 추가 제안도 골라보세요.</p><div class="setup-options">${available.map(t=>`<label class="setup-option"><input type="checkbox" data-task="${t.id}" ${tasks.has(t.id)?'checked':''}><span><b>${esc(t.name)}${!t.suggested?' <em>추가 제안</em>':''}</b><small>${esc(t.goal)}</small></span></label>`).join('')}</div><label class="setup-field">그 외 확인하고 싶은 과업 메모<textarea id="additional-request" maxlength="500" rows="2" placeholder="추가로 확인하고 싶은 내용이 있나요?">${esc(additional)}</textarea></label><p class="setup-note">목록 밖의 메모는 별도로 저장하며 이번 실행에 자동 포함하지 않습니다.</p>`;}
  if(step===3){$('#setup-title').textContent='주로 어떤 연령대의 고객이 쓰나요?';$('#setup-content').innerHTML=`<p>주요 고객층을 골라주세요. 여러 개를 선택해도 괜찮아요.</p><div class="age-options">${Object.entries(plan.age_options).map(([id,label])=>`<label><input type="checkbox" data-age="${id}" ${ages.has(id)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div><label class="setup-field">이용 상황이나 고객 설명 <small>선택</small><textarea id="target-context" maxlength="500" rows="2" placeholder="예: 출근길에 첫 주문을 하는 직장인">${esc(context)}</textarea></label><p class="setup-note">연령은 타겟 맥락으로 저장합니다. 나이만으로 숙련도나 인내심을 단정하지 않습니다.</p><div class="setup-summary"><b>이번에 실행할 과업</b><p>${plan.tasks.filter(t=>tasks.has(t.id)).map(t=>esc(t.name)).join(' · ')}</p><span>3개 페르소나 · ${tasks.size*3}개 독립 세션</span></div>`;}
 }
 async function begin(){
  if(state.status==='running')return;
  previousScroll=parent.scrollY;previousOverflow=parent.document.documentElement.style.overflow;parent.scrollTo(0,0);parent.document.documentElement.style.overflow='hidden';
  plan=null;step=0;features=new Set();tasks=new Set();ages=new Set(['any']);context='';additional='';
  dialog.style.height=Math.floor(Math.min(innerHeight,parent.innerHeight)*.9)+'px';dialog.showModal();draw();busy=true;render();
  const selectedTask=$('#task').value;
  try{
   plan=await api('/api/personas/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant:$('#variant').value})});
   features=new Set(plan.features.map(f=>f.id));tasks=new Set(plan.tasks.filter(t=>selectedTask==='all'?t.suggested:t.id===selectedTask).map(t=>t.id));
   step=1;draw();
  }catch(e){$('#setup-content').innerHTML='<p>사이트를 살펴보지 못했어요. 닫고 다시 시도해주세요.</p>';$('#setup-error').textContent=e.message;}
  finally{busy=false;render();}
 }
 $('#start').onclick=begin;
 $('#setup-close').onclick=()=>{if(!confirming)dialog.close();};
 dialog.addEventListener('cancel',e=>{if(confirming)e.preventDefault();});
 dialog.addEventListener('close',()=>{parent.document.documentElement.style.overflow=previousOverflow;parent.scrollTo(0,previousScroll);$('#start').focus({preventScroll:true});});
 $('#setup-back').onclick=()=>{if(step>1){step--;draw();}};
 $('#setup-next').onclick=async()=>{
  if(!features.size){$('#setup-error').textContent='기능을 한 개 이상 확인해주세요.';return;}
  if(step===2&&!tasks.size){$('#setup-error').textContent='과업을 한 개 이상 골라주세요.';return;}
  if(step<3){step++;draw();return;}
  if(!ages.size){$('#setup-error').textContent='타겟 연령을 골라주세요.';return;}
  confirming=true;$('#setup-next').disabled=true;$('#setup-back').disabled=true;$('#setup-close').disabled=true;
  try{
   state=await api('/api/personas/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:plan.plan_id,feature_ids:[...features],task_ids:[...tasks],ages:[...ages],context,additional_request:additional})});
   selected=state.sessions[0]?.id;selectedStep=null;sessionFilter='all';dialog.close();render();
  }catch(e){$('#setup-error').textContent=e.message;}
  finally{confirming=false;$('#setup-next').disabled=false;$('#setup-back').disabled=false;$('#setup-close').disabled=false;}
 };
 $('#setup-content').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.feature){if(t.checked)features.add(t.dataset.feature);else{features.delete(t.dataset.feature);for(const task of plan.tasks)if(task.feature_id===t.dataset.feature)tasks.delete(task.id);}}
  if(t.dataset.task){if(t.checked)tasks.add(t.dataset.task);else tasks.delete(t.dataset.task);$('#setup-count').textContent=`3개 페르소나 × ${tasks.size}개 과업`;}
  if(t.dataset.age){if(t.checked){if(t.dataset.age==='any')ages=new Set(['any']);else{ages.delete('any');ages.add(t.dataset.age);}}else ages.delete(t.dataset.age);document.querySelectorAll('[data-age]').forEach(input=>input.checked=ages.has(input.dataset.age));}
 });
 $('#setup-content').addEventListener('input',e=>{if(e.target.id==='additional-request')additional=e.target.value;if(e.target.id==='target-context')context=e.target.value;});
})();
