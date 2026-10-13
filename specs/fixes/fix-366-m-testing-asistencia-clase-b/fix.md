# Fix: Testing — Asistencia Clase B, inasistencias y penalización
> id: fix-366-m-testing-asistencia-clase-b
> refs: ASG-i-027
> status: open
> created: 2026-10-11

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/027-asistencia-clase-b.md`.

## Root Cause

[Heredado de ASG-i-027, a confirmar]: La asistencia tiene reglas de negocio con consecuencias
fuertes: 2 inasistencias consecutivas cancelan las clases futuras (penalización), la justificación
las neutraliza y el reagendamiento masivo las recupera. Además interviene un cron nocturno. Son
reglas fáciles de romper sin que se note en pantalla.

**Clasificación:** Integración · dificultad Alta · rutas: `/app/{admin,secretaria}/asistencia`,
panel de inasistencias y "Reagendar Clases" de la ficha, y **"Clases Actuales" del Dashboard de
secretaria**.

### Alcance confirmado al reclamar (Matías, 2026-10-11)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0030-b`, `fix-034-m`, `fix-035-m`, `fix-093-b` y la RPC
   `apply_class_b_absence_penalty()`.
2. **E2E manual** — los casos A…P del checklist, incluidas las sospechas abiertas.
3. **Playwright** — los casos "Auto ✓" van a la suite de `0019-m` (`e2e/`, `npm run test:e2e`).
   `ASG-i-021` ya está completada.

**Ajuste de Matías al reclamar — el Dashboard es el camino real de la secretaria.** En la práctica
la secretaria monitorea la asistencia desde "Clases Actuales" del Dashboard, no desde la vista
Asistencia. Se agrega la sección **P** al checklist, acotada a lo propio
de las reglas de asistencia vistas desde el Dashboard (inasistencia sin "Ausente" en el panel,
penalización, justificadas, reagendadas, alertas). **La mecánica del panel (iniciar, finalizar,
etiquetas, clase colgada) es de `ASG-i-030` §M y no se duplica acá.** Dato de partida, leído en
código: el panel solo ofrece Iniciar/Finalizar (`core/utils/live-class-action.utils.ts`), no
"Ausente".

**Sospechas ya resueltas por otros tracks** — se ejecutan como regresión, no como sospecha:

| Sospecha | Track |
|---|---|
| S1 — trigger viejo de deserción cancelaba la matrícula | `hotfix-150-m` |
| S2 — cron y RPC de penalización ejecutables por cualquiera | `fix-191-b`, `fix-322-m` (re-verificado en `fix-363-m`) |
| S3 / S4 — "Reactivar" y "Borrar horarios" masivos sin confirmación | `fix-364-m` |
| S5 — la nota de evaluación condicionaba la certificación | `fix-262-m` (la nota ya no es requisito, decisión del dueño) |
| S6 — escrituras sin revisar el error | `fix-362-m` |
| S9 — "Reactivar" se pierde al recargar | `fix-365-m` |
| S11 — día consultado en UTC | `0024-m` |
| S17 — tiempo real de la ficha muerto | `fix-360-m` |

**Siguen abiertas:** S7, S8, S10, S12, S13, S14, S15, S16, S18.

**Orden de ejecución por bloques:**

| Bloque | Secciones | Contenido |
|---|---|---|
| 1 | S12, S13, I07 | Seguridad: RLS por sede, relay de correo Zoom, regresión del cron |
| 2 | A–E, P | Carga, tabla del día, iniciar/finalizar/ausente — desde Asistencia y desde el Dashboard |
| 3 | F–J | Penalización, justificar, rail de alertas, cron, ficha y reagendar |
| 4 | K–O | Dashboard y otros módulos, Ciclos Teóricos, sedes y roles, 2 sesiones, visual |

- **Datos:** sembrados en la BD de dev con fechas en el pasado; el cron se ejecuta a mano ahí.
- **Casos que piden reloj de Windows adelantado o 2 navegadores** (E06, N02, N03): se simulan con
  datos sembrados o con 2 contextos de Playwright.
- **Decisiones de negocio** (§5 del checklist): no se marcan ✅/❌; se listan abajo como
  pendientes.

### Fuera de alcance

- Asistencia Profesional (oculta en el piloto).
- La UI del panel "Clases Actuales" por sí misma (orden, etiquetas, scroll): checklist `030`.

## Resultados

### Bloque 1 — Seguridad (2026-10-11)

Ejecutado por API con las cuentas E2E (`b1-seguridad.cjs`, `b1-instr.cjs` en el scratchpad de la
sesión) y lectura de políticas y funciones en la BD de dev. Solo operaciones sin efecto aunque la
protección fallara: `PATCH` con el mismo valor, penalización sobre una matrícula sin clases
agendadas, correo con un destinatario sin dirección.

| Caso | Res. | Evidencia |
|---|---|---|
| M06 / S12 — RLS por sede | ✅ | Secretaria A y B: leen 0 sesiones y 0 asistencias de la otra sede, `PATCH` cruzado afecta 0 filas; cada una lee la suya. Las políticas de `class_b_sessions` y `class_b_practice_attendance` filtran por `auth_user_branch_id()` / `auth_can_access_both_branches()`. Multi-sede lee ambas. **S12 queda reducida a la parte de pantalla** (M04/M05: la secretaria multi-sede no puede cambiar de sede en la UI), que se ejecuta en el bloque 4 |
| I07 / S2 — cron y penalización | ✅ | `mark_end_of_day_class_b_absences`: solo `service_role` (alumno y secretaria → `42501 permission denied`). `apply_class_b_absence_penalty`: alumno y secretaria de otra sede → `42501 No tienes permiso…` (chequeo de `fix-191-b`) |
| L09 / S13 — `send-zoom-email` | ❌ | Alumno e instructor la invocan y reciben `200 {"sent":0}`: la función solo exige sesión. Destinatarios, enlace, tema y fecha vienen del navegador y se insertan sin escapar en el HTML (`index.ts:120-138`). Cualquier cuenta puede mandar correos con la marca de la escuela a cualquier dirección → `fix-367-m` (cerrado: alumno/instructor 403, otra sede 404) |
| **S19 (nueva)** — asistencia Clase B abierta a cualquier instructor | ❌ | `instructor@test.com` (id 8) cuenta 261 asistencias, las mismas que el admin: todas las sedes y todos los instructores. Lee la fila 338 (de una clase del instructor 226) y su `UPDATE` afecta 1 fila. Las políticas SELECT/INSERT/UPDATE dan acceso por rol `instructor` sin mirar la sesión. Un instructor podría pasar una falta ajena a `excused` (evita la penalización) o un presente a ausente. El portal Instructor está bloqueado en el piloto, pero la API no → `fix-368-m` (cerrado: 0 ajenas) |
| L05 — enlace inválido ("hola") | ❌→✅ | Se guardaba sin aviso. Corregido dentro de `fix-367-m`: no se guarda y avisa |
| L07 (parcial) — envío real | ✅ | Ciclo 27, 1 destinatario de prueba: toast "Correo enviado a 1 alumno" y badge "Enviado el…" |

### Bloque 2 — Carga, tabla del día, iniciar, finalizar, ausente y Dashboard (2026-10-11)

Datos sembrados (`b2-seed.cjs` / `b2-seed-g.cjs`, ids en `b2-seed.json` del scratchpad): 7 alumnos
`E2E-Asis*` con clases hoy a las 11:00 (A1), 12:00 (B1), 13:30 vencida (G1), 18:00 (A2), 21:30
(C1), 11:30 en sede B (D1), una cancelada (A3), una de matrícula retirada (F1) y una `in_progress`
de ayer (E1). Penalización automática **desactivada en ambas sedes** (`branch_absence_penalty_config`,
spec 0048-b): el checklist la daba por activa; se trata en el bloque 3. Hora de la prueba ≈ 14:30.

| Caso | Res. | Evidencia |
|---|---|---|
| A01 admin carga | ✅ | Tabla + rail, consola sin errores |
| A02 secretaria | ✅ | Solo sede 1, sin columna Sede |
| A03 secretaria en ruta admin | ✅ | Redirige a su Dashboard |
| A04 volver | ✅ | 5 filas al instante, 0 skeletons |
| A05 F5 secretaria | ✅ | Nunca aparece sede B (además la RLS lo impide) |
| A06 menú | ✅ | |
| A08 1440×900 | ❌ | Página no scrollea, tabla con scroll interno y `thead` sticky ✅. Pero en admin "Todas" la tabla tiene 672 px para 9 columnas y los textos se montan: "Agendada" se sale, sede pisa instructor, el badge de estado pisa "Finalizada". Con el drawer abierto empeora (O04) → `fix-372-m` |
| A09 tabs | ✅ | Posición idéntica al alternar |
| B01 columnas | ✅ | |
| B03 orden | ❌ | `.order('start_time')` (hora real de inicio): la de 11:30 sede B y la de 13:30 quedan al final → `fix-369-m` |
| B04 canceladas | ✅ | |
| B05 matrícula retirada | ❌ | Admin "Todas": la clase de F1 (13:00) aparece como "Sin sede · Sin agendar" sin acciones. El embed `enrollments(...)` no es `!inner`, así que `.eq('enrollments.status','active')` deja la fila con matrícula nula; con sede elegida el filtro del cliente la descarta → `fix-369-m` |
| B06 clase 21:30 | ✅ | Aparece hoy (S11 resuelta por `0024-m`) |
| B07 ayer / mañana | ✅ | Ayer muestra la colgada con "Finalizar"; el 13 dice "Solo lectura" sin botones |
| B08 subtítulo | ❌ | Siempre "domingo, 11 de octubre" aunque se mire otra fecha (S18) → `fix-373-m` |
| B09 escribir la fecha | — | Escribir `10/10/2026` + Enter no cambia la fecha (vuelve a hoy); solo funciona el calendario. Anotado |
| B11 volver a todos | ✅ | Opción "Todos los instructores" |
| B12 instructor + estado | ❌ | Con un instructor la tabla muestra 1 fila y los chips siguen "Todos (6) / Pendiente (6)" (S18) → `fix-373-m` |
| B15 medianoche | ❌ (código) | `todayIsoVal = todayIso()` se calcula una vez (S18) → `fix-373-m` |
| B16 / S14 colgada de ayer | ❌ | No se ve en "hoy" de Asistencia; sí en el Dashboard ("Día anterior · Cierre atrasado") y mirando ayer. Se cierra desde ahí |
| C01 iniciar | ✅ | Drawer con alumno, clase, hora, instructor, vehículo y km precargado |
| C02 KPIs tras iniciar | ❌ | La fila pasa a "En curso" pero los KPIs siguen "En Curso 0 / Pendientes 3" hasta recargar → `fix-370-m` |
| C03 km inválido | ✅ | Vacío, negativo y > 999.999 deshabilitan |
| C04 km menor al actual | decisión | Acepta 1.000 con el vehículo en 300.015, sin advertir |
| C05 cambiar vehículo | ❌ | Precarga el km del nuevo (2.070) ✅ y la BD guarda el vehículo nuevo ✅, pero la fila y el drawer de Finalizar siguen mostrando la patente vieja hasta recargar. Además `start_time` sale del reloj del navegador (`new Date().toTimeString()`), no de la hora de Chile → `fix-370-m` |
| C06 vehículo en uso | decisión | Deja iniciar con BBCD12 mientras la clase colgada de ayer lo tiene en curso: 2 `in_progress` con el mismo vehículo |
| C07 2ª clase del instructor | ✅ | "El instructor ya tiene una clase en curso…" y el drawer queda abierto |
| C08 iniciar antes de la hora | decisión | Permitido (18:00 y 21:30 ofrecen "Iniciar") |
| C10 cancelar | ✅ | |
| D01/D02 km de retorno | ✅ | "Debe ser mayor al inicial (2070 km)" con 2.000 y 2.070 |
| D03 +5.000 km | decisión | Lo acepta sin advertir |
| D04 cerrar | ✅ | "Presente · Finalizada", 14:30–14:32 |
| D05 firmas | ❌ (código) | Solo se guarda `true/false` (S15) |
| D06 km del vehículo | ✅ | BBCD12 `current_km` = 2.085 |
| D08 toast | ❌ | "Evaluación y asistencia registradas" sin evaluación → `fix-373-m` |
| D09 asistencia | ✅ | `present`, `recorded_by` = admin |
| D10 notificación | ✅ | "Clase completada — Clase 1/12 completada." |
| E01 hora futura | ✅ | 18:00 y 21:30 sin "Ausente" |
| E02 al cumplirse la hora | anotado | Aparece al actualizar, no solo (OnPush) |
| E03/E04 modal | ✅ | Cancelar deja "Pendiente" |
| E05 1ª falta | ✅ | Toast, "Ausente", Inasistencias 1, alerta amarilla "1 falta · últ. 11-10" con "Recordar"; clase 2 sigue agendada |
| E06 / S10 antes de la hora | ❌ | Por API como secretaria: upsert `absent` y sesión a `no_show` de la clase de las 21:30 → ambos OK. La BD no valida la hora (revertido) → `fix-371-m` |
| E10 secretaria | ✅ | Clase vencida 13:30 → "Ausente" |
| E11 doble clic | ✅ | Una sola fila de asistencia |
| P01 inasistencia desde el Dashboard | decisión | La clase vencida dice "Debía iniciar hace 1 h"; al tocarla solo hay "Comenzar Clase". No hay forma de registrar la falta sin ir a Asistencia; si nadie va, la marca el cron |
| S18 tasa | ❌ | "Tasa Asistencia" = presentes / todas las clases con alumno: 0% sin nada registrado, 20% con 1 presente y 4 pendientes → `fix-373-m` |

No ejecutados en este bloque: A07 y D11/E09 (fallas de red: cubiertos por `fix-362-m`), C09 (doble
clic en "Comenzar": la 2ª actualización es idempotente), C11 → `030` §M. P02–P05 pasan al bloque 3
(dependen de faltas, penalización y reagendamiento).

### Bloque 3 — Penalización, justificar, rail, cron, ficha y reagendar (2026-10-12)

**Reglas de BD (F, G05, I, J07):** se ejecutaron por SQL en una transacción que termina en `RAISE
EXCEPTION`, de modo que todo se revierte (`b3-penal.sql`, scratchpad de la sesión `f42de8d2`). La
cancelación automática se prendió solo dentro de esa transacción (decisión del bloque 3). Se
llamaron `apply_class_b_absence_penalty()` y `mark_end_of_day_class_b_absences()` como
`postgres`. **Pantalla:** alumnos sembrados `E2E-AsisPenalizado` (faltas 3-4, clases 5-12
canceladas) y `E2E-AsisNoConsec` (faltas 2 y 5), sede 1; ids en `b3-seed.json`. El estado
penalizado se cargó directamente, sin prender la regla.

| Caso | Res. | Evidencia |
|---|---|---|
| F01 / F06 penalización | ✅ | Faltas 3-4 → cancela 7: la clase 5 de hoy a las 23:00 y las 6-11 futuras. No toca las completadas ni la 12, que ya estaba cancelada. La matrícula sigue `active` (S1 sigue resuelta) |
| F02 no consecutivas | ✅ | Faltas 2 y 5 → 0 canceladas |
| F03 / F04 justificada entre medio | ✅ | 3 `excused` + 4 `absent` → 0 |
| F05 orden de fechas | decisión | Por número: faltas 3 y 5 seguidas en fecha (la 4 se reagendó para después) → 0 |
| F07 otra matrícula | ✅ | La 2ª matrícula del mismo alumno queda intacta |
| F08 tras penalizar | ✅ | Ficha: 5-12 "Cancelada — pendiente reagendar"; sigue en la Base de Alumnos |
| F09 aviso al alumno | decisión | No se le avisa. Ver H03: en el piloto el alumno no ve notificaciones |
| F-extra `enabled_since` | ✅ | Un par registrado antes de prender la regla no penaliza |
| G01 modal | ✅ | "Guardar" deshabilitado vacío y con solo espacios |
| G02 guardar | ✅ | Toast "Justificación registrada", badge "Justificada", "Ver motivo" |
| G03 motivo largo | ✅ | `pre-wrap`, alto máx. 240 px con scroll |
| G04 cerrar | ✅ | Escape, X y clic en el fondo cierran sin guardar |
| G05 justificar tras penalizar | decisión | Las clases 5-12 siguen canceladas (S7) |
| G06 rail tras justificar | ❌ | Sigue "2 faltas" hasta recargar; al recargar baja a 1 (S7, parte de pantalla) |
| G07 falta del cron | ✅ | Se justifica y persiste |
| G10 recargar | ✅ | |
| H02 / S8 alerta | ❌ | `E2E-AsisNoConsec` (faltas 2 y 5, no seguidas) sale en rojo "2 faltas" con "Eliminar", igual que un penalizado, y con el tooltip "2 inasistencias consecutivas". El Dashboard sí cuenta solo faltas seguidas (`enrollmentsWithConsecutiveAbsences`) → **P05 incoherente**. "últ. 12-10" es la fecha en que se registró la falta, no la de la clase (09-10) |
| H03 recordar | ❌ | Spinner solo en esa fila y toast "Recordatorio enviado al alumno"; la notificación se guarda (id 636) con el texto "Registramos **1 falta consecutivas**…". Además es solo in-app: con el portal Alumno bloqueado (y sin cuenta, ASG-m-010) nadie la ve |
| H04 sin cuenta | N/A | `students.user_id` es NOT NULL |
| H09 reactivar | ✅ | Confirmación "Se volverán a agendar 8 clases futuras…" (regresión de `fix-364-m`) |
| I01 cron | ✅ | Clase 4 de ayer sin iniciar → `no_show` + `absent`; con la falta 3 viva penaliza 5-7 |
| I02 en curso | ✅ | Queda `in_progress` |
| I03 clase después de las 21:00 | anotado | El cron corre a las 21:00 de Chile (`run_class_b_absences_cutoff`); la clase de las 21:30 del 11-10 sigue `scheduled` hasta la noche siguiente (el trigger de `fix-371-m` no deja marcarla antes de su hora) |
| I04 matrícula retirada | decisión | La marca `no_show` + ausente: pasó de verdad anoche con F1 (`withdrawn`). Hoy ningún flujo deja una matrícula no activa con clases agendadas |
| I05 doble corrida | ✅ | Idempotente |
| J01 panel de inasistencias | ❌ | Fecha "12 oct" para faltas del 7 y 9 de octubre: usa `recorded_at` (`admin-alumno-detalle.facade.ts:851`) |
| J04 paso 1 | ✅ | 10 preseleccionadas con sus badges (incluida "Inasistencia — Justificada") |
| J05 paso 2 | ✅ (código) | Razón obligatoria, "Otro" exige detalle, horarios = clases elegidas |
| J07 reagendar solo canceladas | decisión | El par 3-4 sigue vivo: **cualquier** llamada posterior a la penalización (otra falta, aunque no sea seguida, o el cron) vuelve a cancelar las 7 recién reagendadas |
| J08 / S16 atomicidad | ❌ (código) | `reagendarClasesPenalizadas()` mueve clase por clase y guarda el historial al final: si un horario choca a mitad, quedan unas movidas, otras no y sin historial |
| J11 desmarcar todas | ✅ | "Seleccionar Horarios (0)" deshabilitado |
| J12 volver | ❌ | Con 8 de 10 marcadas → paso 2 "Reagendar 8 Clases" → "Volver" → vuelven las 10 marcadas (`ngOnInit` re-preselecciona todo) |
| P02 penalizado en el Dashboard | ✅ (código) | Las canceladas no entran (`VALID_CLASS_B_SESSION_STATUSES`) |
| P03 justificada en el Dashboard | ❌ | El panel dice "No Asistió" (solo mira `no_show`) y Asistencia "Justificada" |
| P04 reagendada | ✅ (código) | Etiqueta por estado de la sesión → "Por Iniciar" |
| P05 alertas | ❌ | Ver H02 |

No ejecutados: G08 (falla de BD, cubierto por `fix-362-m`), H06/H08 (regresión de `fix-364-m` y
`fix-365-m`), H10, J06 completo (cubierto por `e2e/alumnos-b-ficha.spec.ts` y `fix-299/300/301-m`).

**Observación:** `class_b_reschedule_history` existía en la BD (con RLS admin/secretaria) sin
ninguna migración que la creara → `hotfix-151-m` la versiona (migración idempotente, sin efecto en dev).

### Bloque 4 — Dashboard y otros módulos, Ciclos Teóricos, sedes y roles, 2 sesiones, visual (2026-10-12)

Datos sembrados (`b4-seed.cjs`, ids en `b4-seed.json` del scratchpad de la sesión `af19f3b0`): 9
alumnos `E2E-AsisB4*` con una clase el 12-10 (8 en sede 1 con Instructor1/Instructor2, 1 en sede 2);
`E2E-AsisB4Doce` con 11 clases cerradas antes; `E2E-AsisB4Dos1` con faltas en las clases 1 y 2 y la
3 a futuro. Ejecutado con scripts de Playwright (`b4-*.cjs`): admin, secretaria de sede 1 y
secretaria multi-sede; los casos de 2 sesiones con dos contextos de navegador.

| Caso | Res. | Evidencia |
|---|---|---|
| K01 alerta del Dashboard | ✅ | "N alumnos con 2 inasistencias seguidas": sube de 63 a 64 al sembrar las faltas 1-2 de `Dos1`; las 8 clases de hoy sin registrar no cuentan (regresión de `fix-364-m`) |
| K02 "Borrar horarios" | ✅ | Pide confirmación con el detalle ("Se cancelará 1 clase futura de 1 alumno: E2E-AsisB4Dos1…"); "Volver" no cancela nada (24 agendadas antes y después). Sin clases futuras avisa "No hay clases futuras que cancelar" |
| K03 Dashboard Ejecutivo vs Asistencia | ✅ (código) | El ejecutivo cuenta filas `absent` (incluidas las archivadas por reagendar, DG-075) y no cuenta las justificadas. Anotado: las fecha por el día en que se registraron, no por el día de la clase |
| K04 12/12 cerradas desde Asistencia | ✅ | `E2E-AsisB4Doce`: iniciar y finalizar la clase 12 → `certificate_enabled = true` y aparece en Certificación "12/12 · Pendiente · Generar" (regresión de `fix-262-m`) |
| K05 horas del instructor | ✅ | `instructor_monthly_hours` de Instructor1 en 2026-10 = 8 prácticas = las 8 `completed` del mes, incluida la cerrada desde Asistencia (trigger `trg_class_b_sessions_monthly_hours`) |
| L01 abrir el tab | ✅ | Autoselecciona el ciclo activo; grupos "Activos" / "Finalizados" |
| L02 sin ciclos | ✅ (código) | "No hay ciclos en esta sede todavía." |
| L03 cambiar de ciclo | ✅ | Clases 1-6 y roster del ciclo elegido; el buscador se limpia |
| L04 tema y enlace | ✅ | Toasts "Tema guardado" y "Enlace Zoom guardado"; persisten al recargar |
| L06 enviar sin enlace | ✅ | Botón deshabilitado |
| L07 destinatarios | ✅ | "Enviar a 15" → desmarcar uno → "Enviar a 14"; viajan solo los ids marcados. Envío real ya probado en el bloque 1 |
| L08 parcial / falla | ✅ | Respuestas simuladas: "Envío parcial — 14 enviado(s), 1 fallido(s)" y "Error al enviar los correos" |
| L10 mover a otro ciclo | ✅ | Sale del roster (15 → 14) y la BD queda con el ciclo nuevo |
| L11 mover a un ciclo de otra sede | ❌ | Admin en "Todas": el selector de destino ofrece los ciclos de las dos sedes; un alumno de Autoescuela Chillán queda en un ciclo de Conductores Chillán ("Alumno reasignado de ciclo") y la BD lo acepta (S18) → `fix-387-m` (cerrado: solo ofrece ciclos de la misma sede) |
| L12 incorporar | ✅ | 68 candidatos, ninguno de la otra sede; entra al roster |
| L13 "Actualizar" | ❌ | Tras mover un alumno y cambiar un tema desde otra sesión, "Actualizar" deja el roster (15) y el tema como estaban: `loadCycles()` no vuelve a leer el ciclo que sigue elegido (S18) → `fix-387-m` (cerrado) |
| L14 asistencia a teóricas | decisión | No existe registro de asistencia a las clases teóricas |
| M01 admin "Todas" | ✅ | Columna Sede y clases de las dos sedes |
| M02 admin cambia de sede | ✅ | Tabla, alertas (133 → 65) y ciclos recargan solos |
| M03 cambio rápido A→B→A | ✅ | Termina en A con sus 8 clases y su ciclo. Anotado: `CiclosTeoricosFacade` no tiene guard contra respuestas fuera de orden → `fix-387-m` (cerrado) |
| M04 secretaria multi-sede | ❌ | Tiene selector de sede en la barra; elige "Conductores Chillán" y Asistencia sigue mostrando las 8 clases y el ciclo de Autoescuela Chillán. La pantalla lee la sede del usuario una sola vez (S12, parte de pantalla) → `fix-385-m` (cerrado) |
| M05 secretaria sin sede | N/A | No existe en el negocio (decisión de Matías en `ASG-i-024`) |
| M07 admin → cerrar sesión → secretaria | ❌ | Sin recargar la pestaña, la secretaria ve las 9 clases del admin (incluida la de la otra sede) hasta que llega su propia respuesta: el facade conserva los datos del usuario anterior. También conserva la fecha elegida → `fix-386-m` (cerrado: skeleton hasta que llega lo suyo, y la pantalla abre en hoy) |
| N01 sin tiempo real | decisión | B no se entera de lo que hizo A hasta "Actualizar" |
| N02 A y B marcan ausente la misma clase | ✅ | Una sola fila de asistencia, sin error. Desde `fix-388-m` B recibe "La inasistencia ya estaba registrada" |
| N03 A inicia, B (sin actualizar) inicia | ❌ | B recibe "Clase iniciada" y pisa la hora y el km de A (22:28:45 / 2.085 → 22:29:49 / 2.090) → `fix-388-m` (cerrado) |
| N03-b A marca ausente, B inicia | ❌ | La clase queda "En curso" con su inasistencia vigente: el alumno sale en el rail de alertas con 1 falta mientras está en clase → `fix-388-m` (cerrado) |
| N03-c clase en curso, B la marca ausente | ❌ | Queda "Ausente" con hora y km de inicio (probado por API con la sesión de la secretaria) → `fix-388-m` (cerrado) |
| O01 claro / oscuro | ✅ | Badges, rail y modales legibles en los dos modos |
| O02 375 px | ✅ | La página no scrollea en horizontal; la tabla sí, dentro de la card; 6 filas + "Cargar más (2 restantes)"; rail debajo |
| O03 "Cargar más" | ✅ | Vuelve a 6 al cambiar filtro, tab o fecha |
| O04 drawer abierto | ✅ | Rail apilado debajo, 6 filas + "Cargar más", tabla con scroll horizontal |
| O05 solo teclado | ❌ | (a) Desde las pestañas, Tab recorre todas las alertas del rail (70) antes de llegar a la fecha, los filtros y la tabla: el HTML tiene el rail primero y lo reordena con CSS → `fix-389-m`. (b) Los modales no toman el foco: en "Marcar inasistencia" (confirmación global) el foco queda en el botón de atrás, Escape no lo cierra y sus botones no se alcanzan con Tab; en "Justificar" Escape sí cierra, pero Tab sale del modal → `fix-390-m` (cerrado). `fix-389-m` también cerrado |

No ejecutados: L05 y L09 (hechos en el bloque 1), M06 (bloque 1).

**Observaciones sin track:**
- El selector de destino de "Cambiar de ciclo" también ofrece ciclos finalizados de la sede.
- `enrollments.theory_cycle_id` no tiene candado en la BD: acepta un ciclo de otra sede si se
  escribe por fuera de la pantalla (`fix-387-m` lo cierra en la pantalla y en el facade).
- Los modales de eliminar alumno, eliminar servicio y el panel de notificaciones no usan todavía
  `appModalFocus` (`fix-390-m` cubrió la confirmación global y los de Asistencia B).
- Las pestañas "Prácticas / Ciclos Teóricos" no se recorren con las flechas; las dos se alcanzan
  con Tab.

**Datos dejados:** los 9 alumnos `E2E-AsisB4*` y sus clases siguen en la BD de dev (se borran
junto con los demás `E2E-Asis*` al cerrar el track). `E2E-AsisB4Dos1` tiene una clase agendada
el 2026-11-20 a las 06:00 con Instructor1.

## Decisiones de negocio

Tomadas por Matías el 2026-10-11:

| Caso | Decisión |
|---|---|
| P01 | **Sí:** la secretaria puede marcar "Ausente" desde "Clases Actuales" del Dashboard |
| C04 / D03 | **Sí, avisar:** km de salida menor al actual del vehículo y recorrido absurdo (+5.000 km) |
| C08 | **Se permite** iniciar antes de la hora (el alumno llega antes y lo acuerdan con el instructor) |
| Bloque 3 | La cancelación automática se activa **solo dentro de transacciones que se revierten**; ninguna sede de dev queda con la regla prendida |

| C06 | **Bloquear** iniciar con un vehículo que tiene otra clase en curso, igual que con el instructor → `fix-376-m` |
| E07 | **"Deshacer"** en una falta sin justificar: se archiva y la clase vuelve a "Pendiente"; las canceladas por penalización no vuelven solas (se avisa) → `fix-377-m` |
| E08 | **"Cancelar inicio"** en una clase en curso: vuelve a "Pendiente" sin hora ni km de inicio → `fix-378-m` |
| Todas | Aplican igual desde Asistencia y desde "Clases Actuales" del Dashboard |

Tomadas por Matías el 2026-10-12 (bloque 3):

| Caso | Decisión |
|---|---|
| G05 / S7 | Justificar una falta que causó la penalización **no** devuelve las clases: se reagendan desde la ficha (se avisa al justificar) |
| J07 | Un par de faltas que ya causó una penalización **no vuelve a contar**: reagendar solo las canceladas no deja al alumno expuesto a otra cancelación por esas faltas |
| I04 | El cierre nocturno marca inasistencias **solo en matrículas activas** |
| H03 / F09 | Durante el piloto **se oculta "Recordar"** (el alumno no ve notificaciones); la secretaria lo contacta por teléfono |
| F05 | Se mantiene "consecutivas" por número de clase (sin cambios) |

Tomadas por Matías el 2026-10-12 (bloque 4):

| Caso | Decisión |
|---|---|
| N01 | Asistencia B queda **sin tiempo real**: cada persona ve los cambios de la otra al actualizar (desde `fix-388-m` una pestaña vieja solo avisa) |
| L14 | Las clases teóricas **no llevan registro de asistencia** (ya documentado en `indices/DATABASE.md`, `class_b_theory_sessions`: "sin asistencia") |
| G09 | **No se exige certificado médico** para justificar en Clase B: basta el motivo |

Pendiente de Matías:

| Caso | Pregunta |
|---|---|
| H07 / H09 | Con la penalización ya aplicada, ¿siguen haciendo falta "Eliminar" y "Reactivar" en las alertas? |

## Progreso

- [x] Bloque 1 — Seguridad (2026-10-11)
- [x] Bloque 2 — Carga, tabla del día, iniciar/finalizar/ausente y Dashboard (2026-10-11)
- [x] Bloque 3 — Penalización, justificar, rail, cron, ficha y reagendar (2026-10-12)
- [x] Bloque 4 — K–O: Dashboard y otros módulos, Ciclos Teóricos, sedes y roles, 2 sesiones, visual (2026-10-12)
- [ ] Casos "Auto ✓" en `e2e/` y borrar los datos `E2E-Asis*` al cerrar

## Regression Test

- Casos "Auto ✓" del checklist en `e2e/` (suite de `0019-m`).

## Tracks generados

_(cada bug encontrado → su propio fix/hotfix)_

| Track | Causa | Estado |
|---|---|---|
| `fix-367-m` | S13: `send-zoom-email` envía a cualquier dirección para cualquier sesión (+ L05: guardar enlace no https) | ✅ cerrado 2026-10-11 |
| `fix-368-m` | S19: instructor lee y modifica la asistencia de cualquier clase | ✅ cerrado 2026-10-11 |
| `fix-369-m` | B03 orden por hora real + B05 clases de matrículas no activas | ✅ cerrado 2026-10-11 |
| `fix-370-m` | C02/C05 estado local tras iniciar + hora del navegador (y ARCH-27 `toTimeString`) | ✅ cerrado 2026-10-11 |
| `fix-371-m` | E06/S10 inasistencia antes de la hora (BD + facade) | ✅ cerrado 2026-10-11 |
| `fix-372-m` | A08/O04 columnas de la tabla se montan | ✅ cerrado 2026-10-11 |
| `fix-373-m` | S18: subtítulo, tasa, contadores, "hoy" congelado; D08 toast | ✅ cerrado 2026-10-11 |
| `fix-374-m` | P01: "Marcar ausente" desde "Clases Actuales" (drawer de Iniciar) | ✅ cerrado 2026-10-11 |
| `fix-375-m` | C04/D03: avisos de kilometraje al iniciar y finalizar | ✅ cerrado 2026-10-11 |
| `fix-376-m` | C06: un vehículo en dos clases en curso | ✅ cerrado 2026-10-11 |
| `fix-377-m` | E07: "Deshacer" una inasistencia sin justificar (Asistencia y Dashboard) | ✅ cerrado 2026-10-11 |
| `fix-378-m` | E08: "Cancelar inicio" de una clase iniciada por error | ✅ cerrado 2026-10-11 |
| `fix-379-m` | S8/P05/H02/G05/G06: el rail usa la regla de faltas seguidas, la fecha de la clase, se recalcula al justificar y avisa que las canceladas no vuelven | ✅ cerrado 2026-10-12 |
| `fix-380-m` | H03/F09: "Recordar" oculto en el piloto + texto "N falta(s) sin justificar" | ✅ cerrado 2026-10-12 |
| `fix-381-m` | J01/P03: fecha de la clase en la ficha y "Justificada" en Clases Actuales | ✅ cerrado 2026-10-12 |
| `fix-382-m` | J12: "Volver" del reagendamiento conserva la selección | ✅ cerrado 2026-10-12 |
| `fix-383-m` | J08/S16: reagendamiento masivo todo o nada (RPC `reschedule_class_b_sessions`) | ✅ cerrado 2026-10-12 |
| `fix-384-m` | J07/I04: un par ya penalizado no vuelve a contar; el cron solo toca matrículas activas | ✅ cerrado 2026-10-12 |
| `hotfix-151-m` | `class_b_reschedule_history` sin migración: se versiona (idempotente) | ✅ cerrado 2026-10-12 |
| `fix-385-m` | M04/S12: Asistencia de la secretaria multi-sede ignoraba el selector de sede | ✅ cerrado 2026-10-12 |
| `fix-386-m` | M07/S18: datos y fecha del usuario anterior en Asistencia; guard de respuestas viejas | ✅ cerrado 2026-10-12 |
| `fix-387-m` | L11/L13/M03: mover a un ciclo de otra sede, "Actualizar" no releía el ciclo, guard en Ciclos | ✅ cerrado 2026-10-12 |
| `fix-388-m` | N03: una pestaña sin actualizar pisaba el inicio, la inasistencia o el cierre de una clase | ✅ cerrado 2026-10-12 |
| `fix-389-m` | O05: el teclado recorría todas las alertas antes de llegar a la tabla | ✅ cerrado 2026-10-12 |
| `fix-390-m` | O05: los modales no tomaban el foco (confirmación global y modales de Asistencia B) | ✅ cerrado 2026-10-12 |
