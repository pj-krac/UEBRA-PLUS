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

function uebraSatRows(results){return results.filter(r=>r.nota!==null&&r.nota!==undefined&&r.nota!==''&&Number.isFinite(Number(r.nota))&&Number(r.nota)>=0&&Number(r.nota)<7)}
async function uebraDownloadSat(a,trimestre,button){
 button.disabled=true;
 try{
  const roster=await uebraExportReadAll(()=>sb.from('students').select('id,nombre,cedula').eq('course_id',a.course_id).eq('estado','ACTIVO').order('id'));
  const results=await mapWithConcurrency(roster,6,async student=>{const r=await sb.rpc('subject_trimester_grade',{p_student_id:student.id,p_course_id:a.course_id,p_asignatura:a.asignatura,p_trimestre:trimestre});if(r.error)throw r.error;return {student,nota:r.data}});
  const rows=uebraSatRows(results).sort((x,y)=>x.student.nombre.localeCompare(y.student.nombre));
  if(!rows.length){toast('No hay notas trimestrales inferiores a 7/10. Las notas pendientes no se incluyen.');return}
  const html='<!doctype html><html lang="es"><meta charset="utf-8"><title>SAT</title><style>body{font-family:Arial;margin:25px;font-size:12px}h1{text-align:center;font-size:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid;padding:8px}td{height:55px}button{padding:10px}@media print{button{display:none}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:15mm}}</style><button onclick="window.print()">Imprimir / guardar como PDF</button><h1>Sistema de Alerta Temprana (SAT)</h1><p>Unidad Educativa Benjamín Ramírez Arteaga · Año lectivo 2026–2027</p><p>Docente: '+esc(teacher.nombre||profile.nombre)+'<br>Curso: '+esc(a.grado)+' · Jornada: '+esc(a.jornada)+' · Asignatura: '+esc(gradeSubjectLabel(a.asignatura))+'<br>Trimestre: '+trimestre+' · Fecha: '+esc(ecuadorDate())+'</p><p>Consolidado de notas trimestrales inferiores a 7/10. Formato provisional pendiente del modelo institucional.</p><table><thead><tr><th>N.º</th><th>Estudiante</th><th>Cédula</th><th>Nota /10</th><th>Acuerdos / seguimiento</th><th>Representante: nombre, firma y fecha</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.student.nombre)+'</td><td>'+esc(r.student.cedula||'')+'</td><td>'+fmtGrade(r.nota)+'</td><td></td><td></td></tr>').join('')+'</tbody></table><p style="margin-top:55px">____________________________<br>Firma del docente</p></html>';
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=('SAT_'+a.grado+'_'+a.asignatura+'_T'+trimestre+'.html').replace(/[\\/:*?"<>|]/g,'_');link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('SAT descargado. Abra el archivo para imprimir o guardar como PDF.');
 }catch(e){toast('No se pudo generar el SAT: '+e.message,true)}finally{button.disabled=false}
}
