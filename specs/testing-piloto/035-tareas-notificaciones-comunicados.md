# Testing — Tareas/observaciones, notificaciones y comunicados

> **Asignación:** `ASG-i-035` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/tareas` y `/app/secretaria/observaciones` (pantalla "Comunicación", con las
> pestañas "Tareas del equipo" y "Comunicados a alumnos"), campana del topbar + drawer "Historial de
> Notificaciones", `/app/admin/notificaciones`, `/app/secretaria/notificaciones`, Ajustes →
> "Plantillas de Comunicado" (solo admin).
> **Incluye:** tareas/observaciones/consultas (crear, destinatarios, estados, respuestas, eliminar),
> notificaciones in-app (recepción en tiempo real, panel, agrupación, leer, eliminar, historial, deep
> links, todos los productores del `NOTIFICATIONS-MAP`), comunicados a alumnos (compositor,
> consentimiento, plantillas, vista previa, envío inmediato, programado, cancelar, historial, email).
> **No incluye:** las vistas de tareas/notificaciones del instructor y del alumno (bloqueadas en el
> piloto): solo se verifica que el envío hacia ellos no rompa nada. La lógica de cada acción que
> produce una notificación (matrícula, pagos, agenda…) se prueba en su propio checklist; acá solo se
> prueba **la notificación**.
>
> **Código leído para armar esta lista:**
> `features/admin/tareas/admin-tareas.component.ts`,
> `features/secretaria/observaciones/secretaria-observaciones.component.ts`,
> `features/tareas/{task-create-drawer,task-detail-modal}.component.ts`,
> `shared/components/{task-list-content,task-card,task-reply-thread,notifications-panel,announcements-content}/`,
> `features/comunicados/{announcement-composer-drawer,announcement-preview-drawer,template-manager-drawer}.component.ts`,
> `features/notificaciones-historial/notifications-history-drawer.component.ts`,
> `features/{admin,secretaria}/notificaciones/`, `layout/{topbar,app-shell}.component.ts`,
> `core/facades/{tasks,notifications,announcements,notification-templates,consents}.facade.ts`,
> productores en `core/facades/{enrollment,admin-alumno-detalle,asistencia-clase-b,…}.facade.ts`,
> `core/utils/{task,notification,branch-scope,announcement-recipients,announcement-template,recipient-filter}.utils.ts`,
> `core/config/pilot-phase.config.ts`, `app.routes.ts`,
> `supabase/functions/{send-announcement,dispatch-scheduled-announcements}/`, `supabase/functions/_shared/announcement-send.ts`,
> migraciones `20260518000000` (tasks), `20260522000002/3`, `20260526000002/3`, `20260710000100/300`
> (triggers de tareas), `20260710010000` (D3 flota), `20260827000000` (fix-031-i),
> `20260904120000`, `20260909140000`, `20260910120000` (comunicados + pg_cron), `10_rls_policies`.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-035`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S22)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **2 sesiones = 2 navegadores o 2 perfiles distintos.** Dos pestañas del mismo navegador comparten
  la sesión (`localStorage`) y no sirven para probar tiempo real (ver `docs/UAT-PLAN.md` Paquete 7).
- **Comunicados y email:** los alumnos del seed tienen dominio inexistente. Para los casos de email
  real usa alumnos de prueba con **casillas reales tuyas** (D14); nunca mandes un comunicado real a
  un segmento completo del seed (serían cientos de rebotes contra el dominio de la escuela).

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Un comunicado programado a más de 200 alumnos nunca termina.** Cada corrida del cron procesa como máximo 8 lotes de 25 (200) y **siempre empieza desde el destinatario 0**; como los ya enviados se saltan pero igual consumen lote, la corrida siguiente vuelve a recorrer los mismos 200. Los alumnos 201 en adelante no reciben nunca, y el comunicado queda para siempre entre "Enviando ahora" y "Programado". El compositor permite hasta 500. | `dispatch-scheduled-announcements/index.ts:52,159-181`; rescate `:119-125`; tope `core/utils/announcement-recipients.utils.ts:24` |
| S2 | 🟠 Media | **"Comunicado cancelado" aunque no se canceló.** El UPDATE filtra por `status='programado'`; si el cron ya lo tomó, o si una secretaria cancela un comunicado multi-sede de admin (la RLS no la deja), se actualizan 0 filas **sin error** y sale el toast de éxito. El botón Cancelar se muestra en todo "programado", incluidos los de admin. | `announcements.facade.ts:145,479-491`; RLS `20260909140000_announcements_create.sql:86-94` |
| S3 | 🟠 Media | **El envío inmediato depende de que el navegador siga abierto.** La fila se inserta ya como `enviado` (sin `sent_at`) y los lotes los dispara el navegador uno por uno. Si se cierra la pestaña o se corta la red a mitad, quedan alumnos sin correo, el comunicado figura "enviado" sin fecha y nadie lo retoma. Si el primer lote falla, el mensaje dice "El segmento no tiene destinatarios" (falso) y queda una fila huérfana. El cierre (`closeAnnouncement`) no revisa error. | `announcements.facade.ts:299-310,380,519-528` |
| S4 | 🟠 Media | **El segmento no excluye alumnos archivados.** Tanto la vista previa como el servidor resuelven por `enrollments` + `users.active`, sin mirar `students.status = 'archived'` (Papelera). Además, "Estado = Finalizadas" permite mandar comunicados **operativos** (sin consentimiento) a ex-alumnos. Ninguna de las dos consultas tiene límite explícito: sobre ~1000 matrículas PostgREST corta en silencio. | `_shared/announcement-send.ts:144-164`; `announcements.facade.ts:166-176`; `announcement-composer-drawer.component.ts:560-563`; archivo = `admin-alumnos.facade.ts:337` |
| S5 | 🟠 Media | **En el piloto el alumno no tiene cómo darse de baja de los promocionales.** La revocación self-service vive en Ajustes del portal alumno (bloqueado) y el correo promocional no trae ningún enlace o instrucción de baja. Solo un admin puede revocar desde la ficha. | `_shared/announcement-send.ts:85-88`; `ajustes-drawer.component.ts:650-656,672-686`; `pilot-phase.config.ts`; `admin-consentimientos-drawer.component.ts:124,170` |
| S6 | 🟠 Media | **El correo dice "Conductores Chillán" para todas las sedes** (logo "CC", nombre y pie fijos, "© 2026"). Los alumnos de la otra sede reciben un correo con la marca equivocada. | `_shared/announcement-send.ts:76-88` |
| S7 | 🟠 Media | **Notificaciones que nadie verá en el piloto, con toast de éxito.** La mayoría de los productores notifican al alumno o al instructor, cuyos portales están bloqueados. Caso visible: "Recordatorio de asistencia" dice "Recordatorio enviado al alumno", pero el alumno no puede verlo, y además `notifyUsers` nunca lanza error, así que el toast sale igual si el INSERT falló. El compositor promete "por correo y a su portal". | `asistencia-clase-b.facade.ts:332-340`; `notifications.facade.ts:325-329`; `announcement-composer-drawer.component.ts:843` |
| S8 | 🟠 Media | **El admin no ve tareas que le mandan desde otra sede.** Una tarea secretaria→admin queda con la sede de la secretaria, y la lista del admin se filtra por la sede del selector. Con la sede A elegida, lo que le manda la secretaria de B no aparece en "Dirigidas a mí" ni cuenta en Pendientes (sí le llega la notificación). | `tasks.facade.ts:152-171,217` |
| S9 | 🟡 Baja-Media | **Fecha límite corrida un día.** El selector entrega `AAAA-MM-DD`, se guarda en una columna `TIMESTAMPTZ` (medianoche UTC = 21:00 o 20:00 del día anterior en Chile). La tarjeta y el detalle muestran "Vence" con el día anterior, y la tarea sale "Vencida" desde la noche previa. | `task-create-drawer.component.ts:114-119`; `task-card.component.ts:128-133`; `task-detail-modal.component.ts:166-170`; `task.utils.ts:17-20`; migración `20260518000000…:29` |
| S10 | 🟡 Baja-Media | **"Vencida" y el KPI Vencidas cuentan tareas completadas.** `isOverdue` solo mira la fecha, no el estado. | `task.utils.ts:17-20,68`; `tasks.facade.ts:86` |
| S11 | 🟡 Baja-Media | **Abrir una observación la "completa".** Cuando el destinatario la abre, se marca `completed` (no solo "vista"): el emisor recibe "Tarea completada" y el hilo queda cerrado para responder. La spec 0001-b AC5 pedía `seen`. Los errores de ese UPDATE se tragan. | `task-detail-modal.component.ts:179-183`; `tasks.facade.ts:275-294`; trigger `20260710000100…:93-96` |
| S12 | 🟡 Baja | **El picker ofrece instructores "ambas sedes" que la BD rechaza.** fix-030-i deja en la lista a instructores de otra sede con `both_branches`, pero `tasks_insert` exige que el instructor sea de la misma sede → 403 "Error al crear la tarea". | `tasks.facade.ts:375-405` vs `20260522000002…:31-33` |
| S13 | 🟡 Baja | **Admin → secretaria de otra sede podría dar 403.** La tarea toma la sede del admin si la tiene; la policy exige la sede del destinatario. Solo pasa si el usuario admin tiene `branch_id` cargado. | `tasks.facade.ts:217` vs `20260522000002…:19` |
| S14 | 🟡 Baja | **Tiempo real incompleto en tareas.** Una tarea eliminada queda en la lista de la otra persona (el evento UPDATE llega con `deleted_at`, que la RLS ya no deja leer). Las respuestas no tienen canal: con el detalle abierto no aparece la respuesta nueva hasta reabrirlo. El texto de la respuesta se borra antes de saber si se guardó. | `tasks.facade.ts:432-452`; `task-reply-thread.component.ts:117-121`; RLS `20260518000000…` (tasks_select, `deleted_at IS NULL`) |
| S15 | 🟡 Baja | **Deep link a una ruta bloqueada.** La notificación de pre-inscripción lleva a `…/clase-profesional/pre-inscritos` y `…/profesional/pre-inscritos`, bloqueadas en el piloto. Varios tipos no navegan a ningún lado (pago, documento, vencimiento de flota, comunicado, clase B para admin). | `topbar.component.ts:45-70`; `app.routes.ts:132,415` |
| S16 | 🟡 Baja | **Las páginas `/notificaciones` de admin y secretaria son maquetas** ("PLANO · Mockup · Pendiente calcar desde mockup") accesibles por URL. | `admin-notificaciones.component.ts:9-22`; `app.routes.ts:308,564` |
| S17 | 🟡 Baja | **Historial de notificaciones pobre:** no distingue las eliminadas (su comentario dice que sí), no navega al hacer clic, no recibe las nuevas en vivo, "Marcar todo como leído" no lo actualiza y trae máximo 200. El badge cuenta sobre las últimas 50. | `notifications-history-drawer.component.ts:41-70,88-90`; `notifications.facade.ts:116-129,151-156,194-214` |
| S18 | 🟡 Baja | **Historial de comunicados:** clic en una fila no hace nada (el output no está conectado), no se refresca solo (sin Realtime: un "Programado" ya despachado sigue como programado), no recarga al cambiar de sede y no se limpia al cambiar de usuario en el mismo navegador. | `announcements-content.component.ts:53`; `admin-tareas.component.ts:89-95,194-199`; `announcements.facade.ts:55,81-86` |
| S19 | 🟡 Baja | **Compositor de admin:** la sede arranca en "Todas las sedes" aunque el admin tenga una sede elegida arriba; los selects de sede, curso y estado no tienen botón para volver a "Todas/Todos/Cualquiera". | `announcement-composer-drawer.component.ts:130-175,566` |
| S20 | 🟡 Baja | **`send-announcement` no revisa el estado del comunicado:** un admin/secretaria que llame la función a mano con el id de un comunicado **cancelado** o programado lo envía igual. | `send-announcement/index.ts:129-138` |
| S21 | 🟡 Baja | **Cualquier secretaria puede crear notificaciones para cualquier usuario** (de cualquier sede, con cualquier texto) y **el admin puede leer las notificaciones de todos**. | `20260522000003…:6-7`; `10_rls_policies.sql:993-997` |
| S22 | 🟡 Baja | **Errores silenciosos en tareas:** el avance automático de una consulta a "En curso" no revisa error; eliminar una tarea sin permiso devuelve `false` sin ningún mensaje; el botón "Editar" existe pero está siempre deshabilitado. | `tasks.facade.ts:311,322-335`; `task-detail-modal.component.ts:109-114` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar. Anotar acá el nombre/RUT/email real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Admin A (idealmente 2 admins: uno con `branch_id` NULL y otro con sede cargada) | Tareas y notificaciones a admin, S13 | |
| D2 | Secretaria sede A y secretaria sede B | Destinatarios, aislamiento | |
| D3 | Secretaria con `can_access_both_branches = true` | Selector de sede en Comunicación | |
| D4 | Instructor sede A, instructor sede B, instructor sede B con `both_branches = true` | Picker (fix-030-i, S12) | |
| D5 | Un usuario inactivo que tenga tareas pendientes asignadas | Badge "Destinatario inactivo" | |
| D6 | Tarea con fecha límite de ayer, de hoy y de mañana; una completada con fecha pasada | S9, S10 | |
| D7 | > 5 tareas en una pestaña | "Cargar más" en tablet/móvil | |
| D8 | Usuario con > 50 notificaciones no leídas | Badge y panel (S17) | |
| D9 | 3+ notificaciones no leídas del mismo tipo el mismo día (p. ej. 3 matrículas) | Agrupación | |
| D10 | Alumnos Clase B activos en sede A y B, con y sin consentimiento promocional vigente, uno que lo revocó | Filtro por consentimiento | |
| D11 | Alumno sin email (o con email en blanco) | "Sin email" | |
| D12 | Alumno archivado (Papelera) con matrícula activa | S4 | |
| D13 | Alumno con 2 matrículas (B + Profesional) | Un destinatario, no dos | |
| D14 | 2-3 alumnos de prueba con **email real tuyo** en una sede, uno con consentimiento promocional y otro sin él | Correo real (operativo y promocional) | |
| D15 | Segmento con > 200 destinatarios, **en entorno de prueba y con `dryRun`** o casillas controladas | S1 | |
| D16 | Vehículo con documento que vence hoy o en `advance_days` días, con instructor asignado | D3 flota | |
| D17 | Plantillas: 1 activa con `{{nombre}}` y `{{sede}}`, 1 inactiva | Compositor | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede; acceso de
lectura a la BD (SQL editor, solo lectura) para confirmar `notifications`, `announcements`,
`announcement_recipients` y `cron.job_run_details`.

---

## 3. Casos

### A. Carga y acceso a "Comunicación"

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra por el menú "Comunicación" (`/app/admin/tareas`) | Hero "Comunicación", pestaña "Tareas del equipo" abierta, consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/observaciones` | Mismo layout con pestañas "Mis observaciones / Tareas recibidas / A instructores" | ✓ | |
| A03 | Secretaria escribe `/app/admin/tareas` | Acceso denegado | ✓ | |
| A04 | Salir y volver | Datos al instante, sin skeleton | — | |
| A05 | F5 dentro de la pantalla | Carga normal | ✓ | |
| A06 | Red cortada al cargar | ¿Se muestra algún error? Hoy el error queda en el facade y solo aparece dentro del drawer de crear tarea — anotar lo que se ve | — | |
| A07 | Desktop 1440 px | App-like: el documento no scrollea, la lista sí | ✓ | |

### B. Crear tarea / observación / consulta

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Admin → "Nueva comunicación" → Tarea a secretaria A con fecha **(§4)** | Se crea, toast "Tarea enviada correctamente", aparece en "Asignadas por mí" y le llega notificación a la secretaria | ✓ | |
| B02 | Secretaria → Observación a admin | Se crea; el campo Fecha límite no aparece | ✓ | |
| B03 | Secretaria → Consulta a instructor A | Se crea (el instructor no la verá en el piloto; solo verificar que no falla) | ✓ | |
| B04 | Picker de secretaria A | Admins (todos) + instructores de A + instructores con "ambas sedes". Sin secretarias, sin alumnos, sin ella misma | ✓ | |
| B05 | Picker de admin con sede A elegida / con "Todas" | Solo secretarias e instructores de A / de todas las sedes. ¿Deben aparecer otros admins? (hoy no) | ✓ | |
| B06 | Secretaria A → instructor B con "ambas sedes" (D4) **(§4)** | Se crea. Hoy probable 403 "Error al crear la tarea" (S12) | — | |
| B07 | Admin → secretaria de la otra sede | Se crea sin 403 (S13) | — | |
| B08 | Asunto vacío / solo espacios | Botón deshabilitado. Con solo espacios hoy probablemente lo deja enviar — anotar | ✓ | |
| B09 | Asunto de 200+ caracteres y descripción de 2000+ | Corta en 200 / 2000 | — | |
| B10 | Cambiar Tipo de Tarea → Observación tras poner fecha | La fecha desaparece y no se guarda | ✓ | |
| B11 | Fecha límite en el pasado | Se permite y queda "Vencida" desde el inicio (0001-b AC-E3) | — | |
| B12 | Fecha límite = hoy / mañana **(§4)** | "Vence" muestra el día elegido; no sale "Vencida" antes de tiempo (S9) | ✓ | |
| B13 | Sin destinatarios disponibles | Mensaje "No hay destinatarios disponibles." | — | |
| B14 | Doble clic en "Enviar tarea" | Se crea una sola | — | |
| B15 | Cancelar el drawer con datos | Se cierra sin crear | — | |
| B16 | Falla de red al enviar | Toast "Error al crear la tarea"; el drawer queda abierto con los datos | — | |

### C. Bandejas, pestañas y KPIs

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Admin: "Asignadas por mí" / "Dirigidas a mí" / "Observaciones" | Cada una muestra solo lo suyo; el contador del tab = no completadas | ✓ | |
| C02 | Secretaria: "Mis observaciones" / "Tareas recibidas" / "A instructores" | Idem; "A instructores" excluye completadas | ✓ | |
| C03 | KPIs admin Pendientes / Vencidas / Asignadas / Recibidas | Coinciden con las listas (S10: Vencidas no debe contar completadas) | ✓ | |
| C04 | KPIs secretaria "Mis pendientes / Recibidas / A instructores" | Coinciden | ✓ | |
| C05 | Contador de la pestaña "Tareas del equipo" | Admin: pendientes suyas; secretaria: recibidas no completadas — confirmar que ambas cifras significan lo mismo para el usuario | — | |
| C06 | Admin con sede A elegida recibe tarea de secretaria B **(§4)** | Aparece en "Dirigidas a mí" (S8) | — | |
| C07 | Admin cambia de sede | La lista recarga sola | ✓ | |
| C08 | Secretaria con grant cambia de sede | ¿La lista recarga? (su pantalla no tiene el `effect` de sede) | — | |
| C09 | Tarea a un usuario inactivo (D5) | Badge "Destinatario inactivo" | — | |
| C10 | Tareas completadas de hace > 90 días | No aparecen (se filtran); las pendientes viejas sí | — | |
| C11 | Tarjeta: resumen del cuerpo > 80 caracteres, nombre "Emisor → Destinatario", nº de respuestas, "hace Xh" | Correcto y sin romper diseño | — | |
| C12 | Tablet/móvil con > 5 tareas (D7) | 5 visibles + "Cargar más (N restantes)"; al cambiar de pestaña vuelve a 5 | ✓ | |
| C13 | Pestaña vacía | Estado vacío centrado | ✓ | |

### D. Detalle, estados, respuestas y eliminar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Destinatario abre una tarea pendiente | Botones "Iniciar" y "Completar" | ✓ | |
| D02 | "Iniciar" → "Completar" **(§4)** | Estado cambia; el emisor recibe "Tarea completada" | ✓ | |
| D03 | El emisor abre su tarea | No ve Iniciar/Completar; ve Eliminar si está pendiente | ✓ | |
| D04 | Destinatario abre una observación **(§4)** | Queda vista (0001-b AC5). Hoy pasa a "Completada", el emisor recibe "Tarea completada" y no se puede responder (S11) | — | |
| D05 | Consulta: el destinatario responde | Hilo con su respuesta; la consulta pasa a "En curso"; el emisor recibe "Nueva respuesta" | ✓ | |
| D06 | Consulta: el emisor la cierra | Hilo en solo lectura para ambos (AC9) | ✓ | |
| D07 | Responder en una tarea completada | No hay caja de respuesta; aviso con candado | ✓ | |
| D08 | Respuesta vacía / solo espacios | Botón deshabilitado | ✓ | |
| D09 | Respuesta > 500 caracteres | Corta en 500 | — | |
| D10 | Respuesta con saltos de línea | Se respetan | — | |
| D11 | Autor de cada respuesta | Hoy dice "Tú"/"Otro" sin nombre — ¿aceptable? (el admin que mira una tarea ajena ve "Otro" en ambos lados) | — | |
| D12 | Respuesta con la red cortada | Toast de error; ¿se pierde el texto escrito? (S14) | — | |
| D13 | Eliminar (emisor, tarea pendiente) | Confirmación "Eliminar mensaje" → desaparece de la lista | ✓ | |
| D14 | Admin elimina una tarea ajena de su sede | Permitido (así está programado) — confirmar que se desea | — | |
| D15 | Después de eliminar | El drawer muestra "Selecciona una tarea…" — ¿debería cerrarse? | — | |
| D16 | Botón "Editar" | Siempre deshabilitado — confirmar que es aceptable para el piloto (S22) | — | |
| D17 | Fecha "Vence" en el detalle | Igual al día elegido (S9) | ✓ | |
| D18 | Secretaria abre el detalle desde su pantalla | Se abre apilado (`push`) vs admin (`open`) — verificar que cerrar/volver funciona en ambos | — | |

### E. Tiempo real de tareas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | 2 sesiones: admin crea tarea para secretaria **(§4)** | Aparece en la bandeja de la secretaria sin recargar + toast + campana | ✓ | |
| E02 | 2 sesiones: la secretaria la completa | El admin ve el cambio sin recargar (0001-b AC2) | ✓ | |
| E03 | 2 sesiones: respuesta con el detalle abierto del otro lado | Hoy la respuesta no aparece hasta reabrir (S14) — anotar | — | |
| E04 | 2 sesiones: el emisor elimina la tarea **(§4)** | Desaparece del lado del destinatario (S14) | — | |
| E05 | Salir de la pantalla | Se cierran los canales `tasks-sent-*` / `tasks-received-*` (DevTools → WS) | — | |

### F. Campana y panel de notificaciones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Llega una notificación con la app abierta en cualquier pantalla | Badge sube sin recargar + toast con título y mensaje | ✓ | |
| F02 | Abrir el panel | Últimas 10 entradas, de la más nueva a la más vieja | ✓ | |
| F03 | Clic en una notificación | Queda leída (badge baja) y navega si tiene destino (ver H) | ✓ | |
| F04 | "Marcar todo como leído" | Badge a 0; persiste al recargar | ✓ | |
| F05 | 3+ no leídas del mismo tipo el mismo día (D9) | Se agrupan ("3 matrículas confirmadas"); se expanden; "marcar grupo leído" funciona | ✓ | |
| F06 | Agrupación de tareas | "Nueva tarea", "Nueva respuesta" y "Tarea completada" se agrupan como "N tareas" — ¿se entiende? | — | |
| F07 | Eliminar una | Desaparece; no vuelve al recargar | ✓ | |
| F08 | Eliminar una dentro de un grupo expandido | Solo esa | — | |
| F09 | "Eliminar todas" **(§4)** | Confirmación → panel vacío, incluidas las agrupadas y las que no se veían en el panel; siguen en el historial | ✓ | |
| F10 | Panel vacío | Empty state con acceso al historial | ✓ | |
| F11 | > 50 no leídas (D8) | ¿El badge dice 50? (S17) | — | |
| F12 | Notificación sin asunto | Título "Notificación" | — | |
| F13 | Mensaje muy largo | No rompe el panel | — | |
| F14 | Clic afuera del panel | Se cierra | — | |
| F15 | Cerrar sesión e iniciar con otro usuario en el mismo navegador | No se ven notificaciones del anterior; el canal viejo se cierra | ✓ | |
| F16 | 2 pestañas del mismo usuario: marcar leída en una | La otra no se actualiza (solo escucha INSERT) — ¿aceptable? | — | |
| F17 | Perder la conexión 1 minuto y volver | ¿Llegan las notificaciones creadas mientras tanto? (no hay recarga al reconectar) | — | |

### G. Historial y páginas de notificaciones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Panel → "Ver todas" | Drawer "Historial de Notificaciones" con activas y eliminadas | ✓ | |
| G02 | Notificaciones eliminadas en el historial | ¿Se distinguen de las activas? (S17) | — | |
| G03 | Clic en una fila | Queda leída; ¿navega a su destino como en el panel? (hoy no) | — | |
| G04 | Llega una notificación con el historial abierto | ¿Aparece? (S17) | — | |
| G05 | "Marcar todo como leído" y volver al historial sin cerrarlo | Puntos de no leído actualizados (S17) | — | |
| G06 | > 200 notificaciones | ¿Se avisa que hay más? | — | |
| G07 | URL `/app/admin/notificaciones` y `/app/secretaria/notificaciones` **(§4)** | No debería verse una maqueta "PLANO" en el piloto (S16) | ✓ | |

### H. Deep links (clic en la notificación)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | "Nueva tarea"/"Nueva respuesta"/"Tarea completada" (admin) | Va a `/app/admin/tareas` | ✓ | |
| H02 | Idem (secretaria) | Va a `/app/secretaria/observaciones` | ✓ | |
| H03 | "Nueva matrícula confirmada" (admin) | Va a la ficha del alumno correcto | ✓ | |
| H04 | Idem para una matrícula **Profesional** | ¿Abre la ficha correcta o la de Clase B? | — | |
| H05 | Notificación de pre-inscripción antigua (seed/BD) **(§4)** | No debe llevar a una pantalla bloqueada ni cerrar la sesión (S15) | — | |
| H06 | "Documento por vencer" de flota (admin) | Hoy no navega — ¿debería ir a Flota? | — | |
| H07 | Notificación de clase B, pago o comunicado (si alguna le llega a staff) | Sin error; solo cierra el panel | — | |
| H08 | **Ningún deep link lleva a una ruta de otro rol ni a una ruta bloqueada** (recorrer la tabla `resolveNotificationRoute`) | Todo destino existe y está habilitado para el rol | ✓ | |

### I. Productores del `NOTIFICATIONS-MAP` (uno por evento)

Para cada fila: hacer la acción en su módulo y verificar **destinatario, texto, que no le llega al
actor ni a otra sede**, y que la fila existe en `notifications`. "Sin disparador en piloto" = el
origen está bloqueado; solo se anota que no hay forma de probarlo.

| ID | Evento (mapa) | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Tarea creada (TasksFacade) | Destinatario: "Nueva tarea: <asunto>" | ✓ | |
| I02 | C2 — respuesta en tarea (trigger) | Solo la contraparte: "Nueva respuesta · Respondieron en: <asunto>" | ✓ | |
| I03 | C2 — tarea completada (trigger) | Solo la contraparte, nunca quien la completó | ✓ | |
| I04 | A1 — matrícula confirmada **(§4)** | Todos los admins activos (menos el actor): "Nueva matrícula confirmada"; al alumno le llega "Matrícula confirmada" (no visible en piloto). Ninguna secretaria recibe | ✓ | |
| I05 | A1 desde matrícula guardada como borrador | No notifica (AC-E4 de 0024) | — | |
| I06 | A2 — clase B reprogramada / reagendada | Filas para alumno e instructor(es) en BD; staff no recibe nada. Nadie las verá en el piloto (S7) | — | |
| I07 | A3 — certificado listo | Fila para el alumno; staff no recibe | — | |
| I08 | A4 — pago presencial (matrícula, Pagos, curso singular, servicio especial) | Fila para el alumno; ningún admin/secretaria recibe | — | |
| I09 | A5 — notas profesionales confirmadas | Sin disparador en piloto (Profesional recortado) | — | |
| I10 | A6 — anticipo registrado / A7 — liquidación pagada | Fila para el instructor (no visible en piloto) | — | |
| I11 | Recordatorio de asistencia (Asistencia B) **(§4)** | Fila para el alumno; el toast no debe decir "enviado" si el INSERT falló (S7) | — | |
| I12 | B1 — pre-inscripción web | Sin disparador en piloto (inscripción pública bloqueada) | — | |
| I13 | B2 — pago online del alumno | Sin disparador en piloto (portal alumno bloqueado) | — | |
| I14 | B3 — cuenta de alumno activada | Si en el piloto se envían invitaciones: fila de bienvenida al alumno, sin errores | — | |
| I15 | C1 — clase completada por instructor | Sin disparador en piloto (solo notifica a secretarias si el actor es instructor). Cerrar la clase desde secretaría **no** debe notificar a secretarias | — | |
| I16 | D1 — aviso 2ª cuota al completar la clase 6 | Si la secretaría completa la 6ª clase de un alumno con saldo: fila para el alumno | — | |
| I17 | D3 — documento de flota por vencer (cron 06:00 UTC) **(§4)** | Todos los admins + instructor asignado, el día exacto y a `advance_days` días; ninguna secretaria | — | |
| I18 | Comunicado (send-announcement) | Fila por alumno con `reference_type = announcement`; ningún staff recibe | ✓ | |
| I19 | A8/A9/A10, D2, D4 | No implementados — confirmar que no llega nada | — | |
| I20 | Aislamiento entre sedes en I01–I18 | Ninguna notificación le llega a una secretaria de la otra sede | ✓ | |

### J. Comunicados — destinatarios y consentimiento

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Pestaña "Comunicados a alumnos" → "Nuevo comunicado" | Drawer con 3 secciones; Destinatarios abierta | ✓ | |
| J02 | Sin elegir tipo | "Elige el tipo de comunicado…"; no se puede enviar | ✓ | |
| J03 | Operativo, sede A, Clase B, Activas | Cuenta = alumnos B activos de A (contar a mano) | ✓ | |
| J04 | Promocional con D10 **(§4)** | Sin consentimiento y con consentimiento revocado quedan fuera, con aviso "N alumno(s)… sin consentimiento"; casilla deshabilitada | ✓ | |
| J05 | D13 (2 matrículas) | Aparece una vez | ✓ | |
| J06 | D11 (sin email) | Incluido con badge "Sin email" (recibe solo in-app) | — | |
| J07 | D12 (archivado con matrícula activa) **(§4)** | No debería aparecer (S4) | — | |
| J08 | Estado = Finalizadas + Operativo | Llega a ex-alumnos sin consentimiento — **decisión** (§5) | — | |
| J09 | Usuario inactivo | No aparece | — | |
| J10 | Quitar / incluir a mano, buscador, "Quitar los N visibles", "Ver excluidos" | El contador siempre sobre el total, nunca sobre lo filtrado (0043-b AC3-AC5, AC-E3) | ✓ | |
| J11 | Cambiar un filtro después de destildar | Se resetean los destildes, el buscador y "ver excluidos" | ✓ | |
| J12 | Secretaria | No ve selector de sede; el segmento es solo su sede | ✓ | |
| J13 | Secretaria con grant | Igual que J12 (solo su sede de anclaje) — confirmar | — | |
| J14 | Admin con sede A elegida arriba abre el compositor | ¿Arranca en sede A o en "Todas las sedes"? (S19) | — | |
| J15 | Volver un select a "Todas"/"Todos" | ¿Se puede sin cerrar el drawer? (S19) | — | |
| J16 | Segmento con 0 alumnos | "Este segmento no tiene alumnos"; enviar deshabilitado | ✓ | |
| J17 | > 200 destinatarios | Aviso de reputación del dominio | ✓ | |
| J18 | > 500 destinatarios | Error "máximo por comunicado es 500"; enviar deshabilitado | ✓ | |
| J19 | Vista previa vs lo que resuelve el servidor | Mismo número de destinatarios que `recipients_total` al enviar | — | |

### K. Mensaje, plantillas y vista previa

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Elegir plantilla activa (D17) | Asunto y cuerpo se llenan y quedan editables | ✓ | |
| K02 | Plantilla inactiva | No aparece en el selector | ✓ | |
| K03 | Limpiar la plantilla | ¿Borra el texto o lo deja? — anotar | — | |
| K04 | "Vista previa" | Drawer con el HTML real; `{{nombre}}` = "Ana Pérez", `{{sede}}` = ejemplo; volver conserva el borrador | ✓ | |
| K05 | Vista previa sin asunto o cuerpo | Botón deshabilitado | ✓ | |
| K06 | Cuerpo con `<b>hola</b>` y `<script>` | Se muestran como texto, no como HTML | ✓ | |
| K07 | Marcador desconocido `{{rut}}` | Sale vacío, sin error | — | |
| K08 | Asunto > 150 caracteres | Corta en 150 | — | |
| K09 | Admin: Ajustes → "Plantillas de Comunicado": crear, editar, desactivar, eliminar, insertar variable en el cursor | Funciona (0043-b AC10) | ✓ | |
| K10 | Secretaria: Ajustes | No ve "Plantillas de Comunicado" | ✓ | |
| K11 | Eliminar una plantilla usada por un comunicado | El comunicado sigue en el historial | — | |

### L. Envío inmediato

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Operativo a D14 (emails reales) **(§4)** | Confirmación con el número → barra de progreso → toast "enviado a N"; correo recibido; fila en historial con fecha | — | |
| L02 | Promocional a D14 **(§4)** | Solo recibe quien consintió | — | |
| L03 | Contenido del correo | Asunto y cuerpo con nombre/sede resueltos, saltos de línea, tildes y ñ bien | — | |
| L04 | Marca del correo para un alumno de la otra sede (S6) | Nombre de la escuela correcto | — | |
| L05 | Correo promocional | ¿Trae forma de darse de baja? (S5) | — | |
| L06 | Correo llega a spam / remitente | Anotar dónde cae y el remitente mostrado | — | |
| L07 | Cerrar la pestaña a mitad del envío **(§4)** | Anotar qué queda en el historial y en `announcement_recipients` (S3) | — | |
| L08 | Falla SMTP o dirección inválida | Toast "enviado con N fallido(s)"; historial "N sin entregar"; igual recibe la notificación in-app | — | |
| L09 | Doble clic en "Enviar comunicado" | Un solo comunicado | — | |
| L10 | Cancelar en la confirmación ("Revisar") | No se envía nada ni se crea fila | ✓ | |

### M. Programar, despacho y cancelar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Programar para dentro de 20 min **(§4)** | Historial "Programado · sale el dd/MM HH:mm" con la **hora de Chile**; sale entre la hora y +15 min | — | |
| M02 | Fecha pasada | "La fecha de envío tiene que ser futura"; botón deshabilitado | ✓ | |
| M03 | Destildar "Programar" | Vuelve a envío inmediato | ✓ | |
| M04 | Dejar el drawer abierto 10 min y programar para "ahora + 2 min" | El `min` del input es el de cuando se abrió; la validación igual corre | — | |
| M05 | Alumno revoca el consentimiento entre la programación y el envío | No le llega (spec 0042-b AC6) | — | |
| M06 | Cancelar un programado **(§4)** | Queda "Cancelado · no se envió" y el cron no lo envía | ✓ | |
| M07 | Cancelar justo cuando el cron lo tomó **(§4)** | Nunca debe decir "cancelado" si se envió (S2) | — | |
| M08 | Secretaria intenta cancelar un programado de admin a todas las sedes | No debería ofrecerse o debe avisar que no puede (S2) | — | |
| M09 | Programado con > 200 destinatarios (D15, dryRun) **(§4)** | Termina y marca "enviado" con los N (S1) | — | |
| M10 | Cron caído y se retoma | Los programados atrasados salen igual (AC-E2) | — | |
| M11 | Programado cuyo segmento queda vacío | Se cierra como enviado con 0, no se reintenta infinito | — | |
| M12 | Horario de verano/invierno | Programar un envío para una fecha después del cambio de hora: sale a la hora local correcta | — | |

### N. Historial de comunicados

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Lista | Asunto, badge Operativo/Promocional, estado, fecha, nº destinatarios, sede, emisor, "N sin entregar" | ✓ | |
| N02 | Clic en una fila | ¿Muestra el detalle / destinatarios? (hoy no hace nada, S18) | — | |
| N03 | Programado que ya salió, sin recargar | ¿Cambia a "Enviado"? (S18) | — | |
| N04 | Secretaria sede A | Ve los de su sede y los de admin a "Todas las sedes"; nunca los de B | ✓ | |
| N05 | Admin cambia de sede con la pestaña abierta | ¿Recarga? (S18) | — | |
| N06 | Cerrar sesión admin → entrar como secretaria en el mismo navegador → pestaña comunicados | No debe verse, ni por un instante, el historial del admin (S18) | — | |
| N07 | Historial vacío | "Todavía no enviaste comunicados" | ✓ | |

### O. Sedes, roles y seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | **RLS tareas** **(§4)** | Secretaria A no lee tareas ajenas; admin solo las de sus sedes | ✓ | |
| O02 | Secretaria intenta tarea a otra secretaria (petición manual) | Rechazo (constraint `role_matrix`) | — | |
| O03 | Destinatario edita el asunto de una tarea por consola | Hoy la RLS lo permite (AC-E2 de 0001-b se aplica solo en UI) — anotar | — | |
| O04 | **send-announcement de otra sede** **(§4)** | Secretaria A con id de comunicado de B → 403 | ✓ | |
| O05 | send-announcement con un comunicado cancelado **(§4)** | No debe enviar (S20) | — | |
| O06 | dispatch-scheduled-announcements llamado con el token de un usuario logueado | 401 | ✓ | |
| O07 | Secretaria inserta un comunicado con `branch_id = null` o de otra sede | Rechazo RLS | ✓ | |
| O08 | Secretaria inserta una notificación para un usuario de otra sede (S21) | Hoy se permite — **decisión** | — | |
| O09 | Admin lee `notifications` de otros usuarios desde consola (S21) | Hoy se permite — **decisión** | — | |
| O10 | Tarea a instructor en el piloto | El instructor no tiene portal: ¿debe seguir en el picker? — **decisión** | — | |

### P. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Modo claro y oscuro: tarjetas, detalle, panel, compositor, historial | Todo legible | ✓ | |
| P02 | 375 / 768 / 1440 px | Sin scroll horizontal; compositor usable en 700 px de alto (0043-b AC6) | ✓ | |
| P03 | Solo teclado | Tarjetas (Enter), campana, panel y compositor alcanzables; foco visible | — | |
| P04 | Tooltips / aria-label en botones de solo ícono (eliminar notificación, campana) | Presentes | — | |

---

## 4. Casos con pasos numerados

### B01 — Admin crea una tarea para una secretaria

**Precondición:** 2 sesiones (admin y secretaria A), cada una en su navegador.
1. Admin: Comunicación → "Nueva comunicación".
2. Tipo = Tarea; destinatario = secretaria A; asunto "Prueba B01"; descripción; fecha límite = mañana.
3. "Enviar tarea".
4. Admin: verificar toast "Tarea enviada correctamente", la tarea en "Asignadas por mí" y "Vence <mañana>".
5. Secretaria (sin recargar): verificar toast, badge de la campana +1, y la tarea en "Tareas recibidas".
6. En BD: `select * from notifications where recipient_id = <id secretaria> order by id desc limit 1`.

**Esperado:** todo lo anterior; la notificación dice "Nueva tarea: Prueba B01". **Evidencia:** capturas 4 y 5.

### B06 — Instructor "ambas sedes" de otra sede

**Precondición:** secretaria A; instructor de la sede B con `both_branches = true` (D4).
1. "Nueva comunicación" → abrir el picker y verificar que aparece ese instructor.
2. Enviar una tarea corta a él.

**Esperado:** se crea. Si aparece "Error al crear la tarea" y en Network un 403 sobre `tasks`, S12
confirmada (el picker ofrece algo que la BD no acepta).

### B12 — Fecha límite en hora de Chile

1. Crear una tarea con fecha límite = **hoy**, otra = **mañana**.
2. Anotar lo que dice "Vence" en cada tarjeta y en el detalle.
3. Revisar si alguna sale "Vencida".
4. Volver a mirar después de las 21:00 (o 20:00 en horario de invierno).

**Esperado:** "Vence" muestra el mismo día elegido; la de hoy no sale "Vencida" hasta que termine el
día (o, al menos, no antes de las 00:00 de hoy). Si la de mañana muestra "Vence <hoy>" o sale Vencida
a las 21:00 de hoy, S9 confirmada.

### C06 — Admin con sede elegida recibe tarea de otra sede

**Precondición:** admin con la sede A elegida en el selector; secretaria B.
1. Secretaria B: tarea para ese admin.
2. Admin: verificar la notificación.
3. Admin: Comunicación → "Dirigidas a mí" y KPI Pendientes.
4. Admin: cambiar a "Todas las sedes" y repetir el paso 3.

**Esperado:** la tarea se ve en el paso 3. Si solo aparece en el paso 4, S8 confirmada.

### D02 — Ciclo de estados y notificación de completada

**Precondición:** tarea B01 pendiente; 2 sesiones.
1. Secretaria: abrir la tarea → "Iniciar" → verificar "En curso".
2. Admin (sin recargar): verificar el estado nuevo en su lista.
3. Secretaria: "Completar".
4. Admin: verificar notificación "Tarea completada · Prueba B01" y el estado.
5. Secretaria: verificar que **ella** no recibió esa notificación.

**Esperado:** como arriba; después del paso 3 el hilo queda en solo lectura.

### D04 — Observación abierta por el destinatario

**Precondición:** secretaria envía una Observación a un admin; 2 sesiones.
1. Admin: abrir la observación.
2. Admin: verificar su estado y si puede responder.
3. Secretaria: verificar si recibió "Tarea completada".
4. En BD: `select status, seen_at, seen_by from tasks where id = …`.

**Esperado (spec):** `seen_at`/`seen_by` cargados, sin notificación de "completada" y con la
posibilidad de responder. Anotar lo real (S11).

### E01 / E04 — Tiempo real: crear y eliminar

**Precondición:** 2 navegadores; admin y secretaria A en Comunicación.
1. Admin crea una tarea para la secretaria. Sin tocar la secretaria, esperar 5 s.
2. Verificar que aparece en "Tareas recibidas".
3. Admin: abrir la tarea → Eliminar → confirmar.
4. Esperar 5 s en la sesión de la secretaria.
5. Recargar la sesión de la secretaria.

**Esperado:** en 2 aparece sin recargar; en 4 desaparece sin recargar. Si solo desaparece en 5, S14
confirmada.

### F09 — Eliminar todas

**Precondición:** > 10 notificaciones, algunas agrupadas (D9).
1. Abrir el panel → "Eliminar todas" → confirmar.
2. Verificar el panel vacío y el badge en 0.
3. Recargar.
4. "Ver todas".

**Esperado:** tras recargar siguen sin aparecer en el panel; en el historial están todas (incluidas
las que no cabían en el panel).

### G07 — Páginas de notificaciones

1. Como admin, escribir `/app/admin/notificaciones`.
2. Como secretaria, escribir `/app/secretaria/notificaciones`.

**Esperado:** una página real, una redirección o un "no disponible". Si se ve "PLANO · Mockup ·
Pendiente calcar desde mockup", S16 confirmada.

### H05 — Deep link de pre-inscripción

**Precondición:** una notificación con `reference_type = 'preinscription'` para el usuario (existente
en la BD de prueba; no crearla a mano en producción).
1. Admin: clic en esa notificación.
2. Repetir como secretaria.

**Esperado:** no lleva a una pantalla bloqueada; si lo hace, anotar qué muestra (pantalla "módulo no
disponible", logout, error) (S15).

### I04 — Matrícula confirmada (A1)

**Precondición:** 3 sesiones: admin 1, admin 2 (o revisar en BD), secretaria B.
1. Secretaria A (o admin 1) confirma una matrícula Clase B completa.
2. Admin 1 y admin 2: verificar notificación "Nueva matrícula confirmada · Matrícula N — Nombre (Curso)" sin recargar.
3. Secretaria B: verificar que no recibió nada.
4. Si el actor fue admin 1: verificar que él **no** la recibió.
5. Clic en la notificación → ficha del alumno correcto.

**Esperado:** como arriba. **Evidencia:** captura del paso 2.

### I11 — Recordatorio de asistencia

1. Asistencia B → alerta de faltas consecutivas → "enviar recordatorio".
2. Verificar el toast.
3. En BD, buscar la fila en `notifications` para el `user_id` del alumno.
4. Repetir con la red cortada justo antes del clic (DevTools → Offline después de abrir la alerta).

**Esperado:** en 3 existe la fila. En 4, el toast debe ser de error, no "Recordatorio enviado" (S7).
Anotar además que el alumno no tiene cómo verlo en el piloto.

### I17 — Vencimiento de documentos de flota (cron)

**Precondición:** D16 con vencimiento = hoy (o hoy + `advance_days`). Solo en entorno de prueba.
1. Esperar la corrida de las 06:00 UTC (03:00 Chile) o ejecutar `select notify_vehicle_document_expiry();` en el SQL editor de prueba.
2. Verificar la notificación en cada admin y en el instructor asignado (BD).
3. Verificar que ninguna secretaria recibió.
4. Revisar `cron.job_run_details` del job `notify-vehicle-document-expiry`.

**Esperado:** "Documento vencido/Documento por vencer … del vehículo <patente>". Ejecutarlo 2 veces el
mismo día duplica la notificación — anotar.

### J04 / L02 — Promocional y consentimiento

**Precondición:** D10 y D14 en la sede A.
1. Nuevo comunicado → Promocional → sede A (admin) → Clase B → Activas.
2. Verificar el aviso "N alumno(s)… sin consentimiento" y que coincide con lo contado en `consents`.
3. "Ver lista": los sin consentimiento tienen badge y casilla deshabilitada.
4. Con los alumnos D14, enviar.
5. Revisar las casillas de D14 y `announcement_recipients` del comunicado.

**Esperado:** solo recibe (correo e in-app) quien tiene consentimiento vigente; quien lo revocó no
aparece en `announcement_recipients`.

### J07 — Alumno archivado

1. Archivar D12 (tiene matrícula activa).
2. Nuevo comunicado operativo con un segmento que lo incluya.
3. "Ver lista" y buscar a D12.

**Esperado:** D12 no aparece. Si aparece, S4 confirmada (no enviar).

### L01 — Envío operativo real

**Precondición:** segmento acotado a D14 (quitar a mano al resto o usar una sede de prueba).
1. Operativo → segmento → verificar el conteo = alumnos D14.
2. Asunto "Prueba L01 {{nombre}}", cuerpo de 3 líneas con tildes y ñ.
3. Vista previa → volver.
4. Enviar → confirmar.
5. Verificar la barra de progreso y el toast "Comunicado enviado a N destinatario(s)".
6. Revisar las casillas: asunto con el nombre real, cuerpo, marca, remitente.
7. Historial: "Enviado el dd/MM HH:mm · N destinatarios".

**Evidencia:** captura del correo recibido.

### L07 — Cerrar la pestaña a mitad del envío

**Precondición:** entorno de prueba y segmento de 60+ alumnos. La UI no ofrece `dryRun`, así que usa
alumnos con casillas controladas o un entorno sin SMTP real. DevTools → Slow 3G.
1. Enviar el comunicado.
2. Cuando la barra esté cerca de 1/3, cerrar la pestaña.
3. Volver a entrar → historial.
4. En BD: `select status, sent_at, recipients_total from announcements where id = …` y contar `email_sent_ok` en `announcement_recipients`.

**Esperado:** anotar el estado: si dice enviado sin fecha y hay destinatarios sin procesar, S3
confirmada.

### M01 — Programar

1. Nuevo comunicado a D14 → "Programar para más adelante" → hoy + 20 min.
2. Verificar el resumen "Programado para el …" y confirmar.
3. Historial: "Programado · sale el <hora Chile>" y "destinatarios al momento del envío".
4. Esperar hasta 15 min después de la hora.
5. Recargar el historial y revisar las casillas.

**Esperado:** sale en la ventana, pasa a "Enviado" con la hora real y el número de destinatarios.

### M06 / M07 — Cancelar

1. Programar un comunicado para dentro de 30 min → "Cancelar" → confirmar → verificar "Cancelado".
2. Esperar la hora y verificar que no llegó nada.
3. Programar otro para dentro de 2 min. Cuando el cron corra (vigilar `announcements.status` =
   `enviando`), apretar "Cancelar" desde una pestaña que aún lo muestra como programado.

**Esperado:** en 3, un mensaje de que ya no se puede cancelar. Si dice "Comunicado cancelado" y el
correo llega igual, S2 confirmada.

### M09 — Programado de más de 200

**Precondición:** entorno de prueba, D15 (> 200 destinatarios) y dispatcher llamado con
`dryRun: true` por service role (nunca envío real al seed).
1. Programar el comunicado para dentro de 1 min.
2. Invocar el dispatcher con `dryRun` 3 veces separadas por > 30 min (o esperar el cron en dryRun).
3. Contar filas de `announcement_recipients` con `send_error = 'dry_run'` y revisar `status`.

**Esperado:** todas las filas procesadas y el comunicado en `enviado`. Si se queda en 200 y el estado
oscila `enviando`/`programado`, S1 confirmada → **P0 antes de programar comunicados grandes**.

### O01 — RLS de tareas

**Precondición:** secretaria A; id de una tarea entre admin y secretaria B.
1. En Comunicación, copiar desde Network la petición a `/rest/v1/tasks` ("Copy as fetch").
2. En Console, cambiarla para pedir `id=eq.<tarea de B>`.
3. Ejecutar.

**Esperado:** 0 filas. Si aparece, fuga → **P0 inmediato**.

### O04 / O05 — Seguridad de send-announcement

**Precondición:** secretaria A; ids de un comunicado de la sede B y de uno cancelado de A.
1. Enviar un comunicado propio mínimo (D14) y copiar una petición `send-announcement` desde Network.
2. En Console, repetirla con `announcementId` de B, `offset: 0`, `batchSize: 25`.
3. Repetirla con el id del comunicado cancelado de A (en entorno de prueba y con `dryRun: true`).

**Esperado:** 2 → 403 "No puedes enviar comunicados de otra sede". 3 → debe rechazarse; si procesa
destinatarios, S20 confirmada.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| D04 | ¿Abrir una observación la marca "vista" o "completada"? ¿Se le avisa al emisor? |
| D11 | ¿El hilo debe mostrar el nombre de quien respondió? |
| D14 | ¿El admin puede eliminar tareas entre otras personas de su sede? |
| C05 / C06 | ¿Las tareas "dirigidas a mí" del admin deben seguir el selector de sede? |
| B05 | ¿Un admin puede mandar tareas a otro admin? (hoy no) |
| O10 / B03 | ¿En el piloto se permite enviar tareas a instructores, que no pueden verlas? |
| I06–I10 | ¿Qué se hace con las notificaciones a alumnos/instructores mientras sus portales están bloqueados? (¿se dejan de generar, se muestran igual al activarse el portal?) |
| H04 / H06 | ¿A dónde debe llevar la notificación de una matrícula Profesional y la de vencimiento de flota? |
| G07 | ¿Las páginas `/notificaciones` se ocultan en el piloto o se implementan? |
| J08 | ¿Un comunicado **operativo** puede llegar a ex-alumnos (curso finalizado) sin consentimiento? |
| J13 | ¿La secretaria con grant multi-sede puede mandar comunicados a la otra sede? |
| L05 / S5 | ¿Cómo se da de baja un alumno de los promocionales durante el piloto (enlace en el correo, pedirlo a la escuela)? |
| — | ¿Quién valida que un comunicado marcado "operativo" no sea en realidad promocional? (el tipo lo declara el emisor y decide si se respeta el consentimiento) |
| L04 | ¿El correo lleva la marca de la sede del alumno o una marca común? |
| O08 / O09 | ¿Está bien que una secretaria cree notificaciones para cualquier usuario y que el admin lea las de todos? |
| F16 | ¿Leer una notificación en una pestaña/dispositivo debe reflejarse en los otros? |
