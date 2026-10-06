# Elección del proyecto desde cada docente

Corrección del flujo: Calificaciones → su materia → trimestre → Mi proyecto de evaluación sumativa.
El docente elige Disciplinar (solo su materia) o Interdisciplinar (selecciona materias elegibles del mismo curso/jornada). Su materia queda incluida y no se puede desmarcar. El año procede de institution_settings.anio_lectivo; no se escribe manualmente.

Disciplinar confirma el grupo de una materia. Interdisciplinar crea una propuesta: el docente proponente confirma su propia materia, las demás quedan pendientes. Cada docente entra a su materia y pulsa Confirmar mi participación. Cuando todas aceptan, se confirma el proyecto. Una materia reservada por otro grupo no puede duplicarse; si la propuesta es incorrecta, coordinar su corrección de borrador con ADMIN antes de activar. No hay rechazo automático ni eliminación de aportes en este flujo.

Cada asignatura/grupo trabaja independientemente. ADMIN ya no necesita crear todos los proyectos: conserva supervisión, corrección de borradores y la activación final para que todas las materias del curso/trimestre tengan grupo confirmado antes de cambiar las notas oficiales. La elección docente no activa por sí sola el cálculo oficial; hasta la activación se mantiene la fórmula anterior. Una vez activado, usa el promedio de las materias de ese proyecto y lo promedia con el aporte de la materia correspondiente.

## Instalación
1. Si todavía no aplicó PROYECTOS_SUMATIVA_IMPLEMENTAR.sql, revisar y aplicar primero ese script de la entrega integrada. No volver a aplicarlo si ya está desplegado y validado.
2. Revisar/aprobar y ejecutar PROYECTOS_ELECCION_DOCENTE.sql (nuevo script adicional). No se ejecutó por el asistente. Confirma las funciones de calificaciones recibidas y institution_settings(id,anio_lectivo).
3. Publicar el conjunto completo de este ZIP en UEBRA+, especialmente index.html, proyectos-flexibles.js, eleccion-proyecto-docente.js y sw.js. El nuevo archivo debe estar en la misma carpeta que index.html.
4. Comprobar año institucional y entrar como docente real. Si existían grupos administrativos confirmados, aparecerán esos grupos; no se sobrescriben automáticamente.
5. Hacer que cada materia complete su elección o confirme la invitación. ADMIN revisa y activa el curso/trimestre como en la guía integrada.

## Compatibilidad y permisos
No se alteran notas, project_grades ni cierre de año. RPC nuevas validan perfil activo, asignación docente, materias elegibles, curso y trimestre; respetan normalización de materias, unicidad y bloqueo por activación. Comparten el bloqueo de concurrencia del mismo curso/año/trimestre con la configuración administrativa. La confirmación solo cambia la aceptación de la materia autorizada del docente, no la de otros participantes. Si un docente imparte dos materias, las confirma entrando a cada una.
La nueva columna aceptado comienza true para grupos anteriores, conservando la configuración ya acordada. Solo nuevas invitaciones se crean false. No migra docentes/grupos ni agrega datos ficticios. El panel administrativo sigue disponible como supervisión.

## Validación
Sintaxis verificada de scripts HTML, ambos módulos de proyectos, módulo nuevo y service worker; comprobaciones estáticas de contratos y autorización SQL. Fórmula oficial de la entrega anterior conservada. Bloque original de cierre intacto. SQL no ejecutado ni probado en PostgreSQL; pendiente prueba con dos docentes reales (proponer Biología+Química, confirmar desde Química), un disciplinar, materia ocupada, asignación ajena, período bloqueado y resultados después de activar. No se validó renderizado con una sesión real.
