/* Indicadores de uso. Las acciones académicas se registran en el servidor. */
(function(){
 const labels={asistencia:'Guardó asistencia',calificaciones:'Guardó calificaciones',planificacion:'Actualizó planificación'};
 const dateFormat=new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'short',timeStyle:'short'});
 let lastTouch=0,touchOwner=null,enteredOwner=null,busy=false,disabledUntil=0,panelTimer=null,panelGeneration=0;
 function eligible(){return !!(sb&&profile?.id&&profile.activo===true&&teacher?.activo===true&&teacher.profile_id===profile.id&&!document.querySelector('#app')?.classList.contains('hide'))}
 async function touch(ingreso=false){
  if(!eligible()||document.visibilityState!=='visible'||navigator.onLine===false||busy||Date.now()<disabledUntil)return;
  const owner=profile.id;if(touchOwner!==owner){lastTouch=0;touchOwner=owner;enteredOwner=null}
  if(ingreso&&enteredOwner===owner)return;if(!ingreso&&Date.now()-lastTouch<120000)return;
  busy=true;lastTouch=Date.now();
  try{const r=await sb.rpc('uebra_usage_ping',{p_ingreso:ingreso});if(r.error){disabledUntil=Date.now()+300000;return}if(ingreso)enteredOwner=owner}catch{disabledUntil=Date.now()+300000}finally{busy=false}
 }
 function start(){void touch(true)}
 const originalBoot=boot;boot=async function(...args){const result=await originalBoot.apply(this,args);start();return result};
 for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{if(e.isTrusted)void touch(false)},{passive:true,capture:true});
 window.addEventListener('online',()=>{disabledUntil=0;void touch(false)});
 if(eligible())start();
 function date(value){if(!value)return 'Sin registro';const d=new Date(value);return Number.isNaN(d.getTime())?'Sin registro':dateFormat.format(d)}
 function active(t){return t.activo===true&&!!t.profile_id&&t.cuenta_activa===true}
 function recent(t,now){const age=now-new Date(t.ultima_actividad).getTime();return active(t)&&t.ultima_actividad&&age>=0&&age<=300000}
 function lastAction(t){const entries=Object.keys(labels).filter(k=>t[k]).sort((a,b)=>Date.parse(t[b])-Date.parse(t[a]));return entries.length?labels[entries[0]]:'Sin acción académica registrada'}
 const originalShowTeachers=showTeachers;
 showTeachers=async function(...args){
  clearInterval(panelTimer);const generation=++panelGeneration;await originalShowTeachers.apply(this,args);
  if(generation!==panelGeneration||profile?.rol!=='ADMIN'||profile.activo!==true)return;
  const host=document.querySelector('#adminBody');if(!host?.querySelector('#teacherManagementList'))return;
  const card=document.createElement('section');card.className='card usage-card';card.setAttribute('aria-labelledby','usageTitle');
  card.innerHTML='<div class="usage-heading"><div><h2 id="usageTitle">Uso de UEBRA+ por docentes</h2><p class="muted">Último ingreso, actividad reciente y acciones guardadas.</p></div><button type="button" data-usage-refresh>Actualizar</button></div><div data-usage-message role="status">Consultando uso…</div><div data-usage-content hidden><div class="usage-stats"></div><div class="usage-tools"><label>Buscar docente<input type="search" class="obs" data-usage-search placeholder="Nombre o apellido"></label><label>Mostrar<select data-usage-filter><option value="all">Todos los activos</option><option value="today">Con actividad hoy</option><option value="week">Con actividad en los últimos 7 días</option><option value="none">Sin actividad registrada</option><option value="unlinked">Sin cuenta vinculada</option><option value="inactive">Inactivos</option></select></label></div><p class="muted" data-usage-period></p><div class="tablewrap"><table class="report-table usage-table"><thead><tr><th>Docente</th><th>Última actividad</th><th>Último inicio de sesión</th><th>Última acción académica</th><th>Asistencia</th><th>Calificaciones</th><th>Planificación</th></tr></thead><tbody></tbody></table></div><p class="muted tiny">Actividad reciente significa uso registrado durante los últimos 5 minutos; no garantiza que la persona siga conectada. Las fechas de acciones corresponden al guardado en el servidor, incluida la sincronización de asistencias pendientes. No se mide tiempo de trabajo.</p></div>';
  host.prepend(card);let report=null,loading=false;
  const message=card.querySelector('[data-usage-message]'),content=card.querySelector('[data-usage-content]'),search=card.querySelector('[data-usage-search]'),filter=card.querySelector('[data-usage-filter]'),refresh=card.querySelector('[data-usage-refresh]');
  function render(){if(!report)return;const now=Date.parse(report.generado_en),all=report.docentes||[],staff=all.filter(t=>t.activo===true),linked=staff.filter(active);
   card.querySelector('.usage-stats').innerHTML=[['Actividad hoy',linked.filter(t=>t.actividad_hoy).length],['Últimos 7 días',linked.filter(t=>t.actividad_semana).length],['Actividad reciente',linked.filter(t=>recent(t,now)).length],['Sin cuenta vinculada',staff.filter(t=>!t.profile_id).length]].map(([label,n])=>'<div class="usage-stat"><b>'+n+'</b><span>'+esc(label)+'</span></div>').join('');
   const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),q=normalize(search.value),mode=filter.value;
   const list=all.filter(t=>normalize(t.nombre).includes(q)&&(mode==='inactive'?t.activo!==true:t.activo===true)&&(!['today','week','none','unlinked'].includes(mode)||({today:active(t)&&t.actividad_hoy,week:active(t)&&t.actividad_semana,none:!t.ultima_actividad,unlinked:!t.profile_id})[mode]));
   card.querySelector('tbody').innerHTML=list.length?list.map(t=>'<tr><td><b>'+esc(t.nombre)+'</b><div class="muted tiny">'+(t.activo!==true?'Docente inactivo':!t.profile_id?'Sin cuenta vinculada':!t.cuenta_activa?'Cuenta inactiva':'Cuenta vinculada')+'</div></td><td>'+esc(date(t.ultima_actividad))+(recent(t,now)?'<span class="usage-recent">Actividad reciente</span>':'')+'</td><td>'+esc(date(t.ultimo_ingreso))+'</td><td>'+esc(lastAction(t))+'</td><td>'+esc(date(t.asistencia))+'</td><td>'+esc(date(t.calificaciones))+'</td><td>'+esc(date(t.planificacion))+'</td></tr>').join(''):'<tr><td colspan="7">No hay docentes con estos filtros.</td></tr>';
   card.querySelector('[data-usage-period]').textContent='Registro de actividad desde '+date(report.desde)+'. Actualizado: '+date(report.generado_en)+'. Hora de Ecuador. “Sin registro” no demuestra que nunca haya usado la aplicación.';
  }
  async function load(){if(loading||!card.isConnected||profile?.rol!=='ADMIN')return;loading=true;refresh.disabled=true;
   try{const r=await sb.rpc('uebra_usage_report');if(!card.isConnected||generation!==panelGeneration)return;if(r.error)throw r.error;if(!r.data||!Array.isArray(r.data.docentes))throw Error('Respuesta de actividad no válida.');report=r.data;content.hidden=false;message.textContent='Se actualiza automáticamente cada minuto mientras esta pantalla está visible.';render()}catch(error){if(card.isConnected)message.textContent=report?'No se pudo actualizar. Se mantienen los datos de la consulta anterior.':'Para habilitar este panel, ejecute ACTIVIDAD_DOCENTES_INSTALAR.sql en Supabase y pulse Actualizar. Si ya lo instaló, revise su conexión y permisos.'}finally{loading=false;if(refresh.isConnected)refresh.disabled=false}
  }
  search.oninput=render;filter.onchange=render;refresh.onclick=load;await load();
  if(!card.isConnected||generation!==panelGeneration)return;
  panelTimer=setInterval(()=>{if(!card.isConnected||generation!==panelGeneration){clearInterval(panelTimer);return}if(document.visibilityState==='visible'&&navigator.onLine!==false)void load()},60000);
 };
})();
