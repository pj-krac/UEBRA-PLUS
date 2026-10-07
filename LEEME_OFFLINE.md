# Actualización automática y asistencia sin conexión

## Publicación
Reemplazar index.html y sw.js de este ZIP. Conservar config, logo, iconos y manifest. No necesita SQL adicional; las migraciones de proyectos anteriores deben seguir instaladas. Recargar con conexión después de la publicación.

## Solicitudes automáticas
Revisión cada 10 segundos mientras la pestaña está visible. Actualiza solo el panel del proyecto. Si está completando su elección, muestra un aviso con Ver cambio; no reemplaza automáticamente ese formulario. Las notas de estudiantes permanecen en sus casilleros. Actualizar invitaciones sigue disponible manualmente. No es una conexión instantánea en tiempo real; puede haber hasta unos diez segundos más el tiempo de red.

## Preparar asistencia offline
1. Con internet, ingresar con la cuenta docente habitual, en el navegador/dispositivo que utilizará.
2. En Hoy, pulsar Preparar / actualizar este dispositivo. Esperar el mensaje de preparación completa. Se guardan los horarios de toda la semana y estudiantes activos de esos cursos, vinculados a ese usuario. Si aún no se guardó la biblioteca de acceso, recargar con conexión y repetir.
3. Probar antes de usar: desconectar internet, abrir Hoy, elegir fecha y clase, marcar estudiantes y guardar. Debe indicar pendiente(s), no sincronizado.
4. Reconectar con la aplicación abierta. Verifica sesión, perfil activo, docente y asignación; envía y comprueba estado/observación de cada estudiante antes de quitar el pendiente. Puede pulsar el indicador para reintentar. También reintenta cada 30 segundos si la página está visible.
5. Actualizar preparación cuando cambien estudiantes u horarios. La fecha de preparación queda visible.

La asistencia siempre se guarda primero en el dispositivo. Cada registro tiene usuario e identificador de revisión; si se edita durante un envío, el envío anterior no borra la revisión nueva. En caso de falta de espacio/permisos del navegador, informa que NO pudo guardar y no afirma que esté protegida.
Pendientes anteriores sin propietario no se envían automáticamente. Revisar pendientes anteriores permite adoptar explícitamente solo los identificados con el docente actual, verificado con conexión. No se borran ni se atribuyen a otra cuenta.

## Alcance y límites
Modo offline requiere preparación previa y sesión local guardada. No permite iniciar una cuenta nueva sin internet. La sesión local no acredita que el servidor siga autorizando al usuario; se vuelve a verificar al sincronizar. Es para un dispositivo de confianza. Al recargar sin conexión se habilita solo asistencia; no permite proyectos ni cambios administrativos.
Offline puede abrir las clases y listas preparadas, guardar y recuperar asistencias pendientes. No descarga el historial completo de registros ya sincronizados ni garantiza revisar asistencias antiguas del servidor sin red. Los calendarios de suspensión y modificaciones posteriores de matrícula/horarios no se actualizan sin conexión.
Los datos se guardan en almacenamiento local del navegador. No usar incógnito, no borrar datos del sitio y no cambiar de navegador esperando encontrar los pendientes. Cerrar sesión conserva pendientes por usuario pero requiere conexión para volver a ingresar. Si cierra completamente la app, la sincronización se reanuda cuando la abra con conexión; no se promete ejecución en segundo plano.
La persistencia local depende del navegador/espacio. Conservar el dispositivo hasta confirmar la sincronización. No se introdujo un nuevo sistema de resolución de conflictos entre dos dispositivos que editen la misma asistencia: el backend conserva la lógica actual de upsert. Evitar editar la misma sesión simultáneamente desde varios dispositivos; revisar el registro final si ocurre.

## Validación
Sintaxis de todos los scripts; pruebas offline del usuario propietario y rechazo de otro usuario/curso; POST sin red; cola separada por usuario y revisión nueva al editar. Recursos de caché limitados al HTML/config/iconos y cuatro bibliotecas públicas exactas; no cachea endpoints de Supabase ni datos de otros usuarios. Sin SQL ni RPC ejecutadas durante pruebas. Pendiente validación completa en navegador con sesión real, modo avión, reapertura de app, cuotas de almacenamiento y envío a Supabase. Cierre de año conservado.
