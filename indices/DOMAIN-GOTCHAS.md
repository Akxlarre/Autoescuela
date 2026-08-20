# Domain Gotchas (trampas de dominio, esquema y reglas de negocio)

> Equivalente de `indices/ANTI-PATTERNS.md` pero para conocimiento de **dominio**, no de UI.
> `ANTI-PATTERNS.md` captura atajos de código que se repiten (clases muertas, badges ad-hoc).
> Este índice captura **hechos no obvios sobre el negocio, el esquema o las policies** que ya
> causaron un bug real — cosas que una sesión nueva (humana o agente) volvería a pisar si no
> están escritas acá, porque no se deducen leyendo el código una sola vez.
>
> **Regla:** antes de tocar lógica de negocio, RLS, o una query nueva sobre una tabla listada acá,
> lee la entrada correspondiente. Si tu fix/hotfix revela un gotcha de este tipo que no está
> documentado, agrégalo (ver convención al final).

## BD / Esquema

### DG-001 — Una columna documentada como "regla" no es un constraint real
- **Trampa:** asumir que un comentario tipo `"1..12 (secuencia obligatoria)"` en la documentación es una garantía que la BD hace cumplir.
- **Realidad:** `class_b_sessions.class_number` no tenía `CHECK`/`UNIQUE` — el código podía insertar una fila #13 sin que la BD lo impidiera. Ahora sí tiene `CHECK (class_number BETWEEN 1 AND 12)` + `UNIQUE (enrollment_id, class_number)`.
- **Fuente:** `specs/fixes/fix-028-m-clase-b-consecutive-issues`

### DG-002 — `enrollments`/exámenes: la columna es `score`, no `grade`
- **Trampa:** pedir `grade` a `class_b_exam_scores` esperando que exista.
- **Realidad:** la tabla define `score`. PostgREST rechaza la query completa (400) y el fallback silencioso muestra "Pendiente" aunque la nota ya esté registrada. Bug encontrado 2 veces en auditorías distintas.
- **Fuente:** `specs/fixes/fix-059-b-nota-examen-final`

### DG-003 — `vehicles.status = 'available'` nunca existe en producción
- **Trampa:** comparar contra `'available'` como si fuera un valor válido del enum.
- **Realidad:** el dominio real es `'operational'|'in_use'|'maintenance'|'out_of_service'|'blocked'`. Un KPI comparado contra el valor fantasma daba 0 siempre.
- **Fuente:** `specs/fixes/fix-063-b-dashboard-kpis-estados`

### DG-004 — `enrollments.payment_mode` real es `'partial'`, no `'deposit'`
- **Trampa:** escribir `WHERE payment_mode = 'deposit'` porque así lo decía la documentación.
- **Realidad:** el dominio real de la columna es `'total'|'partial'` (verificado contra 44 enrollments reales) — `'deposit'` nunca existió en producción. Un trigger (`notify_deposit_reminder()`) usó ese valor fantasma y **nunca disparó** hasta corregirlo.
- **Fuente:** `indices/DATABASE.md` línea 68 (Spec 0026) + `20260710000200_fix_deposit_reminder_payment_mode.sql`

### DG-005 — `vehicles` no tiene columna `vehicle_id` — la PK es `id`
- **Trampa:** hacer join contra `vehicles.vehicle_id` porque así aparecía documentado en otra parte del repo.
- **Realidad:** `vehicles` solo tiene `id` como PK. Toda FK real apunta a `vehicles(id)`. Si ves `vehicle_id` en otro doc, es un error heredado de documentación.
- **Fuente:** `indices/DATABASE.md` línea 144 (Spec 0027)

### DG-006 — `code` de promociones no es texto libre — es un ID del Ministerio de Transporte
- **Trampa:** tratar `professional_promotions.code`/`promotion_courses.code` como un string autogenerado, editable sin validación.
- **Realidad:** debe ser el ID numérico que asigna el MTT (ej. `156`), del cual se deriva `promotion_courses.code = "{id}.{sufijo_licencia}"` (ej. `156.2` para A2).
- **Fuente:** `specs/fixes/fix-053-m-libro-clases-promocion-id`

### DG-007 — Una columna puede existir en el esquema y no estar escrita por ningún código
- **Trampa:** confiar en `instructors.active_classes_count` (`DEFAULT 0`) como fuente de verdad "porque está en la tabla".
- **Realidad:** ningún trigger/Edge Function/facade la actualizaba nunca — mostraba 0 siempre. Hubo que reemplazarla por un `COUNT` en vivo.
- **Fuente:** `specs/fixes/fix-072-m-instructores-clases-activas-count`

### DG-008 — Sin `.order()`/`.limit()`, PostgREST trunca en silencio a 1000 filas
- **Trampa:** asumir que una query sin límite explícito devuelve todas las filas.
- **Realidad:** `supabase/config.toml` fija `max_rows = 1000`. PostgREST corta ahí sin lanzar error — invisible con pocos datos de prueba, silencioso a escala real.
- **Fuente:** `specs/fixes/fix-053-b-ciclos-queries-limit`

### DG-009 — Un campo "sede" en un listado puede ser un placeholder sin JOIN real
- **Trampa:** asumir que el campo "sucursal" de una fila ya trae el nombre resuelto.
- **Realidad:** un facade lo rellenaba con `` `Sucursal ${branch_id}` `` porque la query nunca hacía join a `branches`.
- **Fuente:** `specs/fixes/fix-064-m-base-alumnos-b-columna-sede`

### DG-010 — PostgREST devuelve una FK many-to-one como objeto, NO como array
- **Trampa:** indexar `relacion[0]?.campo` sobre el resultado de un join, "porque Supabase siempre devuelve array".
- **Realidad:** en una relación many-to-one (ej. `payments.enrollment_id → enrollments.id`), PostgREST devuelve el objeto plano, no un array. `[0]` sobre un objeto es siempre `undefined`.
- **Fuente:** `specs/fixes/fix-056-b-reportes-contables-branch-id`

### DG-011 — Un trigger `AFTER UPDATE` que reescribe la misma fila sin guarda causa recursión infinita
- **Trampa:** un trigger que hace `UPDATE` sobre la fila que lo disparó, sin `pg_trigger_depth()` ni condición de salida.
- **Realidad:** se re-dispara indefinidamente hasta `stack depth limit exceeded` — rompe cualquier replay de migraciones desde cero (`supabase db reset`), aunque en producción (donde nunca se re-ejecuta desde cero) el síntoma no aparece.
- **Fuente:** `specs/hotfixes/hotfix-044-m-trigger-dropout-recursion-infinita`

### DG-012 — `DEFAULT NOW()` en `updated_at` no la mantiene actualizada
- **Trampa:** asumir que una columna con `DEFAULT NOW()` refleja la última edición.
- **Realidad:** sin un trigger `BEFORE UPDATE` explícito, el valor queda congelado en el del INSERT original sin importar cuántas ediciones sufra la fila.
- **Fuente:** `specs/hotfixes/hotfix-012-m-class-b-sessions-updated-at`

### DG-013 — El orden de las migraciones importa para un replay desde cero, no solo para producción
- **Trampa:** pensar que si la BD remota ya está migrada, el orden de los archivos es cosmético.
- **Realidad:** 3 casos reales rompían `supabase db reset`: un `DROP COLUMN` antes que el `DROP VIEW` que dependía de ella; una FK agregada sobre una columna ya eliminada por otra migración posterior en timestamp; un `COMMENT ON COLUMN users.gender` cuando `gender` en realidad vive en `students`. Ninguno afecta producción ya migrada, pero bloquean cualquier entorno local nuevo.
- **Fuente:** `hotfix-041-m-orden-drop-view-schedule-availability`, `hotfix-043-m-fk-exam-scores-student-id-dropped`, `hotfix-045-m-comment-gender-tabla-incorrecta`

## RLS / Scope de sede

### DG-014 — El scope de sede de la secretaria vive en el query layer, NO en RLS
- **Trampa:** asumir que RLS ya protege todo el acceso por sede, o al revés, que basta con leer `branchFacade.selectedBranchId()` para cualquier rol.
- **Realidad:** decisión de diseño documentada — las RLS de `students`/`instructors`/`select_users` son deliberadamente amplias (para que el selector de destinatarios de Tareas funcione), y el filtro real de sede para la secretaria se hace en PostgREST vía `getActiveBranchId()` (admin → selector del topbar; si no → `user.branchId`). El selector del topbar es **solo-admin** — para la secretaria vale `null`, así que cualquier facade que lea el selector directo se salta el filtro → fuga de PII entre sedes.
- **Fuente:** `specs/fixes/fix-027-b-aislamiento-sede-secretaria`. **NUNCA tocar la RLS de `users` para "arreglar" esto** — reintroduce la regresión de fix-002.

### DG-015 — Una policy de UPDATE más estricta que la de INSERT se expone recién con un upsert
- **Trampa:** verificar solo la policy INSERT de una tabla y asumir que cubre todo el flujo de escritura.
- **Realidad:** un endpoint hacía upsert (`on_conflict=...`); si la fila ya existía, Postgres lo resuelve como UPDATE, con una policy distinta (más restrictiva). El bug era intermitente — solo en reintentos — y admin nunca lo reproducía porque su policy sí cubría ambos casos.
- **Fuente:** `specs/fixes/fix-054-m-h028-rls-secretaria-documentos-profesional`

### DG-016 — Una función `SECURITY DEFINER` dentro de una policy RLS corre por fila, no por query
- **Trampa:** pensar que un helper de RLS (ej. `branch_visible()`) es "gratis" porque anda rápido en dev con pocos datos.
- **Realidad:** por ser `SECURITY DEFINER`, Postgres no puede inlinearla — se ejecuta como llamada opaca **una vez por cada fila escaneada**, con sus propias subconsultas. A volumen real dispara `statement timeout` (SQLSTATE 57014) solo para roles no-admin (admin corto-circuita antes). Invisible en local con datos sintéticos, revienta en producción. Pasó en 2 tablas distintas.
- **Fuente:** `specs/fixes/fix-060-m-h027-alertas-asistencia-profesional-sede`, `specs/fixes/fix-061-m-students-rls-branch-visible-performance`

### DG-017 — Un helper de RLS puede devolver `NULL`, y `NULL` en una policy significa "no cumple"
- **Trampa:** asumir que una condición booleana en una policy siempre resuelve a `true`/`false`.
- **Realidad:** `branch_visible(branch_id)` devolvía `NULL` cuando `auth_user_branch_id()` daba `NULL` (edge case) — en SQL, `NULL` en un `WHERE`/policy se trata como "no cumple", ocultando filas enteras (instructores desaparecían) sin ningún error visible.
- **Fuente:** `specs/fixes/fix-067-b-regresion-instructores-desaparecen-sin-branch-filter`

### DG-018 — Un filtro `.eq()` del cliente puede excluir una fila que RLS sí habría dejado ver
- **Trampa:** agregar `.eq('branch_id', x)` en el cliente "para ser explícitos", sin pensar en cómo interactúa con RLS.
- **Realidad:** el filtro de PostgREST se aplica en la query — si excluye una fila que la policy sí permitiría (ej. un admin con `branch_id` distinto o null), esa fila nunca llega al cliente, sin importar que RLS la habilitara.
- **Fuente:** `specs/fixes/fix-066-b-admin-no-aparece-en-selector-de-secretaria`

### DG-019 — Todo Facade con datos de sede debe filtrar — no asumir que "ya viene filtrado"
- **Trampa:** crear un Facade nuevo sin revisar `facades.md` §7 (Facades Multi-Sede), o usar el filtro de sede global donde correspondía uno más específico.
- **Realidad:** pasó 2 veces: un Facade (`AnticiposFacade`) traía instructores/anticipos de TODAS las sedes siempre, sin reaccionar al cambio de sede del topbar; y un modal contextual (incorporar alumno a un ciclo) filtraba con el selector global de sede en vez del `branchId` del propio ciclo abierto, mostrando candidatos de sedes irrelevantes con "Todas las sedes" seleccionado.
- **Fuente:** `specs/fixes/fix-071-m-anticipos-no-reactivo-a-sede`, `specs/fixes/fix-063-m-reprogramar-clase-instructores-todas-sedes`, `specs/fixes/fix-022-m-incorporar-modal-polish`

### DG-020 — Ocultar del menú/selector no protege la navegación directa por URL
- **Trampa:** creer que ocultar una opción del sidebar o forzar el selector de sede ya protege esa página.
- **Realidad:** escribir la URL directa de una página profesional en una sede sin `has_professional` igual entraba (sin fuga de datos, pero vista vacía) — faltaba un guard de ruta. Relacionado: existió un tiempo un "hack" que simulaba el grant de autorización multisede comparando el email contra strings (`'multisede'`/`'autorizada'`) en vez de usar el grant real `users.can_access_both_branches` ya existente en BD.
- **Fuente:** `specs/fixes/fix-028-b-gating-profesional-sede-sin-profesional`, `specs/fixes/fix-029-b-guard-ruta-profesional-sede`

## Lógica de negocio / estados

### DG-021 — El orden de evaluación de condiciones de negocio puede producir el mensaje/bloqueo equivocado
- **Trampa:** evaluar `age < 18` antes que `professional && age < 20` en una cadena de reglas.
- **Realidad:** un alumno de 17 años en curso Profesional recibía el mensaje de "autorización notarial" (como si a los 18 pudiera avanzar), cuando la restricción real que lo bloquea es la edad mínima profesional (20). La función además estaba duplicada en 2 componentes con el mismo bug, divergiendo en silencio — **toda lógica de negocio compartida entre componentes debe vivir en `core/utils/`, nunca copiarse**.
- **Fuente:** `specs/fixes/fix-013-b-menor-17-profesional-mensaje`, `specs/fixes/fix-014-b-getAgeStatus-compartido`

### DG-022 — `class_number` es un contador de progreso, NO una secuencia cronológica
- **Trampa:** asumir que la clase #3 debe ocurrir antes que la #4 en el tiempo, y bloquear reprogramaciones "fuera de orden".
- **Realidad:** un alumno puede faltar a la #3 y asistir a la #4 ya realizada; al reagendar la #3, cualquier fecha futura es necesariamente posterior a la #4. Las únicas invariantes reales son: exactamente 12 sesiones, sin doble-booking, tope diario. Una restricción de orden cronológico se agregó y tuvo que revertirse.
- **Fuente:** `specs/fixes/fix-031-m-revertir-restriccion-orden-class-number` (contexto: `specs/fixes/fix-030-m-reprogramar-clase-limite-superior`)

### DG-023 — "Agendar" y "pagar" son conceptos independientes — no derivar uno del otro
- **Trampa:** calcular cuántas clases agendar a partir de `payment_mode` (ej. `payment_mode === 'partial' ? ceil(total/2) : total`).
- **Realidad:** el agendamiento SIEMPRE es de 12 clases por decisión de negocio; solo el **monto cobrado** depende de `payment_mode`. La fórmula se repitió en ~10 lugares y quedó mal el día que cambió la regla.
- **Fuente:** `specs/fixes/fix-017-m-clase-b-siempre-12-clases`

### DG-024 — Un límite de negocio hardcodeado en 3+ lugares se corrige a medias
- **Trampa:** cambiar un tope de negocio (ej. clases máximas por día) en un solo archivo y asumir que aplica a todo el sistema.
- **Realidad:** el tope vivía por separado en el wizard público, el wizard interno, la reasignación de clases canceladas y el cálculo de fechas bloqueadas de reprogramación — 4 puntos, uno de ellos no evidente hasta revisar el Facade completo.
- **Fuente:** `specs/fixes/fix-062-m-unificar-limite-clases-dia`

### DG-025 — Un cron que actualiza sin re-verificar el estado puede pisar un cambio hecho en la misma corrida
- **Trampa:** que una función de fin de día haga `UPDATE ... SET status='no_show' WHERE id=...` sin `AND status='scheduled'`, confiando en que el cursor del loop refleja el estado actual.
- **Realidad:** si otra función ya canceló esa fila en la misma corrida (el cursor es un snapshot tomado al inicio), el `UPDATE` la sobrescribe de vuelta, perdiendo el estado real. **Todo `UPDATE` dentro de un loop sobre snapshot debe re-verificar la condición de estado en el `WHERE`.**
- **Fuente:** `specs/fixes/fix-028-m-clase-b-consecutive-issues`

### DG-026 — Una sesión `in_progress` puede quedar huérfana para siempre si nadie la cierra
- **Trampa:** contar "clases activas ahora" con `COUNT` sobre `status='in_progress'` sin acotar por fecha, y no ofrecer acción de "Finalizar" para clases en curso (solo para pendientes).
- **Realidad:** si una sesión queda colgada en `in_progress` (instructor no finaliza, crash, prueba abandonada), el conteo la sigue sumando indefinidamente, incluso días después. El conteo de "activas ahora" debe acotarse a **hoy**, y debe existir una acción de cierre manual. El mismo bug estaba duplicado como implementaciones independientes en Dashboard Admin y Dashboard Secretaria.
- **Fuente:** `specs/fixes/fix-075-m-instructores-clases-activas-scope-hoy`, `specs/fixes/fix-076-m-dashboard-finalizar-clase-en-curso`, `specs/fixes/fix-077-m-secretaria-dashboard-finalizar-clase-en-curso`

### DG-027 — Una vista de disponibilidad puede marcar como "ocupadas" las propias reservas recién creadas
- **Trampa:** que una vista de disponibilidad marque `occupied` cualquier sesión no cancelada de un enrollment no expirado, sin excluir el enrollment del propio flujo en curso.
- **Realidad:** al confirmar el paso 2 del wizard (reservar 12 clases), el INSERT dispara Realtime, que re-consulta disponibilidad — y las 12 clases recién reservadas por el propio alumno vuelven marcadas `occupied`, purgando la selección como si fueran de otro alumno.
- **Fuente:** `specs/fixes/fix-082-m-clases-b-vuelven-ocupadas-al-volver-paso2`

### DG-028 — Un set de "estados a excluir" hardcodeado se desincroniza cuando aparece un estado nuevo
- **Trampa:** mantener una lista de estados "incompletos" (`INCOMPLETE_STATUSES`) en un lugar del archivo y no actualizarla cuando se agrega un estado nuevo en otro método del mismo archivo.
- **Realidad:** `EnrollmentFacade` inserta `status: 'draft'` apenas se completa el paso 1; el set de exclusión de "Base de Alumnos" solo tenía `'cancelled'`/`'pending_payment'`, no `'draft'` — un abandono justo tras el paso 1 aparecía como alumno "Pre-inscrito" real.
- **Fuente:** `specs/fixes/fix-066-m-drafts-en-base-alumnos`

### DG-029 — Un alumno puede tener más de una matrícula activa a la vez — no asumir "la más reciente"
- **Trampa:** que una vista (Pagos, KPI de Dashboard) siempre muestre/opere sobre la matrícula más nueva del alumno.
- **Realidad:** un alumno con Clase B (con saldo pendiente) y Profesional (pagada, creada un día después) queda sin forma de ver ni pagar su deuda real si la UI solo mira la más reciente.
- **Fuente:** `specs/fixes/fix-058-b-pago-multiples-matriculas`

### DG-030 — Ningún lado valida un pago contra el saldo pendiente — hay que agregarlo explícitamente
- **Trampa:** asumir que un `CHECK (total_amount > 0)` en BD acota de alguna forma razonable el monto de un pago.
- **Realidad:** ni cliente ni BD validaban el pago contra el saldo del enrollment — se podía registrar un pago de $200.000.000 sobre una deuda de $90.000 sin ningún freno.
- **Fuente:** `specs/fixes/fix-057-m-registrar-pago-monto-excesivo-silencioso`

### DG-031 — Redondear porcentajes de forma independiente no garantiza que sumen 100%
- **Trampa:** hacer `Math.round(monto/total*100)` por cada método de pago por separado.
- **Realidad:** valores como 87.5%/12.5% redondean ambos hacia arriba (88%+13%=101%) — requiere método de "mayor remanente" para repartir el déficit/exceso.
- **Fuente:** `specs/fixes/fix-059-m-metodos-pago-porcentaje-redondeo`

### DG-032 — `0` es un valor de negocio legítimo — no equivale a "vacío" o "inválido"
- **Trampa:** usar `Validators.min(1)` en un campo numérico pensando que "0 no tiene sentido".
- **Realidad:** un vehículo recién ingresado a la flota legítimamente tiene kilometraje inicial `0`.
- **Fuente:** `specs/fixes/fix-036-m-km-inicial-cero-permitido`

### DG-033 — Extraer la hora de un timestamp ISO sin convertir zona horaria da la hora UTC cruda
- **Trampa:** hacer `scheduledAt.split('T')[1]` asumiendo que ya está en hora local.
- **Realidad:** eso da la hora UTC; hay que convertir con `toLocaleTimeString('es-CL', {timeZone:'America/Santiago', ...})` como ya hace otro componente del mismo flujo. Dos vistas del mismo dato mostraban horas distintas (11:00 vs 15:00) para la misma clase.
- **Fuente:** `specs/hotfixes/hotfix-030-m-dashboard-clase-hora-incorrecta`

### DG-034 — Un alumno "egresado" (`enrollments.status = 'completed'`) debe excluirse de las listas de activos
- **Trampa:** que la query de "Base de Alumnos" no filtre por `status != 'completed'`.
- **Realidad:** un mismo alumno egresado aparecía simultáneamente en "Base Alumnos" y "Ex-Alumnos" — dos vistas que deberían ser mutuamente excluyentes según el estado real de la matrícula.
- **Fuente:** `specs/fixes/fix-084-m-unificar-tablas-alumnos-exalumnos`

## Gobernanza

### DG-035 — Una migración aplicada solo vía SQL Editor de Supabase nunca queda en git
- **Trampa:** confiar en que `indices/DATABASE.md` describe con precisión qué migración define una función, sin verificar que el archivo exista en `supabase/migrations/`.
- **Realidad:** dos funciones SQL documentadas con migración y fecha específicas **nunca existieron en git** — se aplicaron directo en el SQL Editor. Hubo que recuperar el código real desde producción y crear la migración retroactivamente. **Nunca alterar la BD desde el Dashboard sin además commitear el archivo de migración correspondiente.**
- **Fuente:** `specs/fixes/fix-028-m-clase-b-consecutive-issues`

### DG-036 — Los roles tienen nomenclatura dual: inglés en BD/RLS, español en frontend
- **Trampa:** buscar `'secretaria'`/`'alumno'` en una condición de BD/RLS, o `'secretary'`/`'student'` en un template.
- **Realidad:** BD y RLS usan `'secretary'`/`'student'`; el frontend usa `'secretaria'`/`'alumno'`. Ambos conviven sin glosario formal que los mapee — terreno fértil para bugs de autorización silenciosos.
- **Fuente:** `specs/hotfixes/hotfix-019-b-limpieza-deuda-rbac-roleservice-hasrole`

### DG-037 — Los 2 años de antigüedad de licencia B (Profesional) se cuentan hasta el inicio del curso, NO hasta la fecha de matrícula
- **Trampa:** validar `students.license_obtained_date` contra `today()` o contra la fecha en que se crea el `enrollment`, pensando que es "la fecha de matrícula" lo relevante.
- **Realidad:** decisión de negocio confirmada explícitamente con el owner (2026-07-28): la referencia legal es `professional_promotions.start_date` de la promoción elegida en el wizard — un alumno puede matricularse **antes** de cumplir los 2 años si, para cuando arranca su promoción, ya los tendrá. Es una **advertencia no bloqueante** (la secretaría puede matricular igual bajo su criterio), no un bloqueo duro. `core/utils/license-seniority.utils.ts` (`calcLicenseSeniority`) implementa el cálculo; el wizard además muestra una estimación temprana en Step 1 contra la fecha de hoy, aclarando que se recalcula contra la promoción real en Step 2 — no reemplaza el chequeo definitivo.
- **Fuente:** `specs/fixes/fix-089-m-licencia-b-dos-anos-profesional`, `specs/assignments/ASG-b-041-licencia-b-dos-anos-profesional.md`

### DG-038 — `student_documents.type` tenía DOS vocabularios distintos para el mismo documento
- **Trampa:** asumir que el selector de tipo del drawer de subida manual del DMS
  (`dms-upload-drawer.component.ts`) usaba las mismas claves que el resto del sistema.
- **Realidad:** el flujo de matrícula (online/presencial, `EnrollmentDocumentsFacade`,
  `AdminAlumnosFacade`) escribe/lee `student_documents.type` con claves como `id_photo`,
  `cedula_identidad`, `certificado_medico`, `hoja_vida_conductor`. El drawer de subida manual
  del DMS (para agregar documentos *después* de la matrícula) tenía su **propio** set de claves
  inventadas (`cedula`, `hoja_vida`, `foto_carnet`, `foto_licencia`) que nunca coincidían con
  las anteriores. Un documento subido manualmente con esas claves quedaba "invisible" para
  cualquier lógica que buscara el tipo real (ej. `AdminAlumnosFacade` chequea
  `types.has('cedula_identidad')` para un badge — un archivo subido como `'cedula'` nunca lo
  activaba) y se mostraba con la etiqueta cruda (`'id_photo'`) en vez de un label legible cuando
  el tipo real SÍ coincidía pero faltaba en `LABELS_TIPO_ALUMNO`.
- **Fix:** `studentDocTypes` del drawer ahora usa las claves canónicas reales. Las claves viejas
  quedan en `LABELS_TIPO_ALUMNO` marcadas `(legacy)` solo para no mostrar crudo un tipo ya
  guardado en BD con la clave antigua, pero ya no se ofrecen como opción nueva. **Caso especial:**
  `v_dms_student_documents` fija `type = 'contract'` (hardcodeado en el `UNION ALL` de la vista,
  `20260404120000_academic_alter_remove_redundant_student_id.sql`) para las filas que vienen de
  `digital_contracts` — no de `student_documents`, y no coincide con la opción del selector
  (`value: 'contrato'`). El filtro de "tipos ya subidos" en `dms-upload-drawer.component.ts`
  normaliza `'contract' → 'contrato'` antes de comparar, si no un alumno con contrato digital
  seguía viendo "Contrato" disponible para subir de nuevo.
- **Fuente:** spec `0003-m-repositorio-documentos-instructores` (reportado por el owner al
  probar el nuevo tab de Instructores, 2026-07-29).

### DG-039 — `professional_promotions` tiene `branch_id`, pero no todos los Facades del dominio lo respetan
- **Trampa:** asumir que porque `CertificacionProfesionalFacade` (mismo dominio, tabla
  adyacente) ya filtra por sede vía `resolveBranchScope()`/`getActiveBranchId()`, el resto de
  Facades de Clase Profesional que leen `professional_promotions` también lo hacen.
- **Realidad:** `PromocionesFacade.fetchData()` y `AsistenciaProfesionalFacade.loadPromociones()`
  consultaban `professional_promotions` **sin ningún filtro de sede** — ni `BranchFacade`
  inyectado, ni `.eq('branch_id', ...)`. La RLS de la tabla (`select_professional_promotions`)
  solo valida rol (`admin`/`secretary`/`student`), no sede, así que nada a nivel de BD detenía
  la fuga: admin y secretaria veían/editaban promociones de todas las sedes sin importar la
  seleccionada. Además, `PromocionesFacade.crearPromocion()` grababa `branch_id: 2` **hardcodeado**
  ("Conductores Chillán") en cada promoción nueva, sin leer la sede activa. Ambas vistas ya
  llamaban `branchFacade.setProfessionalOnly(true)` (fuerza `requiresSpecificBranch`, deshabilita
  "Todas las escuelas"), así que `selectedBranchId()` nunca es `null` mientras están activas —
  no había excusa de ambigüedad para no filtrar.
- **Fuente:** `specs/fixes/fix-090-m-drawers-scope-sede`, `specs/assignments/ASG-b-043-drawers-informacion-de-sede.md`

### DG-040 — `EnrollmentFacade.loadCourses()` sin `branchId` explícito carga cursos de TODAS las sedes mezclados
- **Trampa:** asumir que `_courses()` en `EnrollmentFacade` siempre está acotado a una sola
  sede, y buscar un curso ahí filtrando solo por `license_class` (ej. `'A2'`, `'B'`).
- **Realidad:** `loadCourses(branchId?: number)` solo aplica `.eq('branch_id', ...)` si
  `branchId` (o el fallback `user?.branchId`) resuelve a un valor. Si se llama sin argumento
  desde un contexto donde el usuario no tiene una sede propia (ej. un admin reanudando un
  borrador vía `resumeDraft()`), no hay filtro y `_courses()` termina con cursos de **todas
  las sedes**. Como los cursos "Profesional" (A2–A5) solo existen en la sede "Conductores
  Chillán" y esa misma sede tiene un curso "Clase B" a un precio distinto, un `.find()` por
  `license_class` sin `branch_id` puede resolver al curso equivocado — causó que una
  matrícula Profesional A2 ($800.000) se cobrara al precio de Clase B de otra sede
  ($180.000). Usar siempre `findCourseByLicenseClass(courses, licenseClass, { branchId })`
  (`core/utils/course-resolution.utils.ts`) en vez de un `.find()` manual.
- **Fuente:** `specs/fixes/fix-013-i-precio-profesional-a2-incorrecto`, `specs/assignments/ASG-b-016-fix-h029-precio-profesional-incorrecto.md`

### DG-041 — `log_change()` solo resuelve `entity_label` legible para un subconjunto de tablas; el resto cae a `id=X`
- **Trampa:** asumir que cualquier tabla con trigger `trg_audit_*` → `log_change()` produce un
  detalle de auditoría legible ("Registrado: Juan Pérez"). Migrar una tabla nueva a auditoría
  agregando solo el `CREATE TRIGGER ... EXECUTE FUNCTION log_change()` (sin tocar la función)
  no alcanza.
- **Realidad:** `log_change()` resuelve `v_entity_label` con una cadena `IF/ELSIF` explícita por
  `TG_TABLE_NAME`. Cualquier tabla sin rama propia cae al `ELSE` genérico
  (`'id=' || COALESCE(v_src->>'id', '?')`), produciendo entradas inútiles como
  `"Creado: id=97"`. Antes de `fix-097-m` (`20260801120000_audit_log_enrich_missing_entities.sql`)
  esto afectaba a `student_documents`, `certificates`, `vehicles`, `vehicle_documents`,
  `maintenance_records`, `class_b_theory_sessions`, `promotion_courses`, `class_book`,
  `professional_theory_sessions`, `professional_practice_sessions` y
  `professional_module_grades` — 11 de las ~23 tablas auditadas. Además, la migración
  `20260614201000_enrich_audit_log_trigger.sql` reemplazó por completo la versión anterior de
  `log_change()` (`20260323130000`) y en el camino **perdió sin querer** el skip de acciones de
  admin y la resolución de `user_id` vía header `x-audit-user-id` (Edge Functions) — esa
  regresión sigue sin corregir, quedó documentada en `indices/DATABASE.md` pero fuera del
  alcance de `fix-097-m` (una sola causa raíz por fix). Al agregar auditoría a una tabla nueva,
  siempre agregar también su rama `ELSIF` en `log_change()`, no solo el trigger.
- **Fuente:** `specs/fixes/fix-097-m-auditoria-detalle-enriquecido`

### DG-042 — `audit_log` no registró NINGUNA acción entre 2026-06-14 y 2026-08-01 (bug `record ->> texto`)
- **Trampa:** asumir que porque `audit_log` tiene filas y la UI de Auditoría las muestra, el
  trigger `log_change()` está funcionando en el presente. Un `SELECT COUNT(*) FROM audit_log`
  con resultados > 0 no prueba que siga insertando — puede estar mostrando solo historial
  viejo.
- **Realidad:** la migración `20260614201000_enrich_audit_log_trigger.sql` declaró la variable
  de trabajo `v_src` como `record` y luego usó `v_src->>'columna'` en casi cada línea de la
  función. El operador `->>` **no existe para el tipo `record`/fila compuesta en Postgres**
  (solo para `json`/`jsonb`) — la función rompía literalmente en la primera operación después
  del `BEGIN`, para **cualquier tabla y cualquier operación** (INSERT/UPDATE/DELETE). El
  `EXCEPTION WHEN OTHERS` que envuelve toda la función atrapaba el error, hacía
  `RAISE WARNING 'audit_log error: %'` y retornaba `NEW`/`OLD` sin insertar nada — silencioso
  a nivel de aplicación (no rompe la transacción principal, por diseño), pero significa que
  **desde 2026-06-14 hasta el fix de 2026-08-01, ninguna acción de ninguna secretaria/admin
  quedó auditada**. Se detectó al verificar empíricamente `fix-099-m` contra Supabase local
  (`docker exec supabase_db_Autoescuela psql`): un `UPDATE` de prueba lanzaba
  `WARNING: audit_log error: operator does not exist: <tabla> ->> unknown` y no dejaba fila
  nueva. Se corrigió cambiando `v_src` a `jsonb` con `to_jsonb(OLD)`/`to_jsonb(NEW)`. Lección:
  cualquier cambio a `log_change()` debe verificarse con un INSERT/UPDATE/DELETE real contra
  Supabase local (`npx supabase db push --local` + docker exec psql), no solo revisando el
  SQL a simple vista — los `EXCEPTION WHEN OTHERS` genéricos en triggers de auditoría ocultan
  este tipo de rotura por completo.
- **Fuente:** `specs/fixes/fix-099-m-audit-log-header-user-id-perdido`

### DG-043 — `log_change()` tiene múltiples migraciones que la redefinen completa; agregar una rama `ELSIF` en una sola no alcanza
- **Trampa:** agregar la rama `ELSIF TG_TABLE_NAME = 'tabla_nueva'` en la migración que
  "parece" la más reciente (`20260801120000_audit_log_enrich_missing_entities.sql`, la de
  `fix-097-m`) y asumir que ya quedó cubierta en la BD real.
- **Realidad:** `20260801140000_audit_log_restore_header_user_id.sql` (`fix-099-m`) corre
  **después** y hace su propio `CREATE OR REPLACE FUNCTION log_change()` completo — copiado
  del cuerpo de la función *antes* de que `fix-097-m` agregara sus ramas nuevas. Como Postgres
  no tiene "diff de funciones", cada `CREATE OR REPLACE` reemplaza el cuerpo entero: la versión
  que gana es la de la migración con el timestamp más alto, sin importar en qué migración
  intermedia se agregó una rama. `website_config` cayó en este hueco (fix-097-m no la incluyó
  porque no estaba en su lista de triggers auditados, y aunque se le hubiera agregado ahí,
  `fix-099-m` la habría vuelto a perder igual). **Antes de agregar/tocar una rama de
  `log_change()`, buscar cuál es la migración con el timestamp MÁS ALTO que contenga
  `CREATE OR REPLACE FUNCTION public.log_change()` (`grep -rl "FUNCTION public.log_change" supabase/migrations | sort | tail -1`) y aplicar el cambio ahí — es la única versión
  que realmente queda vigente.** Verificar siempre contra la BD local
  (`docker exec supabase_db_Autoescuela psql -c "SELECT pg_get_functiondef('public.log_change'::regproc)"`),
  no contra el archivo de migración que uno cree que es el "correcto".
- **Fuente:** `specs/fixes/fix-100-m-auditoria-website-config-sin-enriquecer`

### DG-044 — `log_change()` mostraba nombres de columna crudos y valores de FK como ID de Supabase
- **Trampa:** asumir que agregar una columna al `CASE` de 8 entradas de `v_col_label` era
  suficiente para que "Actividad reciente"/"Auditoría" fueran legibles. Aunque se tradujera
  el nombre (`promotion_course_id` → "Curso de promoción"), el diff seguía mostrando el
  **valor** crudo (`null -> 29`) — un ID de Supabase que el humano no maneja ni puede
  interpretar sin abrir la BD.
- **Realidad:** desde `fix-102-m` (`20260802120000_audit_log_humanize_columns_and_values.sql`)
  el diff de UPDATE usa dos funciones nuevas, independientes de `log_change()`:
  `audit_humanize_column(text)` (diccionario de ~90 columnas + fallback genérico
  `initcap(replace(col,'_',' '))`) y `audit_resolve_display_value(column, value)` (resuelve
  IDs de FK y enums conocidos a texto legible, ej. `promotion_course_id=29` →
  `"PC-A2-01 (Clase Profesional A2)"`, `current_step=3` → `"Documentos"`). Ambas devuelven un
  fallback razonable (nombre humanizado / valor crudo) cuando no tienen regla — nunca rompen
  el flujo. **Agregar una columna nueva al diccionario o una FK nueva a resolver ya NO requiere
  tocar `log_change()` completa** — solo `CREATE OR REPLACE FUNCTION audit_humanize_column`
  o `audit_resolve_display_value`, evitando el problema de DG-043 (múltiples migraciones que
  redefinen `log_change()` completa y se pisan entre sí).
- **Fuente:** `specs/fixes/fix-102-m-auditoria-diccionario-columnas-completo`

### DG-045 — Fallback 3 de `v_user_id` en `log_change()` casteaba un UUID directo a `INT` — nunca funcionó
- **Trampa:** asumir que cualquier acción hecha desde una sesión autenticada normal (no Edge
  Function) queda atribuida al usuario real en `audit_log`, para cualquier tabla.
- **Realidad:** `request.jwt.claim.sub` es el **UUID** de Supabase Auth (`auth.uid()`), no el
  `id` serial de `public.users`. El Fallback 3 (vigente desde el origen de `log_change()`
  hasta `20260801140000`) hacía
  `v_user_id := (NULLIF(current_setting('request.jwt.claim.sub', true), ''))::INT` — castear
  un string UUID a `INT` **siempre lanza excepción**, atrapada por el
  `EXCEPTION WHEN OTHERS THEN v_user_id := NULL` que envuelve ese mismo bloque. Este fallback
  **nunca pudo resolver un usuario real**, para ninguna tabla ni operación. Como la mayoría de
  las tablas auditadas tienen `registered_by` (Fallback 2, sí funciona), el bug pasó
  desapercibido — pero `users`, `students`, `vehicles`, `vehicle_documents`,
  `promotion_courses` y `website_config` no tienen esa columna, y cualquier UPDATE/INSERT
  sobre ellas desde una sesión normal (ej. un instructor completando su primer login vía el
  RPC `user_complete_first_login()`) quedaba con `user_id=NULL` → "Sistema / Online" en el
  frontend, en vez del nombre real del actor. El proyecto ya resolvía este mapeo
  correctamente en otro lado — `auth_user_id()` (`20260301000011_10_rls_policies.sql:23-26`,
  usada en RLS) — pero `log_change()` nunca lo reutilizó. Corregido en `fix-103-m`
  (`20260802130000_audit_log_fix_jwt_sub_cast.sql`): el Fallback 3 ahora resuelve
  `SELECT id FROM public.users WHERE supabase_uid = <uuid>::UUID` en vez de castear directo.
  Al tocar `log_change()` de nuevo, verificar que este fallback siga usando `supabase_uid`,
  no un cast directo del claim `sub`.
  > ⚠️ **Corrección posterior (DG-049/fix-108-m):** este fix arregló el cast pero seguía leyendo
  > un GUC (`current_setting('request.jwt.claim.sub')`) que PostgREST **nunca setea** en este
  > stack — verificado solo con un fixture SQL que simulaba el GUC a mano, nunca contra una
  > petición HTTP real. El Fallback 3 vigente ya no usa ese GUC — ver DG-049.
- **Fuente:** `specs/fixes/fix-103-m-auditoria-atribucion-autor-first-login`

### DG-046 — Traducir el NOMBRE de columna no basta si el VALOR sigue en inglés (booleanos y enums)
- **Trampa:** dar por resuelto "Actividad reciente" en español apenas `audit_humanize_column()`
  (DG-044/fix-102-m) traduce la etiqueta de columna. `"Primer inicio de sesión: true -> false"`
  demuestra que la etiqueta puede estar perfecta y el VALOR seguir crudo — Postgres inserta
  literalmente `true`/`false` para booleanos y el token del enum (`draft`, `active`,
  `no_show`, etc.) tal cual está en la BD.
- **Realidad:** `audit_resolve_display_value()` ahora intenta, en cascada, cuando la columna
  no tiene una regla de FK/enum propia por NOMBRE: (1) booleano → `"Sí"`/`"No"`, (2)
  `audit_humanize_enum_value()` — diccionario de ~110 valores de enum conocidos del esquema.
  A diferencia del diccionario de columnas, **este NO tiene fallback de humanización
  genérica** — capitalizar una palabra en inglés (`"Draft"`) no la traduce, así que un enum
  nuevo no listado sigue mostrándose crudo hasta agregarlo a `audit_humanize_enum_value()`.
  El público de este sistema (dueño, secretarias, instructores) no necesariamente maneja
  inglés — cualquier trigger o feature nueva que dependa de mostrar un valor de enum en
  auditoría/UI debe considerar agregarlo a este diccionario, no asumir que el token en inglés
  es aceptable.
- **Fuente:** `specs/fixes/fix-104-m-auditoria-traducir-valores-booleanos-enum`

### DG-047 — El backend puede tener el detalle legible y el frontend igual mostrarlo genérico (lo tira)
- **Trampa:** asumir que arreglar `log_change()` (DG-041/044/046) garantiza que "Actividad
  reciente" se vea bien, porque `audit_log.detail` ya viene legible. **No es así si el
  consumidor frontend descarta ese dato.**
- **Realidad:** `DashboardFacade.mapAuditLogToActivity()` (`dashboard.facade.ts`), para
  `action === 'DELETE'`, ignoraba por completo `log.detail` (que `log_change()` ya llena con
  `'Eliminado: ' || v_entity_label`, ej. `"Eliminado: Juan Perez - Clase Profesional A2
  ($800.000)"`) y lo reemplazaba por un mensaje genérico `"Eliminad{o/a} por {usuario}"` — ni
  arreglando el backend a la perfección se veía el QUÉ se eliminó. Además, el diccionario
  `entityNames` de esa misma función solo cubría 9 de ~23 tablas auditadas — **el mismo
  patrón de "cobertura parcial hardcodeada" de DG-041/DG-044, pero en el frontend, no en
  SQL** — cualquier tabla fuera de esa lista mostraba el título genérico "Registro" en vez
  del nombre real de la entidad. Corregido en `fix-105-m`: la rama DELETE ahora usa
  `log.detail` (limpiando el prefijo `"Eliminado: "`) y el diccionario se completó con las
  11 tablas que faltaban. **Lección:** cuando se audite/arregle un pipeline de datos con
  transformación en dos capas (BD → frontend), verificar AMBAS — un backend perfecto no
  sirve si el frontend tiene su propio fallback/diccionario incompleto que pisa el dato bueno.
- **Fuente:** `specs/fixes/fix-105-m-actividad-reciente-eliminados-genericos`

### DG-048 — `audit_humanize_enum_value()` no cubre entity_label; y los comentarios de columna del esquema original mienten sobre los valores reales
- **Trampa doble:** (a) asumir que agregar un valor a `audit_humanize_enum_value()`
  (DG-046/fix-104-m) lo traduce en TODA "Actividad reciente"/"Auditoría" — esa función solo
  se invocaba desde `audit_resolve_display_value()`, que corre exclusivamente dentro del
  diff de UPDATE. La construcción de `v_entity_label` (usada por INSERT y DELETE, y como
  prefijo `[...]` del propio UPDATE) es código aparte en `log_change()` que concatena
  columnas crudas vía `v_src->>'columna'` sin pasar por ningún diccionario. (b) confiar en
  los valores de enum documentados en el comentario `-- 'valor1' | 'valor2'` de la
  `CREATE TABLE` original como si fueran los que usa la app en producción.
- **Realidad:** tres ramas de `entity_label` (`student_documents`, `vehicle_documents`,
  `maintenance_records`) embebían la columna `type` cruda. Peor aún: el comentario de
  `student_documents.type` en `20260301000006_06_documents_and_dms.sql` documenta valores
  en inglés (`'national_id'`, `'driver_license'`, `'driver_record'`, `'psychological_exam'`,
  `'background_certificate'`) que **nunca se usaron en el código real** — verificado en
  `src/app/core/models/ui/enrollment-documents.model.ts` y
  `dms-upload-drawer.component.ts`, los valores reales son español-snake_case:
  `cedula_identidad`, `licencia_conducir`, `hoja_vida_conductor`, `autorizacion_notarial`,
  `contrato`, `certificado_medico`, `certificado_antecedentes`, `id_photo`. Reportado por el
  dueño con captura real: `"Sistema / Online eliminó: cedula_identidad de Ignacio Sorko"`.
  Corregido en `fix-106-m`: las tres ramas ahora pasan por
  `audit_humanize_enum_value()` antes de caer al valor crudo, y el diccionario se completó
  con los valores REALES (se conservan los del comentario original solo por compatibilidad,
  por si algún dato legacy los tiene). **Lección doble:** (1) cuando una función de
  traducción se agrega a un solo call-site, verificar TODOS los lugares donde el mismo tipo
  de dato crudo puede llegar al usuario — un diccionario que no está centralizado en una
  única función invocada desde todos los puntos de salida no cubre todo. (2) los comentarios
  `-- 'valor' | 'valor'` en `CREATE TABLE` son documentación aspiracional, no ground truth —
  antes de construir un diccionario de traducción, grepear el código real (`src/app/`) por
  el valor literal, no confiar en el comentario SQL.
- **Fuente:** `specs/fixes/fix-106-m-entity-label-tipo-documento-crudo`

### DG-049 — Un fixture SQL que simula `SET LOCAL request.jwt.claim.sub` no prueba nada sobre PostgREST real
- **Trampa:** dar por verificado un fix de atribución de usuario en `log_change()` porque un
  test SQL con `SET LOCAL request.jwt.claim.sub = '<uuid>'` + `UPDATE` + `SELECT` pasó en
  verde (así se "verificó" `fix-103-m`). Ese fixture solo prueba que la función parsea
  correctamente el GUC **si existiera** — nunca prueba que PostgREST lo setee en una petición
  HTTP real.
- **Realidad:** verificado empíricamente contra Supabase local (JWT firmado a mano con el
  `JWT_SECRET` del proyecto + `PATCH /rest/v1/users` real, sin fixture): PostgREST en este
  stack (Supabase, JWT/`db-pre-request` moderno) **solo** expone el JSON agregado
  `request.jwt.claims` (`{"aud":...,"sub":"<uuid>",...}`); el GUC plano
  `request.jwt.claim.<claim>` (legacy, `role-claim-key`) **no existe en absoluto** —
  `current_setting('request.jwt.claim.sub', true)` devuelve `NULL` silenciosamente (con
  `missing_ok=true` no hay excepción que delate el problema). Resultado: el Fallback 3 de
  `v_user_id` en `log_change()` (DG-045/fix-103-m) nunca resolvió un usuario real en NINGUNA
  petición real desde que existe, para ninguna tabla sin `registered_by` — "Sistema / Online"
  seguía apareciendo en producción pese al fix "verificado". `auth.uid()` sí funciona
  correctamente en el mismo contexto (confirmado con la misma prueba) — es el mecanismo que
  ya usa `auth_user_id()` en RLS (`20260301000011_10_rls_policies.sql:23-26`). Corregido en
  `fix-108-m`: el Fallback 3 ahora usa `auth.uid()` directo en vez del GUC plano. **Lección:**
  para cualquier lógica que dependa de contexto de petición HTTP (headers, JWT claims, GUCs de
  PostgREST), un test que fabrica ese contexto con `SET LOCAL`/mocks no reemplaza una prueba
  contra una petición real — verificar con `curl`/`fetch` real contra el Supabase local antes
  de dar el fix por cerrado.
- **Fuente:** `specs/fixes/fix-108-m-log-change-jwt-guc-inexistente`

### DG-050 — `class_b_sessions` con `status='reserved'` de un `enrollment` en `draft` quedan visibles horas antes de que el cron las limpie
- **Trampa:** asumir que el wizard de matrícula (`EnrollmentFacade`) guarda de forma
  transaccional, y que por lo tanto cualquier `class_b_sessions` visible en BD pertenece a
  una matrícula confirmada. Cualquier query nueva sobre `class_b_sessions` que solo excluya
  `status='cancelled'` (patrón copiado de `dashboard.facade.ts`) hereda el mismo bug.
- **Realidad:** el wizard es auto-save incremental por paso, no transaccional. El Paso 1
  (`savePersonalData()`) crea el `enrollment` en `status='draft'`. El Paso 2
  (`saveAssignment()`) ya inserta filas reales en `class_b_sessions` con
  `status='reserved'` — mucho antes del Paso 6 (`confirmEnrollment()`), donde recién
  `enrollments.status` pasa a `'active'` y las sesiones a `'scheduled'`. Si el usuario
  abandona el wizard entre el Paso 2 y el Paso 6, esas filas `reserved` quedan huérfanas en
  la base: un cron diario (`cleanup_expired_drafts`, 3am) las limpia, pero solo después de
  `expires_at` (14h) — ventana real de exposición de hasta ~38h. Durante esa ventana,
  aparecían como clases legítimas "por iniciar" en el Dashboard ("Clases Actuales") y en
  Asistencia B (tab Prácticas + alertas de inasistencia), porque ninguna de esas tres
  queries filtraba `enrollments.status` ni excluía `status='reserved'`. Reportado por el
  dueño con captura real: dos matrículas ("Bruno", "Pedro") que nunca completaron el Paso 4
  del wizard igual mostraban sus clases seleccionadas en el dashboard. Corregido en
  `fix-110-m`: nuevo util `VALID_CLASS_B_SESSION_STATUSES`
  (`core/utils/class-b-session.utils.ts`, excluye `'reserved'` y `'cancelled'`) aplicado en
  los tres call sites (`dashboard.facade.ts::fetchLiveClasses()`,
  `asistencia-clase-b.facade.ts::fetchPracticas()` y `::fetchAlertas()`), sumado a
  `.eq('enrollments.status', 'active')` donde faltaba. **Lección:** cualquier query nueva
  contra `class_b_sessions` debe usar `VALID_CLASS_B_SESSION_STATUSES` + filtro de
  `enrollments.status='active'` — no basta con excluir `'cancelled'`, porque `'reserved'`
  es un estado transitorio de matrícula en curso, no un estado final.
- **Fuente:** `specs/fixes/fix-110-m-clases-fantasma-matricula-draft`

### DG-051 — Un error sin capturar en `cleanup_expired_drafts()` aborta TODA la corrida del cron, no solo el último `DELETE`
- **Trampa:** asumir que si el log de Postgres muestra un solo `ERROR` (ej. una FK violation
  en el último `DELETE` de la función), solo esa sub-operación falló y el resto de la limpieza
  de esa noche sí se aplicó.
- **Realidad:** `cleanup_expired_drafts()` no tiene bloque `EXCEPTION`, así que cualquier error
  sin capturar en PL/pgSQL revierte **toda la transacción de esa invocación** — todos los
  `DELETE` anteriores (enrollments, class_b_sessions, payments, student_documents, etc.)
  también se revierten, aunque el log solo muestre el statement donde reventó. Ocurrió porque
  al agregar la limpieza de `users` huérfanos (`fix` del 2026-06-18) no se consideró que ese
  `user` podía tener una fila propia en `notifications.recipient_id` (`REFERENCES users(id)`
  sin `ON DELETE`, default `NO ACTION`) — el `DELETE FROM users` fallaba con FK violation,
  y como consecuencia el cron completo de esa noche (y de cada noche siguiente, mientras el
  mismo `user` bloqueado siguiera ahí) dejaba de limpiar cualquier draft expirado nuevo,
  acumulando backlog silencioso. Corregido en `fix-113-m`: se borra
  `notifications` del `user` huérfano antes del `DELETE FROM users`. **Lección:** cualquier
  tabla nueva que agregue `REFERENCES users(id)` sin `ON DELETE` es un candidato a romper este
  cron si algún día un `user` creado por el wizard de matrícula llega a tener una fila ahí antes
  de expirar como draft — revisar `cleanup_expired_drafts()` al agregar ese tipo de FK. Además,
  al editar esta función, verificar contra la migración más reciente que la toca (no contra un
  fix intermedio) — `fix-113-m` casi reintrodujo una referencia a `biometric_records`, tabla
  eliminada por una migración posterior a la que se usó como base.
- **Fuente:** `specs/fixes/fix-113-m-cleanup-drafts-notifications-fk-violation`

### DG-052 — `enrollments.pending_balance`/`total_paid` ya se recalculan atómicamente vía trigger; escribirlos manualmente desde el cliente causa lost-update
- **Trampa:** después de insertar un `payment`, hacer un segundo `UPDATE` manual sobre
  `enrollments` para "sincronizar" `total_paid`/`pending_balance`/`payment_status` a partir de
  un snapshot leído antes del insert (patrón que parece razonable: "calculo el nuevo saldo y lo
  guardo").
- **Realidad:** el trigger `trg_update_balance` (`recalculate_enrollment_balance()`,
  `20260301000008_08_misc_and_triggers.sql:170-202`) ya corre `AFTER INSERT OR UPDATE ON
  payments` y recalcula esos tres campos **siempre desde `SUM(payments.total_amount WHERE
  status='paid')`** — nunca desde un snapshot. Al ser un `UPDATE ... WHERE id =
  enrollment_id`, Postgres serializa triggers concurrentes vía row lock: dos inserts de pago
  al mismo enrollment (doble submit, dos pestañas) quedan correctamente sumados porque el
  segundo trigger espera al primero y su `SUM` ve ambos pagos. Un `UPDATE` manual posterior
  desde el cliente, calculado con un snapshot pasado por parámetro (leído *antes* de que
  cualquiera de los dos inserts corriera), **pisa** ese valor ya correcto — exactamente el
  lost-update que el trigger existe para evitar. `PagosFacade.registrarNuevoPago()` tenía este
  segundo `UPDATE` redundante; el alumno quedaba con saldo pendiente incorrecto tras doble
  submit, sin error visible. Corregido en `fix-114-m`: se eliminó el `UPDATE` manual — el
  trigger es la única fuente de verdad. **Lección:** antes de escribir cualquier `UPDATE`
  manual sobre `enrollments.total_paid`/`pending_balance`/`payment_status` tras un insert en
  `payments`, verificar si el trigger ya lo resuelve — casi siempre sí, y agregar una segunda
  escritura solo introduce una carrera nueva.
- **Fuente:** `specs/fixes/fix-114-m-race-condition-pending-balance-pagos`

### DG-053 — Componentes con prefijo `Admin*` en `features/admin/` pueden ser compartidos con secretaría, no exclusivos de admin
- **Trampa:** asumir que un componente en `src/app/features/admin/` y con nombre
  `Admin<Algo>Component` solo lo ve/usa el rol admin — y que por lo tanto una regla de
  negocio que dice "secretaría no debe ver X" no aplica a ese archivo porque "es de admin".
- **Realidad:** `SecretariaAsistenciaComponent` importa e instancia directamente
  `AdminIniciarClaseDrawerComponent` y `AdminFinalizarClaseDrawerComponent` (ver
  `secretaria-asistencia.component.ts`) — son literalmente el mismo componente para ambos
  roles, no una copia paralela. El prefijo `Admin` es un accidente de cuándo se creó el
  componente, no una declaración de scope de rol. Un pedido de negocio de "ocultar X a
  secretaría" que toque estas pantallas casi siempre es "ocultar X a admin también", porque
  no hay forma de diferenciar el rol dentro del componente sin agregarla explícitamente.
  Antes de asumir el alcance de un pedido de "el rol Y no debe ver Z", grepear quién más
  importa ese componente (`grep -rn "Admin<Nombre>Component" src/app/features/`) en vez de
  confiar en el nombre del archivo.
- **Fuente:** `specs/fixes/fix-115-m-ocultar-evaluacion-secretaria-admin`

### DG-054 — `class_b_sessions.status='in_progress'` no tiene límite de vida: sigue bloqueando `startClass()` aunque desaparezca de todos los dashboards de "hoy"
- **Trampa:** filtrar cualquier vista de "clases actuales/en curso" por `scheduled_at` acotado al
  día de hoy (`.gte(hoy 00:00).lte(hoy 23:59)`) asumiendo que eso cubre todas las sesiones
  `in_progress` relevantes — patrón usado en `dashboard.facade.ts`, `instructor-clases.facade.ts`
  y `asistencia-clase-b.facade.ts` (`fetchPracticas` con `_selectedDate` por defecto hoy).
- **Realidad:** la spec 0001-i decidió explícitamente que una sesión `in_progress` **nunca se
  cierra sola** — solo un humano apretando "Finalizar" la mueve a estado terminal. Si eso no pasa
  el mismo día, la fila sigue en `in_progress` indefinidamente, con `scheduled_at` de un día
  pasado. Cualquier query acotada a "hoy" deja de verla al día siguiente — pero
  `trg_prevent_concurrent_in_progress` (`supabase/migrations/20260804120000_...`) no tiene ningún
  filtro de fecha: sigue bloqueando `startClass()` para ese instructor sin importar cuántos días
  hayan pasado. Resultado antes de `fix-131-m`: la sesión colgada se volvía invisible en todo el
  dashboard justo cuando más hacía falta verla, y el instructor quedaba bloqueado sin ninguna
  pista visual de la causa. Corregido parcialmente en `fix-131-m` (solo para el panel
  `app-live-classes-panel` del dashboard, vía una segunda query sin límite inferior de fecha +
  marca visual "Día Anterior") — **`instructor-clases.facade.ts` y
  `asistencia-clase-b.facade.ts::fetchPracticas` siguen con el mismo gap sin resolver.**
  **Lección:** cualquier vista nueva (o ya existente) que liste sesiones `in_progress` filtrando
  por fecha de hoy necesita el mismo tratamiento — traer también `in_progress` con
  `scheduled_at` anterior, sin límite inferior, y marcarlas visualmente distintas de una clase de
  hoy a la misma hora con el mismo alumno.
- **Fuente:** `specs/fixes/fix-131-m-live-classes-panel-sesiones-dia-anterior`,
  `specs/specs/0001-i-ciclo-vida-clase-exclusion-cierre`

### DG-055 — El panel "Clases Actuales" del Dashboard alimenta `AsistenciaClaseBFacade.selectPractica()` con una fila recortada — un campo ausente ahí rompe silenciosamente lógica que asume el modelo completo
- **Trampa:** agregar/leer un campo nuevo en `ClasePracticaRow` (el modelo completo que usan las
  páginas dedicadas `admin-asistencia`/`secretaria-asistencia`) y asumir que también está
  disponible cuando la misma acción (`startClass`/`finishClass` sobre `AsistenciaClaseBFacade`)
  se dispara desde el panel "Clases Actuales" del Dashboard.
- **Realidad:** `dashboard.component.ts::handleLiveClassAction()` construye la fila con
  `resolveLiveClassActionPlan()` (`core/utils/live-class-action.utils.ts`), que arma un
  `ClasePracticaActionRow` — un **subconjunto** de `ClasePracticaRow` mapeado desde
  `LiveClassModel`/`DashboardFacade.mapPracticaRow()`, con su propio `PRACTICA_SELECT` de
  Supabase. Y la llamada es `selectPractica(plan.row as any)`: el cast se salta el chequeo de
  tipos, así que un campo que falte en `ClasePracticaActionRow` no produce ningún error de
  compilación — solo un `undefined` silencioso en runtime. Pasó con `vehicleId`: `finishClass()`
  lee `this._selectedPractica()?.vehicleId` para propagar `km_end` a `vehicles.current_km`; al
  ser `undefined` el `if (vehicleId)` nunca entra y el update se salta sin error ni toast — la
  sesión queda con `km_start`/`km_end` correctos pero el vehículo se queda con su `current_km`
  desactualizado. El mismo hueco existía para `vehicleCurrentKm` (precarga del odómetro al
  iniciar) y `branchId` (poblar el selector de vehículo).
- **Lección:** cualquier campo que una acción sobre `AsistenciaClaseBFacade` necesite leer de
  `_selectedPractica()` debe existir en **ambos** orígenes — `ClasePracticaRow` (Asistencia) y
  `ClasePracticaActionRow` (Dashboard) — y el `PRACTICA_SELECT`/`mapPracticaRow()` de
  `DashboardFacade` debe traerlo desde Supabase. Verificar los dos flujos, no solo el de
  Asistencia (que suele ser el que se prueba primero).
- **Fuente:** `specs/fixes/fix-133-m-vehicleid-faltante-dashboard-km`

---

### DG-056 — `payments.status = 'pending'` no es "un pago que está por cobrarse", es un placeholder con $0 recibido
- **Trampa:** asumir que una fila de `payments` con `status = 'pending'` representa una
  transacción real en curso (ej. cheque a fecha, transferencia por confirmar) y listarla en
  cualquier vista tipo "Pagos recientes"/historial de cobros mostrando su `total_amount` como
  si fuera dinero recibido.
- **Realidad:** la única forma de producir `payments.status = 'pending'` es la RPC
  `confirm_enrollment_with_payment` cuando `p_payment_method = 'pendiente'`
  (`20260618130000_rpc_confirm_enrollment_with_payment.sql:59-98`) — el flujo de "matricular
  ahora, cobrar después". Esa fila se inserta con `cash_amount`/`transfer_amount`/`card_amount`
  en **$0** y `payment_date = NULL`; existe solo para dejar registrada la deuda junto al
  enrollment. La inserción manual desde la UI (`registrarNuevoPago()` en `pagos.facade.ts`)
  siempre usa `status: 'paid'` — no hay ningún camino que inserte un pago parcial real con
  `status = 'pending'`.
- **Lección:** cualquier vista que liste `payments` como "dinero cobrado" debe excluir
  `status = 'pending'` (`.neq('status', 'pending')`, ver `fetchPagosRecientes()` en
  `pagos.facade.ts`). El alumno con esa matrícula ya aparece en la lista de deudores vía
  `fetchAlumnosConDeuda()` (`enrollments.pending_balance > 0`) — no hace falta duplicar la
  señal desde `payments`. Si en el futuro se agrega un flujo real de pago parcial/en proceso
  distinto al placeholder de matrícula, debe usar otro valor de `status` para no romper este
  filtro.
- **Fuente:** `specs/fixes/fix-135-m-excluir-matriculas-pago-pendiente-de-pagos-recientes`

### DG-057 — El `end_date` de una promoción profesional puede calcularse sin feriados reales sin que nadie lo note, si `apis.digital.gob.cl` es inalcanzable
- **Trampa:** confiar en que el `end_date` mostrado/persistido por `PromocionesFacade` siempre
  refleja los feriados reales, porque `computePromotionEndDate()` (AC6, spec 0002-m) está
  correctamente testeado con feriados simulados.
- **Realidad:** `fetchHolidaysForYears()` hace `fetch('https://apis.digital.gob.cl/fl/feriados/
  {año}')` desde el navegador del admin. Si esa llamada falla por cualquier motivo (DNS, red,
  CORS, 5xx), el `catch` devolvía `[]` en silencio — "0 feriados asumidos" — y
  `computePromotionEndDate()` calculaba `end_date = start + 33` como si no hubiera ningún
  feriado en el rango. Reproducido en producción real: `net::ERR_NAME_NOT_RESOLVED` al resolver
  `apis.digital.gob.cl` (confirmado incluso con extensiones de navegador deshabilitadas), lo
  que hizo que una promoción con `start_date=17 ago 2026` mostrara `end_date=19 sept 2026` sin
  considerar que el 18 y 19 de septiembre son feriados (Fiestas Patrias). No hay retry ni
  fuente de feriados alternativa — es una dependencia externa sin fallback de datos, solo con
  fallback de comportamiento (crear igual, sin feriados).
- **Lección:** cuando el `catch` de una llamada a una API externa (feriados, geolocalización,
  cualquier `fetch()` a un dominio fuera del control del proyecto) retorna un valor "vacío" que
  la lógica de negocio interpreta como una respuesta válida (0 resultados = "confirmado que no
  hay feriados", en vez de "no se pudo confirmar"), ese `catch` debe exponer una señal de fallo
  explícita al consumidor — no solo devolver el valor vacío. Quien renderiza el resultado
  (drawer, reporte, lo que sea) necesita poder distinguir "sin feriados, confirmado" de "no se
  pudo verificar" para avisar al usuario en el segundo caso, en vez de mostrar un dato
  incompleto como si fuera definitivo. `fetchHolidaysForYears()` en `PromocionesFacade` es el
  ejemplo concreto ya corregido — ver la fuente para el patrón exacto (signal
  `holidaysCheckFailed` + advertencia visible en el drawer).
- **Actualización (fix-139-m):** además de la señal visible, se agregó una fuente de respaldo
  real (`api.boostr.cl`) para cuando `apis.digital.gob.cl` falla — verificado que hoy responde
  correctamente para 2026 (incluyendo el 18/19 de septiembre). Cuando una API pública externa
  queda inalcanzable, antes de conformarse con solo avisar del fallo, vale la pena verificar si
  existe una fuente alternativa que cubra el mismo dato — para feriados chilenos, `date.nager.at`
  es una segunda alternativa ya verificada como reachable pero no usada (queda como opción si
  `boostr` también falla algún día). El fallback se portó 1:1 a
  `supabase/functions/_shared/holidays.ts` (usado por el cron `auto-create-next-promotions`).
  Verificado directamente en el runtime del cron (no solo en el navegador): sin invocar la
  Edge Function completa (el colchón local ya estaba lleno de una QA anterior, así que nunca
  llega a llamar `fetchHolidaysForYears`), se montó un servicio Deno efímero dentro del mismo
  contenedor `supabase_edge_runtime` replicando únicamente las dos llamadas `fetch()` — mismo
  resultado que en el navegador: `apis.digital.gob.cl` falla por DNS, `api.boostr.cl` responde
  200 con los feriados reales. **Lección extra:** cuando Deno/Edge Functions no se pueden
  invocar de punta a punta en el entorno de desarrollo, `docker exec` dentro del contenedor del
  runtime (si corre localmente vía `supabase start`) permite probar llamadas de red aisladas
  con el mismo binario y la misma red que usará el cron en producción — más confiable que
  asumir que el comportamiento del navegador se traslada 1:1 a otro runtime.
- **Fuente:** `specs/fixes/fix-138-m-fallback-silencioso-fetch-feriados`,
  `specs/fixes/fix-139-m-fallback-fuente-feriados-alternativa`

### DG-058 — Una función `SECURITY DEFINER` sin `SET search_path` propio hereda el search_path del caller que la invoca anidada, no el de quien finalmente disparó la transacción
- **Trampa:** asumir que porque `log_change()` (trigger de auditoría) es `SECURITY DEFINER` y
  usa `to_jsonb(NEW)`/`to_jsonb(OLD)` con nombres de tabla sin calificar (`FROM students s JOIN
  users u ...`), va a resolver esas tablas igual sin importar desde dónde se dispare. `SECURITY
  DEFINER` solo cambia el ROL con el que corre la función — el `search_path` NO viaja con el
  rol, viaja con la sesión/función que lo declaró, salvo que la función tenga su propio `SET
  search_path`.
- **Realidad:** `recalculate_enrollment_balance()` (trigger `trg_update_balance` AFTER en
  `payments`, `20260301000008`) declara `SET search_path = ''`. Cuando ese trigger hace `UPDATE
  enrollments`, dispara `trg_audit_enrollments` → `log_change()` **anidado dentro de la
  ejecución de `recalculate_enrollment_balance()`** — y como `log_change()` no tenía su propio
  `SET search_path` (regresión de fix-097-m/`20260801120000`, que reescribió la función con ~15
  ramas de tablas sin calificar y sin recuperar el `SET search_path=''` + `public.` que sí tenía
  la versión original de `20260323100000`), hereda el search_path vacío del caller. Cualquier
  tabla sin `public.` explícito rompe: `WARNING: audit_log error: relation "students" does not
  exist"`. La entrada de auditoría de ESE `UPDATE enrollments` (el recálculo de saldo) se pierde
  en silencio — el `EXCEPTION WHEN OTHERS` de `log_change()` solo emite el `WARNING`, nunca
  revierte la transacción principal ni deja rastro visible para el usuario. Reproducido y
  confirmado contra Supabase local: `confirm_enrollment_with_payment()` → INSERT `payments` →
  `trg_update_balance` → `recalculate_enrollment_balance()` → `UPDATE enrollments` →
  `log_change()` anidado → warning + audit_log sin esa fila. Ocurre en **cualquier** pago que
  dispare un recálculo de saldo, no es específico de ningún flujo particular (matrícula de
  refuerzo, matrícula regular, da igual).
- **Lección:** al escribir o revisar una función `SECURITY DEFINER` que hace queries a tablas
  sin calificar, no basta con verificarla invocándola directo — hay que verificar también los
  casos donde otra función `SECURITY DEFINER` con `SET search_path` restringido (`''` o
  cualquier valor sin `public`) la dispara ANIDADA (vía trigger, vía llamada directa). El bug es
  invisible probando la función aislada porque el search_path por defecto de la sesión sí
  incluye `public`. Todo trigger de auditoría/logging genérico que se dispara sobre múltiples
  tablas (como `log_change()`) es especialmente vulnerable porque casi seguro alguna de esas
  tablas también tiene otro trigger `SECURITY DEFINER` con `search_path` restringido delante o
  detrás en el mismo evento. Fix aplicado: `SET search_path = public, pg_temp` explícito en
  `log_change()` y `audit_resolve_display_value()` — el `SET` de una función crea su propio
  contexto de search_path para ESA invocación puntual, sin importar el del caller.
- **Fuente:** `specs/fixes/fix-145-m-bugs-audit-log-qa-0006-m`

### DG-059 — Un trigger `AFTER UPDATE` no sabe quién hizo el UPDATE a menos que lo pidas explícitamente con `auth_user_role()`/`auth.uid()`
- **Trampa:** asumir que un trigger de notificación instalado para un flujo de un solo rol
  (ej. "el instructor cierra la clase") solo se dispara desde ese rol, porque el nombre de la
  notificación lo dice ("Clase cerrada **por el instructor**"). Un trigger `AFTER UPDATE OF
  status ON class_b_sessions` se dispara igual sin importar qué código/rol ejecutó el
  `UPDATE` — y en este proyecto varios facades comparten la misma transición de estado
  (`AsistenciaClaseBFacade.finalizarClase()`, usado tanto por `secretaria-asistencia` como por
  `admin-asistencia`, deja `class_b_sessions.status='completed'` igual que
  `InstructorClasesFacade.finishClass()`).
- **Realidad:** `notify_class_b_completed()` (`20260801100000`) notificaba a secretaría con
  texto fijo "completada por el instructor" incluso cuando quien cerraba la clase era la propia
  secretaría o un admin — autonotificándose con un mensaje falso. `SECURITY DEFINER` no ayuda
  acá: solo eleva el rol de EJECUCIÓN de la función, no oculta quién disparó la transacción.
  `auth_user_role()`/`auth.uid()` siguen leyendo el JWT de la sesión que originó el `UPDATE`
  (viaja con la request, no con el rol de ejecución), así que sirven dentro del trigger para
  distinguir el actor real. Fix: filtrar el bloque de notificación a secretaría con
  `WHERE public.auth_user_role() = 'instructor'`.
- **Lección:** cualquier trigger de notificación que redacte el mensaje asumiendo un actor fijo
  (rol único) debe verificar primero si la tabla/columna que dispara el trigger puede ser
  mutada por más de un flujo/rol — buscar todos los facades que hacen `UPDATE` de esa columna,
  no solo el que motivó el trigger originalmente. Si hay más de uno, condicionar con
  `auth_user_role()` en vez de hardcodear el rol en el texto.
- **Fuente:** `specs/fixes/fix-148-m-notif-secretaria-cierre-clase-b`

### DG-060 — Una VIEW que filtra slots ocupados "al leer" no es una garantía de integridad — solo un trigger a nivel de escritura lo es
- **Trampa:** asumir que `v_class_b_schedule_availability` excluyendo horarios ocupados
  (`cb.status NOT IN ('cancelled')` + solape de `scheduled_at`/`duration_min`,
  `20260307130000_fix_schedule_availability_tz_and_constraints.sql:104-126`) es suficiente
  protección contra doble-agendar el mismo instructor. La vista solo filtra lo que el cliente
  llega a **leer** antes de escribir — no existía ninguna restricción de integridad
  (`UNIQUE`/`EXCLUDE`/trigger) sobre `class_b_sessions(instructor_id, scheduled_at)` a nivel de
  `INSERT`/`UPDATE`. Dos secretarias agendando casi simultáneo (o cualquier insert que se salte
  la vista, manual o vía función) podían colar dos sesiones activas con el mismo instructor en
  horarios solapados sin que la BD lo impidiera.
- **Realidad:** el único precedente de exclusión real a nivel de escritura para esta tabla era
  `trg_prevent_concurrent_in_progress` (DG relacionado: exclusión mutua de `status='in_progress'`,
  `20260804120000`), pero cubría solo esa transición puntual, no el caso general de solape de
  horario en cualquier status activo. Fix: `trg_prevent_double_booking`
  (`20260811110000_fix152_class_b_sessions_prevent_double_booking.sql`) replica la misma fórmula
  de solape que usa la vista de disponibilidad, pero como `RAISE EXCEPTION` en un trigger
  `BEFORE INSERT OR UPDATE`.
- **Lección:** cuando una VIEW de "disponibilidad"/"slots libres" es la única lógica que impide
  una colisión de negocio (agenda, reservas, turnos), verificar si existe también una constraint
  o trigger equivalente en la tabla base. Si no existe, la vista es UX (evita que el usuario
  intente algo que fallaría), no una garantía — la carrera sigue abierta a nivel de escritura.
- **Fuente:** `specs/fixes/fix-152-m-doble-agendado-instructor-sin-constraint-bd`

### DG-061 — Un método de Facade con `.upsert(payload, { onConflict: 'col1,col2' })` puede compilar y parecer completo sin que exista la constraint que ese `onConflict` necesita
- **Trampa:** ver `FlotaFacade.upsertVehicleDocument()` ya escrito, con el `onConflict` correcto y
  el nombre de las columnas bien elegido, y asumir que "la lógica de guardado ya está resuelta,
  solo falta conectarle un formulario". El código de la Facade es sintácticamente correcto y no
  tira ningún error hasta que se ejecuta contra Postgres real.
- **Realidad:** `vehicle_documents` nunca tuvo `UNIQUE(vehicle_id, type)` — ni constraint ni
  exclusion index. Postgres exige que el target de `ON CONFLICT` coincida con una constraint real;
  sin ella, **todo** `upsert()` fallaba con "there is no unique or exclusion constraint matching
  the ON CONFLICT specification". Como ningún componente en `src/` llamaba a este método (fix-153-m
  root cause), el bug nunca se manifestó — quedó como lógica huérfana "correcta en apariencia"
  durante meses. Se detectó recién al construir el formulario que finalmente lo invoca.
- **Lección:** antes de conectar un método de Facade que hace `.upsert(..., { onConflict: 'a,b' })`
  (o `.upsert()` a secas, que asume PK), verificar contra el schema real (`indices/DATABASE.md` o
  `pg_constraint`) que esa combinación de columnas tiene una constraint `UNIQUE`/`EXCLUDE`
  efectivamente creada — no asumirlo por el nombre de las columnas o porque el código "se ve bien".
  Un método de Facade sin ningún caller no ha sido probado contra la BD real, sin importar cuánto
  tiempo lleve en el repo.
- **Fuente:** `specs/fixes/fix-153-m-vehiculo-documentos-sin-ui-de-carga`

### DG-062 — `supabase.functions.invoke()` NO rechaza la promesa en respuestas no-2xx: un `.catch()` fire-and-forget nunca se entera de un fallo de la Edge Function
- **Trampa:** ver un patrón como `this.supabase.client.functions.invoke('x', {...}).catch(err => console.error(...))` tras una acción que ya se dio por exitosa (ej. confirmar una matrícula) y asumir que cualquier fallo de la Edge Function, aunque no bloquee el flujo principal, al menos queda logueado. `enrollment.facade.ts` usaba exactamente este patrón para invocar `activate-student-account` tras confirmar la matrícula.
- **Realidad:** `functions.invoke()` de `supabase-js` v2 resuelve `{ data, error }` para respuestas HTTP no-2xx — no lanza excepción. Un `.catch()` solo atrapa fallos de red/transporte (fetch que nunca llega a responder), nunca un `errorResponse(..., 4xx/5xx)` devuelto explícitamente por la función. Si `activate-student-account` rechazaba la invitación (ej. `inviteUserByEmail` de Supabase Auth validando el formato de un email mal escrito), el `.catch()` nunca se disparaba — el fallo no llegaba ni siquiera a la consola del navegador. El alumno quedaba con `users.supabase_uid = NULL` para siempre, sin ningún rastro de que algo había fallado, hasta que alguien intentaba editar su perfil y `update-student-profile` exigía ese `supabase_uid` inexistente.
- **Lección:** cualquier llamada fire-and-forget a `functions.invoke()` debe revisar el campo `error` de la respuesta resuelta (`.then(({ error }) => { if (error) {...} })`), no solo encadenar `.catch()`. Si la acción es best-effort (no debe bloquear el flujo principal) pero su fallo deja al sistema en un estado permanentemente roto (una fila sin vínculo que nadie vuelve a intentar crear), el fallo debe ser visible para el staff (toast/notificación), no solo loguearse — de lo contrario es indetectable hasta que otra pantalla, sin relación aparente, choca con la consecuencia.
- **Fuente:** `specs/fixes/fix-157-m-correo-invalido-bloquea-edicion-perfil-alumno`

### DG-063 — Un trigger sin `SET search_path` propio hereda el `search_path` vacío de la función `SECURITY DEFINER` que lo disparó indirectamente
- **Trampa:** escribir una función de trigger nueva (`CREATE FUNCTION ... RETURNS TRIGGER ... SECURITY DEFINER`) sin `SET search_path = ''` y con tablas sin calificar (`FROM class_b_sessions` en vez de `FROM public.class_b_sessions`), asumiendo que "funciona en mis pruebas manuales" es suficiente. `prevent_double_booking_class_b_sessions()` (fix-152) compilaba, pasaba QA manual (INSERT/UPDATE directos desde una sesión normal con `search_path` default) y solo fallaba cuando lo disparaba **otra** función.
- **Realidad:** `mark_end_of_day_class_b_absences()` es `SECURITY DEFINER` con `SET search_path = ''` (correcto, evita schema hijacking). Su `UPDATE public.class_b_sessions SET status='no_show'` dispara `trg_prevent_double_booking`. Un trigger function sin su propio `SET search_path` no usa el `search_path` de la sesión del cliente ni el default — **hereda el `search_path` vigente en el contexto que lo invocó**, que en este caso era el `''` vacío de la función que hizo el `UPDATE`. Con `search_path=''`, `class_b_sessions` sin prefijo no resuelve → `relation "class_b_sessions" does not exist`, silenciado por el `EXCEPTION WHEN OTHERS` de la función que dispara el barrido nocturno (el cron corría sin marcar nada, sin error visible salvo en logs de Postgres).
- **Lección:** toda función `SECURITY DEFINER` nueva —trigger o no— debe llevar `SET search_path = ''` y calificar cada tabla con `public.` (mismo patrón que `mark_end_of_day_class_b_absences()`/`apply_class_b_absence_penalty()`). No alcanza con probarla invocándola directamente: si la tabla que toca tiene otros triggers, o algún día alguno de ellos corre dentro de una función `SECURITY DEFINER` con `search_path` restringido, el trigger sin su propio `search_path` hereda ese contexto y puede romperse en producción sin que el código haya cambiado. Ya pasó dos veces en este proyecto (fix-145, fix-163) con funciones distintas.
- **Fuente:** `specs/fixes/fix-163-m-cron-no-show-search-path-y-horario-medianoche`

### DG-064 — `AgendaFacade`/`AgendaSlot` es solo la vista de lectura; ningún flujo que agenda de verdad la usa para escribir
- **Trampa:** cuando una pantalla se llama "Agenda" y muestra la disponibilidad de horarios,
  asumir que cualquier otro flujo que también "agenda" (matrícula, reagendamiento,
  reprogramación, wizard público) reutiliza el mismo facade/componente de esa pantalla. Inferir
  eso de una nota sobre un fix a nivel de base de datos (un `trigger`/`constraint` que protege
  todas las escrituras por igual) como si fuera evidencia de que también comparten UI — un
  fix de BD dice cómo se protege la escritura, no qué componente la origina.
- **Realidad:** en este proyecto, `AgendaFacade` solo alimenta la Agenda Semanal de solo
  lectura (el click en un slot abre detalle, no agenda). Cada flujo que sí escribe una clase
  nueva tiene su propio pipeline de facade + componente de grilla:
  nueva matrícula → `EnrollmentFacade` → `AssignmentComponent` → `ScheduleGridComponent`;
  reagendamiento masivo → `AdminAlumnoDetalleFacade` → mismo `AssignmentComponent`/
  `ScheduleGridComponent`; reprogramación individual → mismo `AdminAlumnoDetalleFacade` pero con
  un grid inline propio (no reutiliza `ScheduleGridComponent`); flujo público →
  `PublicEnrollmentFacade`, que ni corre en Angular (delega en una Edge Function). Los 3 flujos
  internos comparten el modelo `TimeSlot`/`ScheduleGrid`
  (`core/models/ui/enrollment-assignment.model.ts`) — un modelo distinto de `AgendaSlot`.
- **Lección:** antes de agregar o propagar un campo nuevo a "el flujo de agendamiento", ubicar
  primero, con grep del código real, cuál facade y qué componente de grilla renderiza cada
  drawer/wizard concreto que se quiere afectar — nunca asumirlo por el nombre de la pantalla ni
  por una nota de otro fix que resolvió el problema a otro nivel (BD vs UI).
- **Fuente:** `specs/fixes/fix-164-m-advertencia-documentos-vehiculo-agendamiento` (el error) +
  `specs/fixes/fix-165-m-advertencia-vehiculo-scheduling-real-flows` (la corrección)
  
  ### DG-065 — `cash_closings` guarda un snapshot congelado; borrar/editar hacia atrás una fila que alimentó ese cálculo no lo recalcula sola
- **Trampa:** al agregar borrado/edición a cualquier tabla que aporta dinero al día (`payments`,
  `special_service_sales`, `expenses`, anticipos, etc.), asumir que como `cash_closings` "muestra
  los totales del día" esos totales se recalculan cada vez que se consulta la pantalla — y que
  por lo tanto un DELETE/UPDATE sobre una fila vieja es seguro sin ninguna verificación adicional.
- **Realidad:** `cash_closings.total_income`/`total_expenses`/`balance`/`payments_count` son
  columnas `INTEGER` calculadas y **grabadas una sola vez**, al momento del cierre
  (`closed=true`). No hay trigger ni vista que las recalcule si cambian las filas de origen.
  Borrar o editar hacia atrás una venta/pago cuyo `sale_date`/`payment_date` cae en un día con
  `cash_closings.closed=true` para esa `branch_id` deja el número de esa cuadratura pasada
  desincronizado del detalle real, sin ningún error visible — el descuadre queda invisible hasta
  que alguien audita ese día puntual.
- **Lección:** antes de exponer un borrado/edición sobre cualquier tabla cuyos montos alimentan
  `cash_closings`, verificar primero si existe una fila `cash_closings` con `closed=true` para
  `(branch_id, fecha)` de ese registro — igual candado que resolvió `ASG-b-037` y que replicó
  `fix-022-i` para `special_service_sales`. Sin ese candado, cada tabla financiera nueva
  reintroduce el mismo agujero de trazabilidad por separado.
- **Fuente:** `specs/fixes/fix-022-i-borrar-servicio-especial` (ASG-b-050, mismo criterio que
  ASG-b-037)

### DG-066 — Un catálogo con columna `active` y una FK entrante sin `ON DELETE CASCADE` necesita capturar `error.code === '23503'`, no solo intentar el DELETE
- **Trampa:** al exponer un botón de borrar sobre una tabla "catálogo" (`service_catalog`,
  `courses`, cualquier tabla con una columna `active`/`is_active` booleana), asumir que un
  simple `DELETE` alcanza porque la policy RLS ya lo permite — sin considerar qué pasa si otra
  tabla referencia esa fila.
- **Realidad:** una FK entrante sin `ON DELETE CASCADE` (default `NO ACTION`) rechaza el DELETE
  con una violación de FK en cuanto existe al menos una fila que la referencia. PostgREST
  traduce eso a HTTP `409` y `error.code = '23503'` en la respuesta de `supabase-js`. Sin
  capturar ese código específico, el usuario ve un error crudo de base de datos en vez de una
  acción con sentido de negocio — y si la tabla ya tiene una columna `active`/`is_active`
  pensada para "dejar de ofrecer sin borrar", esa columna queda sin ningún botón que la use.
- **Regla:** cuando se exponga un borrado sobre cualquier catálogo con una columna
  `active`/`is_active`, el criterio de aplicabilidad es: verificar primero si alguna otra tabla
  lo referencia por FK sin `CASCADE` (`grep` de `REFERENCES <tabla>(id)` en
  `supabase/migrations/`). Si existe esa referencia, intentar el DELETE duro primero y, si
  Postgres devuelve `23503`, hacer fallback automático a `UPDATE active = false` en vez de
  mostrar el error crudo. No aplica a tablas sin ninguna FK entrante — ahí el DELETE simple
  basta.
- **Fuente:** `specs/fixes/fix-022-i-borrar-servicio-especial`

### DG-067 — Supabase Auth solo tiene UN template de correo "invite" para todo el proyecto — no es por rol
- **Trampa:** asumir que `auth.admin.inviteUserByEmail()` se puede reutilizar para invitar a un
  rol distinto (instructor, secretaria) solo pasando otro valor en `data: { role: ... }`, y que
  el correo se adaptará a ese rol. El template HTML que Supabase Auth dispara automáticamente es
  **uno solo por proyecto** (`supabase/email-templates/invite-user.html`), compartido por
  cualquier llamada a `inviteUserByEmail`, sin importar los metadatos que se le pasen.
- **Realidad:** ese template está hardcodeado con copy y variables de branding exclusivas del
  flujo de alumno (`public-enrollment` → `inviteStudentToAuth`): "tu proceso de matrícula...",
  feature strip "Mi horario/Mi progreso/Mis pagos", y variables (`schoolName`, `brandColor`,
  `gradientHero`, etc.) que solo esa función arma leyendo `website_config` por sede. Si otra
  Edge Function llama `inviteUserByEmail` sin pasar esas mismas variables, el correo sale con
  colores rotos (variables vacías) y texto que no corresponde al rol invitado.
- **Regla de aplicabilidad:** cuando el rol a invitar sea el mismo que ya usa
  `inviteUserByEmail` en algún flujo existente del proyecto (hoy: alumno), reutilizar esa
  llamada tal cual — comparte template y variables sin conflicto. Cuando sea un rol nuevo o
  distinto (instructor, secretaria, cualquier alta futura), NO llamar `inviteUserByEmail` —
  usar en su lugar `auth.admin.generateLink({ type: 'invite', email, options })`, que crea la
  cuenta y devuelve `properties.action_link` **sin enviar correo**, y despachar el correo uno
  mismo por SMTP propio (patrón ya existente en `send-zoom-email`/`send-certificate-email`:
  `nodemailer` + secrets `SMTP_HOST/PORT/USER/PASS/FROM`), con HTML y copy propios de ese rol.
  Este criterio aplica independientemente de si Supabase agrega soporte multi-template a
  futuro: el punto de fondo es que un solo template compartido no escala a N roles con copy
  distinto.
- **Fuente:** `specs/fixes/fix-167-m-instructor-invite-correo-set-password`

### DG-068 — `auth.admin.generateLink({ type: 'invite' })` falla si el usuario de Auth YA existe
- **Trampa:** reutilizar `type: 'invite'` para "reenviar" una invitación a un usuario que ya
  tiene cuenta de Auth (creada en un paso anterior, ej. `create-instructor`). GoTrue rechaza
  `invite` para un email ya registrado con un error que contiene "already registered" — el
  mismo texto que `create-instructor` ya intercepta para su propio caso de alta.
- **Realidad:** `type: 'invite'` es exclusivamente para **crear** el usuario de Auth. Un
  "reenvío" (el usuario de Auth ya existe, solo no activó su contraseña — `first_login=true`)
  necesita `type: 'magiclink'`, que sí genera un link válido para un usuario existente sin
  intentar recrearlo. El resto del patrón (generar link sin enviar correo nativo + despachar
  correo propio vía SMTP con el mismo copy/template) es igual al de la creación.
- **Regla de aplicabilidad:** cualquier Edge Function de "reenviar invitación" para un rol que
  ya usa `generateLink({ type: 'invite' })` en su función de creación debe usar
  `type: 'magiclink'`, no `'invite'`, para el reenvío.
- **Fuente:** `specs/fixes/fix-168-m-reenviar-invitacion-instructor`

### DG-069 — Una fila de `public.users` insertada fuera del flujo de creación normal (seed, SQL directo) puede no tener `supabase_uid`, aunque el flujo "oficial" lo garantice
- **Trampa:** asumir que una garantía que da la Edge Function de creación (ej.
  `create-instructor` siempre crea la cuenta de Auth ANTES de insertar la fila, con
  rollback en cascada si algo falla — ver DG-066) aplica a **todas** las filas de esa
  tabla, sin excepción. Un fix que solo contempla el estado "reenvío" (`supabase_uid`
  seteado, `first_login=true`) y rechaza cualquier otro caso con un error genérico
  ("ya activó su cuenta") rompe silenciosamente para una fila insertada por fuera de ese
  camino.
- **Realidad:** cualquier tabla con filas que puedan originarse en un seed, una migración
  de datos, o un INSERT manual vía SQL Editor no tiene esa garantía — la garantía es del
  código de la Edge Function, no de la tabla ni de una constraint de BD. Caso real:
  instructor insertado vía seed con `supabase_uid IS NULL` rompió `activate-instructor-
  account`, que asumía (incorrectamente) que todo instructor tiene `supabase_uid`.
- **Regla de aplicabilidad:** cuando una función de "activar/reenviar cuenta" distinga
  entre "primera vez" y "reenvío" usando una sola columna (`first_login` o similar), usar
  la combinación de **ambas** señales (`supabase_uid` presente Y estado de activación),
  nunca una sola — y tratar la ausencia de `supabase_uid` como "primera vez", no como
  error. Ver el patrón correcto ya usado en `activate-student-account`.
- **Fuente:** `specs/fixes/fix-169-m-reenviar-invitacion-instructor-sin-cuenta-auth`

### DG-070 — Un dato "opcional" capturado en un formulario se pierde silenciosamente si su persistencia vive dentro de una función distinta a la que siempre se ejecuta
- **Trampa:** en un flujo con dos posibles submits (uno "esencial" que siempre corre, otro
  "opcional" que corre condicionalmente), colocar la persistencia de un campo opcional
  (firmas, observaciones) **solo** dentro de la función condicional. Si el usuario llena
  el campo opcional pero no dispara la condición (ej. no seleccionó una nota), el dato
  capturado en el formulario nunca llega a la BD — sin error visible, sin log, sin toast.
  El componente cree que "guardó todo" porque el submit esencial sí tuvo éxito.
- **Realidad:** caso real en `InstructorClasesFacade` — `finishClass()` (siempre corre al
  cerrar una clase) no recibía `notes`/firmas; solo `saveEvaluation()` (condicional a
  `selectedGrade() !== null`) las persistía. Un instructor que firmaba pero no calificaba
  perdía la firma sin saberlo.
- **Regla de aplicabilidad:** cuando un campo se marque como "opcional" en la UI, su
  persistencia debe vivir en la función que **siempre** se ejecuta al completar el flujo,
  nunca en una función condicional/secundaria — independiente de si ese campo también se
  usa en otro flujo relacionado.
- **Fuente:** `specs/fixes/fix-175-m-instructor-clase-cierre-simplificado`

### DG-071 — `new Date().toISOString().split('T')[0]` como límite de "hoy" en una query pierde filas cerca de la medianoche en Chile
- **Trampa:** calcular el límite de fecha de un filtro `.gte`/`.lt` sobre una columna
  `timestamptz` con `new Date().toISOString().split('T')[0]` + sufijo `+00:00`. Parece
  "la fecha de hoy", pero es la fecha de hoy **en UTC**, no en Santiago.
- **Realidad:** Chile está detrás de UTC (UTC-3/-4). El reloj UTC cruza medianoche
  mientras en Chile sigue siendo "hoy" — desde ~21:00 hora Chile en adelante, la fecha
  UTC ya es "mañana". Cualquier filtro `[todayUTC 00:00, todayUTC 23:59]` construido así
  deja fuera, en ese tramo horario, las filas cuyo timestamp real corresponde al día
  chileno vigente. Caso real: `InstructorClasesFacade.fetchTodayClasses()` hacía
  desaparecer "Mis Clases de Hoy" (incluida una clase recién iniciada) pasadas las 21:00.
  Ya había pasado antes con pagos nocturnos, resuelto con `getChileDateTimeRange()`
  (`core/utils/date.utils.ts`) — este fix repitió el mismo error en un facade distinto.
- **Regla de aplicabilidad:** todo filtro de "hoy"/"este rango de días" sobre una columna
  `timestamptz` debe construirse con `todayIso()` + `getChileDateTimeRange()` (o el
  offset explícito de Santiago), nunca con `toISOString()` crudo — sin excepción, incluso
  si el bug "solo" se manifiesta de noche.
- **Fuente:** `specs/fixes/fix-176-m-dashboard-instructor-clases-activas-timezone`

### DG-072 — Un `storage.upload(..., { upsert: true })` necesita policy SELECT además de INSERT/UPDATE, o sigue dando 403 aunque ambas estén bien
- **Trampa:** dar de alta las policies `FOR INSERT WITH CHECK` y `FOR UPDATE USING/WITH CHECK`
  para un rol nuevo sobre un bucket de Storage y asumir que con eso el `upload(..., { upsert:
  true })` va a funcionar.
- **Realidad:** el cliente de Storage con `upsert:true` ejecuta
  `INSERT INTO storage.objects (...) VALUES (...) ON CONFLICT (name, bucket_id) DO UPDATE
  SET ... RETURNING *`. Ese `RETURNING *` necesita que la fila resultante sea visible bajo
  la policy `FOR SELECT` del rol — si no existe ninguna (rol nunca tuvo lectura del bucket),
  el Storage API sigue reportando el mismo error genérico `"new row violates row-level
  security policy"` **aunque el INSERT/UPDATE ya estén correctamente permitidos** y
  verificados uno por uno. El error no distingue "tu WITH CHECK falló" de "no puedes leer
  el resultado" — hay que revisar las 3 (INSERT, UPDATE, SELECT) como un set, no solo las
  dos que intuitivamente hacen falta para "escribir".
- **Regla de aplicabilidad:** al dar acceso de escritura a un rol nuevo sobre un bucket
  existente vía `upload(..., { upsert: true })`, agregar SIEMPRE una policy `FOR SELECT`
  con el mismo alcance — no basta con INSERT+UPDATE.
- **Fuente:** `specs/fixes/fix-188-m-instructor-firma-rls-storage-documents` (v3)

### DG-073 — `jsonb_set` sobre una ruta anidada cuyo padre no existe no crea nada: devuelve el JSONB intacto, en silencio
- **Trampa:** escribir `jsonb_set(config, '{contact,email}', ...)` asumiendo que
  `create_if_missing = true` (el default) va a crear también el objeto `contact` si falta.
  El `UPDATE` reporta filas afectadas y no lanza ningún error.
- **Realidad:** `create_if_missing` solo crea **la última clave del path**. Si algún nivel
  intermedio no existe, la función devuelve el JSONB **sin modificar** y el `UPDATE` escribe
  el mismo valor que ya había. Queda como filas actualizadas y cero cambios reales. El
  peligro se multiplica cuando la verificación posterior está escrita **en negativo**
  ("que no queden valores placeholder"): un no-op pasa esa comprobación, porque tampoco
  encuentra el valor viejo — no hay ninguna señal de que el update no hizo nada.
- **Regla de aplicabilidad:** toda migración que modifique una clave anidada de una columna
  JSONB debe verificarse **en positivo** — afirmar que el valor esperado está presente, no
  solo que el valor incorrecto desapareció. Cuando el JSONB deba coincidir con otra tabla,
  hacer la aserción por `JOIN` contra esa tabla, que además impide que vuelvan a divergir.
- **Fuente:** `specs/fixes/fix-190-m-datos-contacto-inventados-sedes-y-sitios`

### DG-074 — Los archivos de `supabase/migrations/` NO son fuente de verdad de lo que hay en producción
- **Trampa:** auditar el estado de la base leyendo las migraciones del repo y concluir que
  producción está como dicen esos archivos. En este proyecto hay al menos dos casos
  confirmados de configuración cambiada **a mano en el panel de Supabase**, sin migración que
  la respalde: las direcciones de `branches` (reales en producción, placeholder en el seed) y
  cambios de bucket cuya intención el archivo de creación no refleja.
- **Realidad:** el repo y producción divergen en ambos sentidos. Además, corregir esa
  divergencia editando un archivo **ya aplicado** —en vez de agregar una migración nueva—
  produce el problema inverso: un archivo cuyo contenido nunca corrió tal cual en ningún
  entorno, y comentarios que citan migraciones posteriores a su propia fecha. Leerlo en orden
  cronológico lleva a una conclusión falsa. Caso concreto: `20260307160000` y `20260310130000`
  crean el bucket `documents` con `public = true`, y `20260413000001` lo cierra — quien lea
  solo los dos primeros concluye que hay datos sensibles expuestos, y se equivoca.
- **Regla de aplicabilidad:** antes de afirmar cómo está configurado algo en producción
  (buckets, seed, flags, datos de configuración), **confirmarlo contra la base o el panel**,
  no contra el archivo — y buscar siempre migraciones **posteriores** que toquen el mismo
  objeto (`UPDATE`, no solo `INSERT`/`CREATE`) antes de concluir. Para corregir, agregar una
  migración nueva; nunca editar una ya aplicada.
- **Fuente:** `specs/fixes/fix-190-m-datos-contacto-inventados-sedes-y-sitios` · auditoría
  `.compliance/` corrida 1

### DG-075 — El reagendamiento RECICLA la fila de `class_b_sessions`: la asistencia vieja sigue ahí
- **Trampa:** asumir que una fila de `class_b_practice_attendance` describe el estado actual de
  su sesión. `AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()` (RF-053) **no crea una
  sesión nueva**: recicla la misma fila de `class_b_sessions` (nuevo `scheduled_at`, `status`
  vuelve a `'scheduled'`) y conserva a propósito la asistencia de la ocurrencia anterior para
  auditoría. Como la tabla tiene `UNIQUE (class_b_session_id, student_id)`, esa fila vieja
  ocupa el lugar de la asistencia de la ocurrencia nueva.
- **Realidad:** hasta fix-191-m esa fila no tenía marca de vigencia, así que era indistinguible
  del estado actual. Cada consumidor que derivaba estado desde la asistencia mostraba "Ausente"
  una clase agendada (Asistencia B, vistas del alumno) mientras los que leen
  `class_b_sessions.status` la mostraban bien — un mismo dato contradiciéndose entre vistas.
  Peor, era silenciosamente destructivo del lado SQL: `apply_class_b_absence_penalty()` volvía a
  detectar el par de faltas consecutivas y cancelaba las clases recién reagendadas, y el
  `ON CONFLICT DO NOTHING` del cron nocturno impedía registrar la inasistencia a la clase nueva.
- **Regla de aplicabilidad:** en cualquier tabla de asistencia/resultado colgada de una entidad
  que se **recicla in-place** (reagendar, reabrir, reintentar), filtrar siempre por la marca de
  vigencia — acá `archived_at IS NULL` — en **todas** las capas: selects de facades, upserts
  (que deben limpiarla) y funciones SQL/cron. Un `soft archive` que no deja marca en la fila no
  es archivar: es dejar el dato viejo haciéndose pasar por vigente. Si aparece un comentario del
  tipo "no hace falta tocar esta tabla porque la vista X deriva de otra columna", verificar
  **todos** los consumidores antes de creerle.
- **Fuente:** `specs/fixes/fix-191-m-reagendadas-asistencia-vieja-no-archivada` ·
  `supabase/migrations/20260817120000_class_b_attendance_archived_at.sql`

### DG-076 — El contrato se genera en el paso 5 del wizard; el pago recién existe después
- **Trampa:** asumir que `enrollments.total_paid`/`pending_balance` ya reflejan lo que el alumno
  va a pagar cuando se genera el PDF del contrato (paso 5 de matrícula, tanto en secretaría como
  en el flujo público). En ese momento el pago real todavía no se registró — solo existe
  `enrollments.payment_mode` ('total' | 'partial' = 50%, elegido en el paso 2). `total_paid` vale
  0 casi siempre ahí, aunque el alumno sí vaya a pagar algo en el acto.
- **Realidad:** un contrato generado antes de pagar mostraba literalmente "paga la cantidad de $0,
  quedando un saldo de $180.000" para una matrícula con `payment_mode = 'partial'` que en realidad
  iba a pagar la mitad en el momento. La cláusula económica del contrato (`buildStructuredPdf`,
  `contract-pdf.ts`) tiene que **prever** el monto según `payment_mode` cuando `total_paid` es 0,
  y solo usar el valor real de la BD cuando ya existe un pago (`total_paid > 0`) — nunca mezclar
  un saldo real de "nada pagado todavía" con un pago previsto de "la mitad", porque no suman el
  precio del curso.
- **Regla de aplicabilidad:** cualquier documento/resumen que se genere **antes** de que un flujo
  de pago haya corrido (contratos, comprobantes, previsualizaciones) no puede leer las columnas de
  saldo como si fueran definitivas — hay que derivar el valor previsto desde la decisión que sí
  existe en ese punto del flujo (acá `payment_mode`), y solo preferir el dato real de BD cuando
  éste ya es distinto de su default vacío.
- **Fuente:** `specs/fixes/fix-192-m-contrato-pdf-no-coincide-con-real` (rondas 10-11)

### DG-077 — `license_validations` se escribe correctamente en la matrícula, pero ninguna vista la leía
- **Trampa:** asumir que porque un alumno convalidado (A2+conv.A4, o A5+conv.A3) se matricula
  bien y aparece con normalidad en todos los listados profesionales, la convalidación es visible
  en algún lado. No lo era: `enrollment.facade.ts` sí escribe la fila en `license_validations`
  (`enrollment_id`, `convalidated_license`) al marcar "convalida simultáneamente" en el paso 1 del
  wizard, pero el `enrollment` en sí queda **idéntico** a uno normal — su `promotion_course_id`
  siempre apunta al curso madre (A2/A5), nunca a `conv_a4`/`conv_a3`. Ningún SELECT de los facades
  de listado (`admin-alumnos-profesional`, `ex-alumnos`, `asistencia-profesional`,
  `evaluaciones-profesional`, `certificacion-profesional`, `archivo-profesional`) hacía join
  contra `license_validations`.
- **Realidad:** la única mención en pantalla era un toast efímero en el paso 5 del wizard, en el
  momento mismo de matricular. Después de eso, secretaría/administración no tenía forma de saber
  mirando ninguna vista quién estaba convalidando qué licencia.
- **Regla de aplicabilidad:** cualquier facade nuevo que liste alumnos profesionales por
  `enrollment_id` debe cruzar contra `license_validations` (helper: `fetchConvalidationMap()` en
  `core/utils/convalidation.utils.ts`) si se espera que el operador distinga convalidados —
  no basta con que el dato "exista en BD"; si ningún join lo trae, es invisible.
- **Fuente:** `specs/fixes/fix-195-m-indicador-visual-convalidacion`

### DG-078 — Clase Profesional no tenía NINGÚN mecanismo (manual ni automático) para pasar una matrícula a ex-alumno
- **Trampa:** asumir que porque `marcarComoExAlumno()` existe en `admin-alumno-detalle.facade.ts`
  y `ExAlumnosFacade` ya filtra y separa `class_b`/`professional` en dos listas, ambos grupos
  quedan al día en "Ex-Alumnos" de la misma forma. No era así: el botón "Marcar como Ex-Alumno"
  (fix-012-i) solo se muestra cuando `licenseGroup === 'class_b'`, y su gate
  (`certificateEmailSent`) solo se calcula para ese mismo grupo — para profesional queda
  hardcodeado en `false`, así que ni el botón aparece ni funcionaría si apareciera. Tampoco existía
  ningún equivalente automático: el cron `auto_transition_promotion_status()` (pg_cron diario
  06:00 UTC) transiciona `professional_promotions.status` a `finished` cuando `end_date <
  CURRENT_DATE`, y el trigger `trg_cascade_promotion_status` ya propagaba ese cambio a
  `promotion_courses`, pero ninguno de los dos tocaba `enrollments` — las matrículas quedaban
  `active` para siempre, invisibles en "Ex-Alumnos Profesional" aunque la promoción llevara meses
  terminada.
- **Realidad:** cada feature nueva de Clase Profesional necesita verificarse contra su propio
  Facade/trigger — no puede asumirse que un mecanismo construido para Clase B (botón manual gateado
  por certificado enviado por email) tiene un equivalente para Profesional solo porque ambos
  comparten la tabla `enrollments` y el filtro `status='completed'` en `ExAlumnosFacade`.
- **Regla de aplicabilidad:** al extender un flujo de negocio que ya distingue `class_b` vs
  `professional` en algún punto (gate de UI, columna `license_group`, Facade separado), verificar
  explícitamente que el nuevo comportamiento cubre ambos grupos — o documentar por qué uno queda
  fuera de scope.
- **Fuente:** `specs/fixes/fix-196-m-promocion-finalizada-marca-ex-alumnos`

---

## Convención para agregar una entrada nueva

Un gotcha califica para este índice si cumple **todas**:
1. No es visual/CSS/GSAP/layout (eso va a `indices/ANTI-PATTERNS.md`).
2. Alguien (humano o agente) lo pisaría de nuevo leyendo el código una sola vez, sin conocer el fix.
3. Tiene una causa raíz concreta y verificable (columna, policy, función, regla), no una opinión de diseño.

Formato: `### DG-NNN — <título de 1 línea>` con `**Trampa:**` / `**Realidad:**` / `**Fuente:**` (track SDD o migración). Numeración global, nunca se reutiliza.
