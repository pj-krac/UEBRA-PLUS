// Se carga antes del script principal. El control ocurre antes de abrir la aplicación.
async function uebraPasswordGate(user) {
 if (!navigator.onLine) {
  if(user.app_metadata?.uebra_must_change_password){document.querySelector('#loginmsg').textContent='Conéctese para cambiar su contraseña temporal.';return false}
  return true;
 }
 const result=await sb.functions.invoke('teacher-password',{body:{action:'status'}});
 if(result.error||result.data?.error){document.querySelector('#loginmsg').textContent='No se pudo verificar la contraseña. Revise la conexión y la función teacher-password de Supabase.';return false}
 if(!result.data.must_change_password)return true;
 document.querySelector('#app').classList.add('hide');
 document.querySelector('#login').classList.remove('hide');
 let old=document.querySelector('#passwordChange');if(old)old.remove();
 const form=document.createElement('form');form.id='passwordChange';form.className='card login';
 form.innerHTML='<h2>Cambiar contraseña temporal</h2><p>Antes de continuar, crea una contraseña personal de al menos 10 caracteres.</p><label class="field">Nueva contraseña<input id="newTeacherPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><label class="field">Confirmar contraseña<input id="confirmTeacherPassword" type="password" autocomplete="new-password" required></label><button class="primary wide">Guardar y continuar</button><p id="passwordChangeMessage" role="status"></p><button type="button" id="cancelPasswordChange">Cerrar sesión</button>';
 document.querySelector('#login .login').classList.add('hide');document.querySelector('#login').appendChild(form);
 form.querySelector('#cancelPasswordChange').onclick=async()=>{await sb.auth.signOut();location.reload()};
 form.onsubmit=async e=>{e.preventDefault();const password=form.querySelector('#newTeacherPassword').value,message=form.querySelector('#passwordChangeMessage');if(password!==form.querySelector('#confirmTeacherPassword').value){message.textContent='Las contraseñas no coinciden.';return}const button=form.querySelector('button');button.disabled=true;try{const r=await sb.functions.invoke('teacher-password',{body:{action:'change',password}});if(r.error||r.data?.error)throw Error(r.data?.error||r.error.message);await sb.auth.refreshSession();form.remove();document.querySelector('#login .login').classList.remove('hide');const u=await sb.auth.getUser();if(u.error)throw u.error;await boot(u.data.user)}catch(error){message.textContent='No se pudo cambiar: '+error.message}finally{button.disabled=false}};
 return false;
}

async function uebraResetTeacher(id,name,button){
 if(!confirm('¿Restablecer la contraseña de '+name+'? Deberá cambiar la clave temporal al ingresar.'))return;
 button.disabled=true;
 try{const r=await sb.functions.invoke('teacher-password',{body:{action:'reset',teacher_id:id}});if(r.error||r.data?.error)throw Error(r.data?.error||r.error.message);const box=document.createElement('div');box.className='notice';box.innerHTML='<b>Contraseña temporal para '+esc(name)+'</b><p>Entrégala al docente. Deberá cambiarla al ingresar.</p><input readonly class="obs"><button>Cerrar</button>';box.querySelector('input').value=r.data.temporary_password;box.querySelector('button').onclick=()=>box.remove();document.querySelector('#adminBody').prepend(box)}catch(e){toast('No se pudo restablecer: '+e.message,true)}finally{button.disabled=false}
}

const UEBRA_SAT_TYPES = [
 ['CLASES','Clases de refuerzo con docente'],
 ['DOCENTE','Tutorías personalizadas con docente'],
 ['ESPECIALISTA','Tutorías con especialista'],
 ['CASA','Estudios en casa con apoyo familiar']
];
function uebraSatQualitativeCourse(name){
 const text=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 return /PREPARATORIA|(?:PRIMERO|SEGUNDO|TERCERO|CUARTO)\s+EGB\b|^[1-4](?:[.°º]|\s)*(?:EGB|DE BASICA)\b/.test(text);
}
function uebraSatGrade(value,qualitative=false){
 if(value==null||String(value).trim()==='')return {low:false,label:'Pendiente',zero:false};
 if(qualitative){const label=uebraQualitativeGrade(value);return {low:['E-','E+','D-','D+','C-','C+'].includes(label),label,zero:false};}
 const n=Number(String(value).trim().replace(',','.'));
 return {low:Number.isFinite(n)&&n>=0.01&&n<=6.99,zero:n===0,label:Number.isFinite(n)?n.toFixed(2):'Sin equivalencia'};
}
function uebraSatCollect(students,detail,trimestre,qualitative){
 const items=new Map(detail.items.filter(i=>Number(i.trimestre)===Number(trimestre)).map(i=>[i.id,i]));
 const improvements=new Map(detail.improvements.map(i=>[i.student_grade_id,i]));
 const people=new Map(students.map(s=>[s.id,{student:s,evidence:[]}]));
 let zeros=0;
 for(const grade of detail.grades){
  const item=items.get(grade.grade_item_id),person=people.get(grade.student_id);if(!item||!person)continue;
  const raw=grade.nota,improvement=improvements.get(grade.id);
  const effective=/^[ABCDE][+-]$/.test(String(raw).trim())?raw:uebraExportInputResult(grade,improvement);
  const initial=uebraSatGrade(raw,qualitative),current=uebraSatGrade(effective,qualitative);
  if(current.zero){zeros++;continue}
  if(!current.low)continue;
  person.evidence.push({itemId:item.id,name:item.nombre,date:item.fecha||'',initial:initial.label,current:current.label,notes:grade.observacion||''});
 }
 return {rows:[...people.values()].filter(p=>p.evidence.length).sort((a,b)=>a.student.nombre.localeCompare(b.student.nombre)),zeros};
}
function uebraSatPlanDefaults(){return {types:[],learning:'',activities:'',start:'',end:'',time:'',place:'',followup:'',specialist:'',family:'',studentCommitment:'Realizar las actividades acordadas y participar en el refuerzo.',familyCommitment:'Acompañar al estudiante y mantener comunicación con el docente.',teacherCommitment:'Brindar acompañamiento, revisar las actividades y ofrecer retroalimentación.',notes:''};}
function uebraSatValidate(plan){
 if(!plan.types.length)return 'Seleccione al menos un tipo de refuerzo.';
 for(const [field,label] of [['learning','aprendizajes que necesitan apoyo'],['activities','actividades propuestas'],['start','fecha de inicio'],['end','fecha de finalización'],['time','horario'],['place','lugar o medio de trabajo'],['followup','fecha de seguimiento'],['studentCommitment','compromiso del estudiante'],['familyCommitment','compromiso de la familia'],['teacherCommitment','compromiso del docente']])if(!String(plan[field]||'').trim())return 'Complete '+label+'.';
 if(plan.end<plan.start)return 'La fecha de finalización debe ser igual o posterior al inicio.';
 if(plan.followup<plan.start)return 'El seguimiento no puede ser anterior al inicio.';
 if(plan.types.includes('ESPECIALISTA')&&!plan.specialist.trim())return 'Indique el especialista o escriba «Pendiente de coordinación».';
 return '';
}
async function uebraDownloadSat(a,trimestre,button){
 if(!teacher||!profile||!navigator.onLine){toast('Ingrese como docente y conéctese para consultar los insumos.',true);return}
 const owner=profile.id,tid=teacher.id;button.disabled=true;
 try{
  const [students,detail]=await Promise.all([
   uebraExportReadAll(()=>sb.from('students').select('id,nombre,cedula').eq('course_id',a.course_id).eq('estado','ACTIVO').order('id')),
   uebraLoadExportInputs(a)
  ]);
  if(profile?.id!==owner||teacher?.id!==tid){throw Error('La sesión cambió. Vuelva a ingresar.')}
  const qualitative=uebraSatQualitativeCourse(a.grado),result=uebraSatCollect(students,detail,trimestre,qualitative);
  if(!result.rows.length){toast('No hay insumos con alerta pendiente en este trimestre.'+(result.zeros?' Hay notas de 0,00 que requieren revisión docente.':''));return}
  uebraSatOpen({assignment:{...a},trimestre,qualitative,rows:result.rows,zeros:result.zeros,owner,teacherName:teacher.nombre||profile.nombre,date:ecuadorDate()});
 }catch(e){toast('No se pudo preparar el SAT: '+e.message,true)}finally{button.disabled=false}
}
function uebraSatOpen(state){
 document.querySelector('#satOverlay')?.remove();
 state.rows.forEach(r=>{r.selected=true;r.plan=uebraSatPlanDefaults();r.evidence.forEach(e=>e.selected=true)});
 const overlay=document.createElement('div');overlay.id='satOverlay';overlay.style.cssText='position:fixed;inset:0;background:#0007;z-index:2000;overflow:auto;padding:16px';
 overlay.innerHTML=`<div class="card" style="max-width:980px;margin:0 auto"><div class="row"><div class="grow"><h2>Preparar Sistema de Alerta Temprana</h2><p>${esc(state.assignment.grado)} · ${esc(gradeSubjectLabel(state.assignment.asignatura))} · Trimestre ${state.trimestre}</p></div><button id="satClose">Cerrar</button></div><p class="notice">Revise los insumos detectados y complete el plan de cada estudiante antes de descargar. ${state.qualitative?'Criterio cualitativo: E− a C+.':'Criterio: 0,01 a 6,99/10 en insumos formativos.'} Se considera la nota actual con las mejoras registradas.</p>${state.zeros?`<p class="notice">${state.zeros} registro(s) con 0,00 requieren revisión: el rango numérico del acuerdo empieza en 0,01. No se convierten automáticamente en alertas.</p>`:''}<p class="muted">El plan se conserva mientras esta ventana permanezca abierta. Descargue los documentos antes de cerrar. El consolidado es para uso del docente; las fichas individuales son para cada familia.</p><div class="row"><button id="satSelectAll">Seleccionar todos</button><button id="satSelectNone">Quitar selección</button></div><div id="satPeople"></div><p id="satError" class="danger" role="alert"></p><div class="row"><button id="satPreview" class="primary">Ver fichas para familias</button><button id="satIndividual">Descargar fichas individuales</button><button id="satConsolidated">Descargar consolidado docente</button></div></div>`;
 const root=overlay.querySelector('#satPeople');
 const fields=[['learning','Aprendizajes que necesitan apoyo','textarea'],['activities','Actividades propuestas','textarea'],['start','Inicio','date'],['end','Finalización','date'],['time','Horario / frecuencia','text'],['place','Lugar o medio de trabajo','text'],['followup','Fecha de seguimiento','date'],['family','Nombre del representante (opcional)','text'],['studentCommitment','Compromiso del estudiante','textarea'],['familyCommitment','Compromiso de la familia','textarea'],['teacherCommitment','Compromiso del docente','textarea'],['notes','Observaciones (opcional)','textarea']];
 state.rows.forEach((row,index)=>{
  const card=document.createElement('details');card.className='card';card.open=index===0;
  card.innerHTML=`<summary><b>${esc(row.student.nombre)}</b> · ${row.evidence.length} insumo(s) con alerta</summary><label style="display:block;margin:12px 0"><input type="checkbox" data-sat-person checked> Incluir a este estudiante</label><div class="tablewrap"><table class="report-table"><thead><tr><th>Incluir</th><th>Insumo</th><th>Fecha</th><th>Inicial</th><th>Actual</th></tr></thead><tbody>${row.evidence.map((e,i)=>`<tr><td><input type="checkbox" data-sat-evidence="${i}" aria-label="Incluir ${esc(e.name)}" checked></td><td>${esc(e.name)}</td><td>${esc(e.date)}</td><td>${esc(e.initial)}</td><td>${esc(e.current)}</td></tr>`).join('')}</tbody></table></div><fieldset style="margin:12px 0"><legend>Tipo de refuerzo (puede elegir varios)</legend>${UEBRA_SAT_TYPES.map(([key,label])=>`<label style="display:block;margin:8px 0"><input type="checkbox" data-sat-type="${key}"> ${label}</label>`).join('')}<label class="field" data-sat-specialist-wrap hidden>Especialista o estado de coordinación<input data-sat-field="specialist" placeholder="Nombre del profesional o Pendiente de coordinación"></label></fieldset><div class="report-filters">${fields.map(([key,label,type])=>`<label>${label}${type==='textarea'?`<textarea class="obs" data-sat-field="${key}" rows="2"></textarea>`:`<input type="${type}" data-sat-field="${key}">`}</label>`).join('')}</div><button type="button" data-sat-copy style="margin-top:12px">Aplicar este plan a los demás seleccionados</button>`;
  const selected=card.querySelector('[data-sat-person]');selected.onchange=()=>row.selected=selected.checked;
  card.querySelectorAll('[data-sat-evidence]').forEach(el=>el.onchange=()=>row.evidence[Number(el.dataset.satEvidence)].selected=el.checked);
  card.querySelectorAll('[data-sat-field]').forEach(el=>{el.value=row.plan[el.dataset.satField];el.oninput=()=>row.plan[el.dataset.satField]=el.value});
  card.querySelectorAll('[data-sat-type]').forEach(el=>el.onchange=()=>{row.plan.types=Array.from(card.querySelectorAll('[data-sat-type]:checked'),e=>e.dataset.satType);card.querySelector('[data-sat-specialist-wrap]').hidden=!row.plan.types.includes('ESPECIALISTA')});
  card.querySelector('[data-sat-copy]').onclick=()=>{const error=uebraSatValidate(row.plan);if(error){toast(error,true);return}if(!confirm('¿Aplicar este plan a los demás estudiantes seleccionados? Se conservan sus nombres de representante.'))return;state.rows.forEach((other,j)=>{if(j===index||!other.selected)return;other.plan={...row.plan,types:[...row.plan.types],family:other.plan.family};const otherCard=root.children[j];otherCard.querySelectorAll('[data-sat-field]').forEach(el=>el.value=other.plan[el.dataset.satField]);otherCard.querySelectorAll('[data-sat-type]').forEach(el=>el.checked=other.plan.types.includes(el.dataset.satType));otherCard.querySelector('[data-sat-specialist-wrap]').hidden=!other.plan.types.includes('ESPECIALISTA')});toast('Plan aplicado. Revise que se ajuste a cada estudiante.')};
  root.appendChild(card);
 });
 overlay.querySelector('#satClose').onclick=()=>{if(confirm('¿Cerrar la preparación del SAT? Los planes que no haya descargado se perderán.'))overlay.remove()};
 for(const [id,value] of [['satSelectAll',true],['satSelectNone',false]])overlay.querySelector('#'+id).onclick=()=>state.rows.forEach((row,i)=>{row.selected=value;root.children[i].querySelector('[data-sat-person]').checked=value});
 function output(kind,preview=false){
  const message=overlay.querySelector('#satError');message.textContent='';
  if(profile?.id!==state.owner){message.textContent='La sesión cambió. Vuelva a preparar el SAT.';return}
  const rows=state.rows.filter(r=>r.selected);
  if(!rows.length){message.textContent='Seleccione al menos un estudiante.';return}
  for(const row of rows){const error=!row.evidence.some(e=>e.selected)?'Seleccione al menos un insumo.':uebraSatValidate(row.plan);if(error){message.textContent=row.student.nombre+': '+error;root.children[state.rows.indexOf(row)].open=true;message.scrollIntoView({block:'nearest'});return}}
  const html=uebraSatDocument(state,rows,kind);const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
  if(preview){const tab=window.open(url,'_blank');if(!tab){URL.revokeObjectURL(url);message.textContent='Permita abrir ventanas para ver las fichas o use Descargar fichas individuales.';return}setTimeout(()=>URL.revokeObjectURL(url),60000)}
  else{const link=document.createElement('a');link.href=url;link.download=('SAT_'+kind+'_'+state.assignment.grado+'_'+state.assignment.asignatura+'_T'+state.trimestre+'_'+state.date+'.html').replace(/[\\/:*?"<>|]/g,'_');document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Documento descargado. Abra el archivo para imprimir o guardar como PDF.')}
 }
 overlay.querySelector('#satPreview').onclick=()=>output('familias',true);
 overlay.querySelector('#satIndividual').onclick=()=>output('familias');
 overlay.querySelector('#satConsolidated').onclick=()=>output('consolidado');
 document.body.appendChild(overlay);
}
function uebraSatDocument(state,rows,kind){
 const a=state.assignment,text=value=>esc(String(value||'')).replace(/\r?\n/g,'<br>');
 const typeNames=plan=>UEBRA_SAT_TYPES.filter(([key])=>plan.types.includes(key)).map(([,label])=>label).join('; ');
 const head=title=>`<div class="school">UNIDAD EDUCATIVA BENJAMÍN RAMÍREZ ARTEAGA</div><h1>${title}</h1><p>Año lectivo 2026–2027 · Sierra–Amazonía · Fecha de emisión: ${text(state.date)}<br>Curso: ${text(a.grado)} · Jornada: ${text(a.jornada)} · Trimestre: ${state.trimestre}<br>Asignatura: ${text(gradeSubjectLabel(a.asignatura))} · Docente: ${text(state.teacherName)}</p>`;
 const evidence=row=>row.evidence.filter(e=>e.selected);
 let content;
 if(kind==='consolidado')content=head('Consolidado docente del Sistema de Alerta Temprana')+`<p>Uso interno del docente. Relación de ${rows.length} estudiante(s) con alerta en insumos formativos. Los compromisos y firmas de cada familia se recogen en las fichas individuales.</p><table><thead><tr><th>N.º</th><th>Estudiante</th><th>Insumos y notas actuales</th><th>Refuerzo</th><th>Cronograma</th><th>Seguimiento / resultado</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${text(r.student.nombre)}</b><br>${text(r.student.cedula)}</td><td>${evidence(r).map(e=>text(e.name)+' · '+text(e.current)+' · '+text(e.date)).join('<br>')}</td><td>${text(typeNames(r.plan))}<br>${text(r.plan.activities)}${r.plan.specialist&&r.plan.types.includes('ESPECIALISTA')?'<br>Especialista: '+text(r.plan.specialist):''}</td><td>${text(r.plan.start)} a ${text(r.plan.end)}<br>${text(r.plan.time)}<br>${text(r.plan.place)}</td><td>Fecha: ${text(r.plan.followup)}<br><br>Resultado: ___________________<br><br>Próxima acción: _______________</td></tr>`).join('')}</tbody></table><div class="signature">Firma del docente: ______________________________</div>`;
 else content=rows.map(row=>{
  const p=row.plan;
  return `<article>${head('Notificación de alerta temprana y compromiso de refuerzo pedagógico')}<p><b>Estudiante:</b> ${text(row.student.nombre)} · <b>Cédula:</b> ${text(row.student.cedula)}<br><b>Dirigido a:</b> ${text(p.family)||'Madre, padre, representante legal, adulto cuidador o estudiante autorrepresentado'}</p><p>Se comunica que, en los insumos formativos indicados, se han identificado aprendizajes que requieren apoyo. Se acuerda el siguiente plan de refuerzo y acompañamiento, con base en el artículo 10 del Acuerdo MINEDEC-MINEDEC-2026-00082-A y el artículo 32 del Reglamento General a la LOEI.</p><table><thead><tr><th>Insumo</th><th>Fecha</th><th>Nota inicial${state.qualitative?'':' /10'}</th><th>Nota actual${state.qualitative?'':' /10'}</th></tr></thead><tbody>${evidence(row).map(e=>`<tr><td>${text(e.name)}</td><td>${text(e.date)}</td><td>${text(e.initial)}</td><td>${text(e.current)}</td></tr>`).join('')}</tbody></table><h2>Plan de refuerzo pedagógico</h2><p><b>Tipo de refuerzo:</b> ${text(typeNames(p))}${p.types.includes('ESPECIALISTA')?'<br><b>Especialista o coordinación:</b> '+text(p.specialist):''}<br><b>Aprendizajes que necesitan apoyo:</b> ${text(p.learning)}<br><b>Actividades propuestas:</b> ${text(p.activities)}</p><p><b>Inicio:</b> ${text(p.start)} · <b>Finalización:</b> ${text(p.end)}<br><b>Horario o frecuencia:</b> ${text(p.time)} · <b>Lugar o medio:</b> ${text(p.place)}<br><b>Fecha de seguimiento:</b> ${text(p.followup)}</p><h2>Compromisos de acompañamiento</h2><p><b>Estudiante:</b> ${text(p.studentCommitment)}<br><b>Familia:</b> ${text(p.familyCommitment)}<br><b>Docente:</b> ${text(p.teacherCommitment)}</p>${p.notes?'<p><b>Observaciones:</b> '+text(p.notes)+'</p>':''}<div class="signatures"><div>____________________________<br>Docente de la asignatura<br>${text(state.teacherName)}</div><div>____________________________<br>Representante / autorrepresentado<br>Nombre: ${text(p.family)||'____________________'}<br>Fecha: _____________________</div><div>____________________________<br>Estudiante</div><div>____________________________<br>Docente tutor / autoridad<br>Cuando corresponda</div></div><h2>Registro de seguimiento</h2><p>Resultado observado: ___________________________________________________<br>Próxima acción o ajuste: __________________________________________________<br>Fecha y responsable: ____________________________________________________</p></article>`;
 }).join('');
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SAT ${kind==='consolidado'?'Consolidado docente':'Fichas individuales'}</title><style>body{font-family:Arial,sans-serif;color:#111;max-width:${kind==='consolidado'?'1120':'780'}px;margin:24px auto;padding:0 12px;font-size:12px;line-height:1.45}.school{text-align:center;font-weight:bold;font-size:14px}h1{font-size:19px;text-align:center;margin:10px 0 16px}h2{font-size:14px;margin:15px 0 7px}p{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0}td,th{border:1px solid #aaa;padding:7px;overflow-wrap:anywhere;vertical-align:top}th{background:#eee}thead{display:table-header-group}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px 22px;margin-top:45px;break-inside:avoid}.signature{margin-top:45px}article+article{border-top:2px dashed #aaa;margin-top:35px;padding-top:25px}button{font:inherit;padding:10px;margin-bottom:18px;cursor:pointer}@media print{body{max-width:none;margin:0;padding:0}button{display:none}article+article{break-before:page;border:0;margin:0;padding:0}tr{break-inside:avoid}h2{break-after:avoid}}@page{size:A4 ${kind==='consolidado'?'landscape':'portrait'};margin:15mm}</style></head><body><button onclick="window.print()">Imprimir / guardar como PDF</button>${content}</body></html>`;
}
