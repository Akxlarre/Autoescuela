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

---

## Convención para agregar una entrada nueva

Un gotcha califica para este índice si cumple **todas**:
1. No es visual/CSS/GSAP/layout (eso va a `indices/ANTI-PATTERNS.md`).
2. Alguien (humano o agente) lo pisaría de nuevo leyendo el código una sola vez, sin conocer el fix.
3. Tiene una causa raíz concreta y verificable (columna, policy, función, regla), no una opinión de diseño.

Formato: `### DG-NNN — <título de 1 línea>` con `**Trampa:**` / `**Realidad:**` / `**Fuente:**` (track SDD o migración). Numeración global, nunca se reutiliza.
