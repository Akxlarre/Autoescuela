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

---

## Convención para agregar una entrada nueva

Un gotcha califica para este índice si cumple **todas**:
1. No es visual/CSS/GSAP/layout (eso va a `indices/ANTI-PATTERNS.md`).
2. Alguien (humano o agente) lo pisaría de nuevo leyendo el código una sola vez, sin conocer el fix.
3. Tiene una causa raíz concreta y verificable (columna, policy, función, regla), no una opinión de diseño.

Formato: `### DG-NNN — <título de 1 línea>` con `**Trampa:**` / `**Realidad:**` / `**Fuente:**` (track SDD o migración). Numeración global, nunca se reutiliza.
