# Proyectos sumativos por grupo — actualización integrada

## Resultado
Una materia puede trabajar sola; otras pueden formar varios proyectos independientes dentro del mismo curso y trimestre. ADMIN organiza grupos, guarda borradores y confirma participantes. Cada materia se reserva una sola vez. Los aportes se siguen registrando desde Calificaciones usando la captura existente.

Promedio P: únicamente las materias del grupo. Sumativa S de cada materia: (P + su aporte) / 2. Disciplinar: S=su aporte. Biología 8 + Química 10 → P=9, S Biología=8,5 y S Química=9,5. Proyectos de Historia/Filosofía o Emprendimiento/ECA no afectan ese promedio. Nota faltante deja pendiente el grupo; cero es válido. Se conserva el 70 % formativa / 30 % sumativa y las exclusiones originales (Inicial, Preparatoria, componentes cualitativos y optativas especiales).

## Pasos de activación
1. Respaldar la base y revisar el SQL con el esquema actual. Las definiciones recibidas se conservaron como referencia para reversión.
2. Ejecutar PROYECTOS_SUMATIVA_IMPLEMENTAR.sql tras aprobación. Es el script completo: no hace falta ejecutar el antiguo PROYECTOS_FLEXIBLES_PENDIENTE.sql. Puede aplicarse si ya se crearon aquellas tablas; verificar antes que no se modificó su estructura. Todo el script va en una transacción.
3. Actualizar UEBRA+ con TODOS los archivos de este ZIP, especialmente index.html, proyectos-flexibles.js y sw.js. El portal Familias no necesita cambiar su HTML: sus RPC devuelven los resultados actualizados. No intercambiar los index de los portales.
4. Administrar → Proyectos sumativos → seleccionar curso, escribir año lectivo, elegir trimestre → Consultar grupos.
5. Crear todos los proyectos y asignar todas las materias elegibles del curso. Una materia para disciplinar, varias para interdisciplinar. Confirmar cada grupo. Las materias excluidas no deben seleccionarse: el servidor rechaza su inclusión.
6. Revisar los participantes y pulsar Activar cálculo por grupos. Se solicita confirmación porque cambia los resultados derivados de ese curso/trimestre, aunque no modifica notas de aporte. El servidor exige cobertura completa, sin borradores ni materias repetidas.
7. Registrar/revisar aportes normalmente desde Calificaciones. La pantalla muestra el nombre y participantes del grupo activo. Comparar sumativa y trimestral con Consolidado, informe académico y Familias.

Hasta el paso 6, los cálculos conservan el promedio institucional anterior. Activar un curso/trimestre no activa los demás. Una activación bloquea los grupos y no permite sustituir el año sobre los mismos course_id/trimestre. Los aportes heredados no tienen año lectivo en su clave: antes de otro año debe existir la separación de cursos/registros correspondiente. No crear una configuración de otro año esperando que filtre esos aportes automáticamente.

## Funciones actualizadas
- subject_summative_grade: obtiene el promedio del proyecto correspondiente a la asignatura.
- project_subject_roster: muestra avance y promedio de ese grupo; mantiene el contrato de retorno y permisos originales. Normaliza y agrupa variantes de nombre de aportes para evitar filas duplicadas.
- family_student_project_detail: devuelve el promedio por grupo; conserva la comprobación is_my_family_student.
subject_trimester_grade ya llama a subject_summative_grade. Las funciones exportadas de consolidados, tutor, informes académicos y notas de Familias usan esa cadena, por lo que no se reescribieron. Las funciones de notas anuales/certificados siguen su cadena original. No se modifica ni se llama al módulo de cierre de año.
project_average y project_status se conservan para compatibilidad heredada; la ruta de notas actualizada usa project_subject_group_status. Revisar antes de desplegar si hay otras aplicaciones/views no incluidas en la exportación que llamen directamente al promedio general y deban adaptarse.

## Revisión / reversión
PROYECTOS_SUMATIVA_REVERTIR.sql restaura las tres funciones originales suministradas. Conserva grupos y aportes. No ejecutar el script de reversión durante funcionamiento normal. También conservar la versión anterior del frontend; restaurarla si se revierte el backend.
Los helpers internos no tienen permisos directos para usuarios; configuración y activación solo por ADMIN activo. RPC de contexto respeta los permisos existentes de calificaciones. Confirmar que el propietario de las funciones reemplazadas pueda ejecutar los helpers internos y que las tablas/columnas coincidan con el servidor. Revisar grants originales: no se pretendió resolver toda la auditoría RLS previa mediante esta migración.

## Verificación realizada y límites
Sintaxis de scripts HTML, módulo, config y service worker; casos de cálculo por grupos independientes, disciplinar, faltantes y cero; comprobaciones estáticas de contratos SQL y firma de roster. index.html original preservado salvo el script agregado en la entrega previa. Notas existentes y cierre intactos. No se ejecutó SQL/RPC ni se comprobó la migración en PostgreSQL.
Antes del uso real: comprobar en prueba que una configuración sin activar no cambie resultados; activar curso con todos los grupos; registrar aportes en materias separadas; verificar resultados 8,5 y 9,5 y trimestre ponderado; verificar falta de aporte, optativas, curso/jornada ajenos, docentes no asignados, acceso familiar y grupos bloqueados. La exportación permite preparar la integración, pero estas pruebas requieren el servidor.
