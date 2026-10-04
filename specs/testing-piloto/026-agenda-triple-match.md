# Testing — Agenda Clase B y Triple Match

> **Asignación:** `ASG-i-026` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/agenda`, `/app/secretaria/agenda` (y la Agenda Semanal abierta como drawer
> desde el acceso rápido del dashboard de secretaria).
> **Incluye:** la Agenda Semanal (grilla, estados, leyenda, navegación, filtro, detalle de slot,
> sedes, tiempo real) y **todos los flujos que agendan o mueven una clase B**, probados contra las
> mismas reglas del Triple Match (alumno + instructor + vehículo sin choques):
> 1. **Matrícula presencial** (paso 2 del wizard, `ScheduleGridComponent`) — admin y secretaria,
>    también abierta como drawer desde la Base de Alumnos.
> 2. **Reprogramación individual** (ficha del alumno → Ficha técnica → "Reprogramar").
> 3. **Reagendamiento masivo** (ficha → "Reagendar Clases", solo con clases penalizadas/no asistidas).
> 4. **Iniciar clase** (cambio de vehículo al iniciar) e **Iniciar/Finalizar** como ciclo de vida
>    (Asistencia B, "Clases Actuales" del dashboard secretaria, "Agenda de Hoy" del dashboard admin).
> 5. **Eliminar / Reactivar horario** (alertas de Asistencia B).
> 6. Cron de fin de jornada (`no_show`) y penalización por 2 faltas consecutivas.
>
> **No incluye:** el portal Instructor por dentro (bloqueado en el piloto), la matrícula pública
> `/inscripcion` (bloqueada), el resto del wizard de matrícula (ver `023-matricula-presencial.md`),
> la pantalla de Asistencia B por dentro (ver `027-asistencia-clase-b.md`; aquí solo se prueban
> Iniciar/Finalizar y Eliminar/Reactivar horario como parte del ciclo de agenda).
>
> **Código leído para armar esta lista:**
> `features/admin/agenda/admin-agenda.component.ts`, `features/secretaria/agenda/secretaria-agenda.component.ts`,
> `features/agenda/agenda-slot-detail-drawer.component.ts`, `shared/components/agenda-semanal/`
> (`agenda-semanal`, `agenda-slot`), `core/facades/agenda.facade.ts`,
> `core/services/ui/agenda-settings.service.ts`, `core/utils/{agenda-week,vehicle-document-status,live-class-action,class-b-session-overdue,date}.utils.ts`,
> `core/facades/enrollment.facade.ts` (paso 2, reservas, confirmación, Realtime),
> `features/secretaria/matricula/secretaria-matricula.component.ts`,
> `shared/components/schedule-grid/` (`schedule-grid.component`, `schedule-grid.logic`),
> `core/facades/admin-alumno-detalle.facade.ts` (instructores, grilla, reprogramar, reagendar masivo),
> `features/admin/alumno-detalle/{reprogramar-clase-drawer,reagendar-clases-drawer,ficha-tecnica-drawer,components/ficha-tecnica}/`,
> `core/facades/asistencia-clase-b.facade.ts` (startClass, finishClass, remove/reactivateSchedule, markAttendance),
> `features/admin/asistencia/admin-{iniciar,finalizar}-clase-drawer.component.ts`,
> `shared/components/asistencia-clase-b-content/` (botones Iniciar/Finalizar),
> `features/secretaria/dashboard/secretaria-dashboard.component.ts`, `features/dashboard/daily-agenda-drawer/`,
> `core/facades/certificacion-clase-b.facade.ts` (conteo de prácticas evaluadas),
> `core/config/pilot-phase.config.ts`, `app.routes.ts`.
> Migraciones: `20260917110000_hotfix003…` (vista `v_class_b_schedule_availability` vigente),
> `20260811110000_fix152…` y `20260812150000_fix163…` (trigger anti doble agendado),
> `20260804120000_class_b_sessions_exclusion_mutua_instructor.sql`,
> `20260709120000_recover_class_b_absence_penalty_functions.sql` y `20260817120000_class_b_attendance_archived_at.sql`
> (cron `no_show` + penalización), `20260301000011_10_rls_policies.sql` (RLS de `class_b_sessions`),
> `20260723020000_fix_h027…` (RLS de `enrollments`), `20260308160000_enrollment_draft_resilience.sql`,
> `20260315100000_enable_realtime_class_b_sessions.sql`, `20260412000001_fix_certificate_b_trigger.sql`.
> Specs/fixes: `fix-152-m`, `fix-162-m`, `fix-164/165/166-m`, `fix-028-i`, spec `0004-m`, spec `0001-i`,
> `docs/UAT-PLAN.md` Paquete 3.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-026`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S21)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Importante:** la Agenda Semanal es **de solo lectura** desde `fix-017`: no agenda nada. Todo
  agendamiento ocurre en los flujos 1-5 de arriba. Por eso las reglas del Triple Match se prueban en
  la sección L (matriz regla × flujo), no en la Agenda.
- Muchos casos dependen de la hora real (cron a las 01:00 UTC = **22:00 hora Chile en horario de
  verano**, 21:00 en invierno). Planifica los casos de la sección M para ejecutarlos en la tarde y
  revisarlos al día siguiente.

---

## 0. Traspasado desde ASG-i-024 (Matías, 2026-10-04)

El testing de la ficha del alumno (`ASG-i-024`, track `fix-264-m`) dejó sin ejecutar los casos de
la agenda de reprogramar y del reagendamiento masivo, porque son de esta asignación. Se ejecutan
acá. Equivalencias con `024b-ficha-ex-alumnos.md`:

| Caso de `024b` | Se ejecuta acá como |
|---|---|
| F01 (lápiz en una clase agendada: pantalla e instructores de la sede) | I01, I02 |
| F02 (reprogramar a otro instructor y horario; libera y ocupa en la Agenda) | I03 |
| F03 (qué se ve mientras cargan los instructores) | I18 (nuevo) |
| F05 (instructor sin disponibilidad) | I19 (nuevo) |
| F06 (navegar semanas y días dentro del panel) | I20 (nuevo) |
| F09 (vehículo con documento vencido) | I12 |
| F10 (dos usuarios toman el mismo horario) | I15 |
| F12 (notificaciones al reprogramar) | I17 |
| F14 (doble clic en "Confirmar Reprogramación") | I16 |
| G03, G06, G08 (reagendar masivo: paso 1, razón, volver) | J02, J03, J04, J09 |
| G05, G10, G11 (ciclo completo, falla a mitad, penalización después) | J06, J05, J10 |

**Ya resuelto en `ASG-i-024`: ejecutar como regresión, no como sospecha.**

| Acá | Qué pasó | Track |
|---|---|---|
| S5 · I04 · L (alumno con 2 clases a la misma hora) | Confirmada y corregida. La grilla de la ficha (reprogramar y reagendar) ya no ofrece un horario que choca con otra clase agendada del alumno, y la base lo rechaza con un trigger (`trg_prevent_student_double_booking`), también desde la matrícula | `fix-299-m`, `fix-301-m` |
| S9 · I07 · I11 (reprogramar un `no_show` o una cancelada) | Corregida. Reprogramar archiva la asistencia anterior y deja el registro en el historial, con razón obligatoria. Decisión de Matías: se permite reprogramar individualmente | `fix-279-m` |
| I14 ("Cancelar") | Decidido y hecho: vuelve a la Ficha Técnica | `fix-279-m` |
| I05 · J07 (tope por día) | El tope es de 2 clases por día (`fix-062-m`). Desde `fix-300-m` cuentan agendadas, completadas e inasistencias; las canceladas no | `fix-300-m` |
| I08 (reprogramar una clase `in_progress`) | Sigue sin decidir | — |

Tests E2E que ya cubren parte de esto: `e2e/alumnos-b-ficha.spec.ts`, casos F04 · F11 · F13 · E09
y F07 (S20), más el de `fix-301-m` por API.

## 1. Sospechas de bug encontradas en el código

### Respuesta a la pregunta crítica: ¿quién inicia y cierra las clases en el piloto?

**Sí existe un flujo para admin y secretaria**, fuera del portal Instructor:

- **Asistencia B** (`/app/admin/asistencia` y `/app/secretaria/asistencia`, no bloqueadas en el piloto):
  cada clase `pendiente` del día (o de días pasados) tiene el botón **Iniciar**, que abre el drawer
  de KM inicial (con selector de vehículo), y cada clase `en_curso` tiene **Finalizar** (KM final +
  firmas opcionales). Evidencia: `asistencia-clase-b-content.component.ts:554-599`,
  `admin-iniciar-clase-drawer.component.ts:260-276` → `asistencia-clase-b.facade.ts:376-418`
  (`status='in_progress'`, `km_start`), `admin-finalizar-clase-drawer.component.ts:231-255` →
  `asistencia-clase-b.facade.ts:425-485` (`status='completed'`, `km_end`, asistencia `present`,
  `vehicles.current_km`).
- **Dashboard secretaria → "Clases Actuales"** (`secretaria-dashboard.component.ts:424-436`) y
  **dashboard admin → "Agenda de Hoy"** (`daily-agenda-drawer.component.ts:45-57`) abren los mismos
  drawers según el estado (`live-class-action.utils.ts:48-59`).
- La **Agenda Semanal no tiene acciones**: su drawer de detalle es solo informativo
  (`agenda-slot-detail-drawer.component.ts:22-24`, único botón "Cerrar detalle").

Aun así el riesgo operativo es alto (S1): el flujo existe, pero **depende de que la secretaria
inicie cada clase el mismo día**; lo que no se inicia queda `no_show` esa noche y dos faltas seguidas
cancelan toda la agenda futura del alumno. Y la **evaluación/nota** de la clase es exclusiva del
instructor (comentario en `asistencia-clase-b.facade.ts:421-424`), cuyo portal está bloqueado.

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Todo el ciclo de la clase queda en manos de la secretaria, en tiempo real.** Con el portal Instructor bloqueado, una clase que nadie "Inicia" en Asistencia B antes del cron (01:00 UTC ≈ 22:00 Chile en verano) pasa a `no_show` con asistencia `absent`, y el cron llama a la penalización: 2 faltas consecutivas **cancelan todas las clases futuras** del alumno. Además, la clase cerrada por la secretaria nunca tiene nota (`evaluation_grade`), y Certificación cuenta las prácticas **con nota** para el progreso. Las clases `in_progress` que nadie cierra quedan abiertas para siempre (por diseño, spec `0001-i`) y bloquean la siguiente clase de ese instructor. | cron: `20260817120000_class_b_attendance_archived_at.sql:119-156`, `20260709120000_…:146-150`; penalización: `20260817120000:69-94`; sin nota: `asistencia-clase-b.facade.ts:421-424`; Certificación: `certificacion-clase-b.facade.ts:459-464`; exclusión mutua: `20260804120000_…:9-18` |
| S2 | 🟠 Media | **Se ofrecen como "disponibles" horarios que ya pasaron hoy.** La vista genera slots desde `CURRENT_DATE` sin filtrar `slot_start > now()`, y ninguna grilla filtra el pasado (solo ponen tope superior). Se puede agendar/reprogramar una clase a las 08:30 cuando ya son las 16:00 → esa noche el cron la marca `no_show` → falta falsa que cuenta para la penalización. | vista: `20260917110000_hotfix003…:52-56`; `enrollment.facade.ts:844-852`; `admin-alumno-detalle.facade.ts:1336-1344` |
| S3 | 🟠 Media | **El horizonte real es 28 días, pero la app promete meses.** La vista solo genera 28 días; el límite de la Agenda es de 2/3/4 meses (default 3). En la Agenda se lee "Mostrando horarios hasta el …" y se puede navegar ~13 semanas, pero desde la semana 5 no hay ningún horario "Disponible". Los comentarios del código dicen "la vista devuelve un superset de 4 meses" (falso). Además el límite se guarda en `localStorage`: cada computador puede tener un límite distinto. | `hotfix003…:52-56`; `agenda-settings.service.ts:8,21,28-36,52-63`; `enrollment.facade.ts:849-850`; `agenda-semanal.component.ts:195-199` |
| S4 | 🟠 Media | **La BD solo impide el doble agendamiento del INSTRUCTOR.** El trigger no revisa vehículo ni alumno, y no se dispara al cambiar `vehicle_id`. Tampoco es una constraint real: bajo concurrencia, dos inserciones casi simultáneas pueden pasar ambas el `EXISTS` (no hay lock ni `EXCLUDE`). La vista sí considera el vehículo, pero solo al leer. | `20260811110000_fix152…:17-24,36-40`; `20260812150000_fix163…:25-36` |
| S5 | 🟠 Media | **Un alumno puede quedar con 2 clases a la misma hora** (con 2 instructores distintos). La grilla es por instructor y solo bloquea días en que el alumno ya tiene **2 o más** clases; con 1 clase ese día, la misma hora sigue "disponible" con otro instructor. En el masivo, el tope de 2 por día no suma las clases que el alumno ya tiene ese día. | `admin-alumno-detalle.facade.ts:1666-1679,1700-1712`; `admin-reagendar-horarios-drawer.component.ts:118` |
| S6 | 🟠 Media | **Secretaria ve "libre" un horario ya ocupado en la otra sede** (instructor/vehículo "ambas sedes"). La vista es `security_invoker` y su chequeo de conflicto une `enrollments`, cuya RLS le oculta a la secretaria las matrículas de la otra sede → la clase de la sede 1 no cuenta como conflicto para la secretaria de la sede 2. Al guardar, el trigger (que sí ve todo) rechaza. El AC4 de spec `0004-m` se aceptó con "validación SQL directa", no probado como secretaria. | `hotfix003…:68-77,88`; `20260723020000_fix_h027…:36-48`; `specs/specs/0004-m…/spec.md:75-78,222-223` |
| S7 | 🟠 Media | **En la matrícula no aparecen los instructores "ambas sedes" de la otra sede.** `EnrollmentFacade.loadInstructors()` filtra solo por `users.branch_id`; `fix-028-i` corrigió solo el picker de la Agenda y el de la ficha ya lo tenía. Tampoco excluye instructores de tipo teórico. | `enrollment.facade.ts:798-811` vs `agenda.facade.ts:469-488`, `admin-alumno-detalle.facade.ts:1297-1317` |
| S8 | 🟠 Media | **Iniciar clase permite cambiar a cualquier vehículo sin controles del Triple Match:** solo lista vehículos de la sede (no los "ambas sedes"), no muestra la advertencia de SOAP/revisión técnica (fix-165 no llegó a este drawer) y no revisa si ese vehículo ya está en otra clase a esa hora (el trigger ignora `vehicle_id`). `startClass`/`finishClass` tampoco verifican el estado actual (una pantalla desactualizada puede reiniciar una clase ya iniciada o `no_show`), y `finishClass` pisa `vehicles.current_km` aunque el valor sea menor. | `asistencia-clase-b.facade.ts:350-355,386-391,430-454`; `admin-iniciar-clase-drawer.component.ts:91-107,221-226` |
| S9 | 🟠 Media | **La reprogramación individual se ofrece para cualquier clase no completada** (incluso `in_progress`, `no_show` y `cancelled`) y, a diferencia del masivo, **no archiva la asistencia** anterior ni deja historial de reagendamiento. Una clase `no_show` reprogramada puede seguir viéndose "Ausente" y contar para una nueva penalización (el mismo problema que corrigió `fix-191-m` en el masivo). | `admin-ficha-tecnica.component.ts:155-162,190-197`; `admin-alumno-detalle.facade.ts:1380-1390` vs `1572-1576,1593-1597` |
| S10 | 🟠 Media | **El reagendamiento masivo no es atómico.** Actualiza clase por clase y escribe el historial al final: si la 3ª falla (p. ej., el trigger detecta un choque), las 2 primeras ya quedaron movidas, sin historial, y la pantalla muestra solo el error. | `admin-alumno-detalle.facade.ts:1545-1564,1593-1597` |
| S11 | 🟠 Media | **La Agenda nunca muestra errores.** Las 2 consultas ignoran el `error` de Supabase (un timeout de la vista, ya visto en producción en `hotfix-003-i`, se ve como "semana sin horarios"), y ninguna de las 2 pantallas usa el signal `error` del facade. Igual en la grilla de reprogramación ("Sin disponibilidad"). | `agenda.facade.ts:381-390,417-418`; `admin-agenda.component.ts:23-41`; `secretaria-agenda.component.ts:15-33`; `admin-alumno-detalle.facade.ts:1336` |
| S12 | 🟠 Media | **Seguridad: cualquier secretaria puede leer, crear, modificar y borrar clases de cualquier sede.** Las políticas de `class_b_sessions` solo miran el rol, no la sede, y ninguna migración posterior las cambió. La Agenda filtra por sede del lado del cliente. | `20260301000011_10_rls_policies.sql:346-364` |
| S13 | 🟠 Media | **"Reactivar horario" revive TODAS las clases canceladas** de la matrícula: también las canceladas por la penalización de 2 faltas (se salta el flujo "Reagendar Clases") y las de fechas ya pasadas, que vuelven a `scheduled` en el pasado → el cron las marca `no_show` esa noche → nueva penalización. Si una sola choca con otra clase, el UPDATE completo falla. | `asistencia-clase-b.facade.ts:277-299` (UPDATE en 281-285) |
| S14 | 🟡 Baja-Media | **Matrículas en curso "esconden" horarios.** Las clases `reserved` de un borrador de matrícula bloquean el slot en la vista, pero la Agenda no las muestra (filtra `reserved`) → hueco sin "Disponible" ni clase. Y un borrador **expirado** (14 h) deja de bloquear en la vista pero el trigger lo sigue contando hasta la limpieza de las 03:00 UTC → el slot aparece libre y al guardar falla con "El instructor ya tiene una clase agendada…". | `agenda.facade.ts:413`; `hotfix003…:74`; `fix163…:29`; `enrollment.facade.ts:2325-2327`; `20260308160000_…:45-46,75-78` |
| S15 | 🟡 Baja-Media | **No se puede ver la agenda de todos los instructores a la vez.** El facade siempre preselecciona el primer instructor y el select no tiene opción "Todos" ni botón para limpiar → la "vista maestra" (celdas con "N libres · N ocup.") es inalcanzable. | `agenda.facade.ts:501`; `agenda-semanal.component.ts:206-216,1038` |
| S16 | 🟡 Baja | **Secretaria con grant multi-sede:** su Agenda no recarga al cambiar de sede (la de admin sí tiene el `effect`). Además, los vehículos "ambas sedes" registrados en la otra sede aparecen como "V12" (el mapa de patentes solo carga los vehículos de la sede activa). | `secretaria-agenda.component.ts:42-45` vs `admin-agenda.component.ts:51-56`; `agenda.facade.ts:424-425,535,556` |
| S17 | 🟡 Baja | **Tiempo real sin freno:** cada cambio en cualquier clase de cualquier sede vuelve a consultar la semana completa (2 consultas, una de ellas la vista pesada), sin debounce. Confirmar una matrícula (12 filas) dispara 12 recargas. Tampoco recarga los nombres: un instructor o vehículo creado después se ve como "#12"/"V5". | `agenda.facade.ts:355-363` vs debounce de `enrollment.facade.ts:2011-2038` |
| S18 | 🟡 Baja | **La Agenda promete lo que no hace:** los slots libres dicen "Clic para agendar" (aria-label) y tienen `data-llm-action="schedule-class"`, pero abren un detalle de solo lectura. En ese detalle, la etiqueta de estado de "Agendada" y "En progreso" usa el token `--state-brand`, que no existe → la pastilla sale sin color. | `agenda-slot.component.ts:39,283`; `agenda-slot-detail-drawer.component.ts:247-255` |
| S19 | 🟡 Baja | **Horarios duplicados para instructor + vehículo "ambas sedes":** la vista genera una fila por sede para el mismo horario → la Agenda puede mostrar "2 libres" de un solo instructor y repetir claves en el `@for` (advertencia de Angular en consola). | `hotfix003…:24-33,47-51`; `agenda.facade.ts:527`; `agenda-semanal.component.ts:327,382` |
| S20 | 🟠 Media | **Vehículo en mantención sigue ofreciendo horarios** (la vista no mira `vehicles.status`), y la advertencia de documentos se calcula con la fecha de **hoy**, no la de la clase: un SOAP que vence en 45 días no avisa en una clase agendada para dentro de 60. | `hotfix003…:49-51`; `vehicle-document-status.utils.ts:4-10` |
| S21 | 🟡 Baja | **Matrícula concurrente:** al "Continuar" el paso 2, primero se borran las reservas propias y después se insertan las nuevas; si el insert choca, el borrador se queda sin reservas. Si otra secretaria toma un horario elegido, el tiempo real lo desmarca **sin aviso** (el contador baja de 12 a 11). Al confirmar la matrícula, el cambio `reserved → scheduled` ignora el error. | `enrollment.facade.ts:1055-1072,2029-2037,1446-1450` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente con el seed de spec `0008-i` + ajustes). Anotar aquí el
nombre/patente/RUT real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Instructor A (sede 1) con vehículo asignado activo, documentos vigentes | Caso "todo OK" | |
| D2 | Instructor B (sede 1) cuyo vehículo tiene **SOAP vencido** | Advertencia en los flujos | |
| D3 | Vehículo con **revisión técnica que vence en ≤ 30 días**, y otro que vence en 31-60 días | "Por vencer" y S20 | |
| D4 | Instructor C `both_branches = true` (sede principal 1) con vehículo `both_branches = true` | Multi-sede, S6, S7, S19 | |
| D5 | Instructor D `both_branches = true` con vehículo **no** "ambas sedes" | Sede sin horarios | |
| D6 | Instructor sin vehículo asignado; instructor de tipo teórico | No deben aparecer | |
| D7 | Instructor **inactivo** con clases futuras agendadas | Nombre en la Agenda, clases huérfanas | |
| D8 | Vehículo en estado `maintenance` asignado a un instructor activo | S20 | |
| D9 | Alumno B1 (sede 1) con 12 clases `scheduled`, varias esta semana | Grilla, reprogramación | |
| D10 | Alumno B2 con 1 clase `no_show` (no penalizada) | Reprogramar un no_show (S9) | |
| D11 | Alumno B3 con 2 faltas consecutivas → clases `cancelled` por penalización | Reagendar masivo, S13 | |
| D12 | Alumno B4 con 1 clase a las 10:10 con instructor A | Doble agendamiento del alumno (S5) | |
| D13 | Clase `in_progress` de un día anterior ("colgada") | Exclusión mutua, aviso de atraso | |
| D14 | Clase `completed` con KM inicio/fin y observaciones | Detalle de slot | |
| D15 | Borrador de matrícula en curso con clases `reserved`; borrador con > 14 h sin limpiar | S14 | |
| D16 | Alumno de sede 2 con clase agendada con el instructor C (D4) | S6 | |
| D17 | Semana con clases en todos los estados (agendada, en curso, completada, no asistió) | Leyenda | |
| D18 | Un feriado dentro de las próximas 4 semanas | ¿Se ofrecen horarios en feriado? | |

**Cuentas:** admin; secretaria sede 1; secretaria sede 2; secretaria con grant multi-sede
(`can_access_both_branches = true`). **2 navegadores o perfiles distintos** para los casos de
concurrencia (2 pestañas del mismo navegador comparten sesión).

**Hora del equipo:** zona horaria de Chile. Los casos con "hoy" dependen de la hora real.

---

## 3. Casos

### A. Carga y acceso (Agenda)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/agenda` | Skeleton con forma de grilla → grilla. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/agenda` | Igual, solo datos de su sede | ✓ | |
| A03 | Secretaria escribe `/app/admin/agenda` | Acceso denegado | ✓ | |
| A04 | Menú lateral → Agenda (admin y secretaria) | Llega a la pantalla correcta | ✓ | |
| A05 | Salir y volver | Datos al instante, sin skeleton; se refrescan en segundo plano | — | |
| A06 | F5 | Carga normal, vuelve a la semana actual | ✓ | |
| A07 | Dashboard secretaria → acceso rápido "Agenda Semanal" | Abre la agenda en un drawer; funciona igual que la página y se ve bien dentro del drawer | — | |
| A08 | Carga con la red cortada **(§4)** | Mensaje de error claro (S11) | — | |
| A09 | Tiempo de carga con > 5 instructores | Carga en < 3 s; sin timeout de la vista (`hotfix-003-i`) | — | |
| A10 | Desktop | Página app-like: la grilla scrollea por dentro, el documento no | ✓ | |

### B. Grilla, estados y leyenda

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Columnas | Lunes a viernes, con el día de hoy destacado | ✓ | |
| B02 | Filas | Los 13 bloques (08:30 … 20:00) siempre, aunque la semana esté vacía | ✓ | |
| B03 | Semana sin clases | Grilla completa con textura de celda vacía, no una grilla colapsada | — | |
| B04 | Indicador "ahora" | En la semana actual, la fila de la hora actual tiene punto rojo; en otra semana no aparece | — | |
| B05 | D17: cada estado | Disponible (borde punteado), Agendada, En progreso (fondo sólido), Completada (verde), No asistió (tachado) | ✓ | |
| B06 | Leyenda | Los 5 estados de la leyenda coinciden en color con los slots | — | |
| B07 | Clases `cancelled` | No aparecen (el horario queda disponible si no hay otro choque) | ✓ | |
| B08 | Clase de un alumno en curso de matrícula (D15, `reserved`) | Hoy el horario desaparece: ni libre ni ocupado (S14). Anotar | — | |
| B09 | Nombre del alumno largo | Truncado sin romper la celda | — | |
| B10 | Hora de la clase = hora Chile | Una clase guardada a las 08:30 se ve en la fila 08:30 del día correcto | ✓ | |
| B11 | Clase de instructor inactivo (D7) | ¿Se ve? Hoy su nombre saldría como "#id" — anotar | — | |
| B12 | Advertencia de vehículo (D2, D3) | Triángulo amarillo en el slot con tooltip "Vehículo XX: SOAP vencido" / "… por vencer" | ✓ | |
| B13 | Vehículo "ambas sedes" de la otra sede (D4) | Muestra la patente, no "V12" (S16) | — | |
| B14 | Vehículo en mantención (D8) | ¿Ofrece horarios "Disponible"? (S20) — **decisión** | — | |
| B15 | Feriado (D18) | ¿Se ofrecen horarios ese día? — **decisión** | — | |
| B16 | Instructor + vehículo "ambas sedes" (D4) | Un solo "libre" por horario, no 2 (S19); consola sin advertencia de claves duplicadas | — | |

### C. Navegación de semanas y límite

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Flecha "Semana siguiente" | Avanza 1 semana; la etiqueta "d mmm – d mmm" es correcta | ✓ | |
| C02 | Flecha "Semana anterior" | Retrocede; se ven las clases pasadas | ✓ | |
| C03 | Botón "Hoy" | Solo aparece fuera de la semana actual; vuelve a ella | ✓ | |
| C04 | Llegar al límite | En la última semana con al menos un día válido, "siguiente" queda deshabilitado con tooltip "No se puede agendar más allá del …"; los días fuera del límite se ven rayados y sin clic | ✓ | |
| C05 | Clics rápidos en "siguiente" **(§4)** | Nunca pasa del límite; la grilla no "navega sola" después (regresión `fix-162-m`) | ✓ | |
| C06 | Semanas 5 a 13 | Hoy no hay ningún "Disponible" más allá de 28 días, aunque el texto diga "Mostrando horarios hasta el …" (S3) | ✓ | |
| C07 | Cambiar el límite en Ajustes (2/3/4 meses) | La Agenda respeta el nuevo límite | — | |
| C08 | Mismo usuario en otro computador | ¿Mismo límite? Hoy se guarda por navegador (S3) — **decisión** | — | |
| C09 | "Ir a fecha": elegir un día de otra semana | Salta a la semana de ese día | ✓ | |
| C10 | "Ir a fecha": fechas antes de hoy o después del límite | No se pueden elegir | ✓ | |
| C11 | "Ir a fecha": volver a elegir hoy estando en otra semana | ¿Salta? (el valor del control siempre es hoy) | — | |
| C12 | Retroceder muchas semanas | No hay tope; las semanas pasadas no muestran "Disponible" — confirmar que es aceptable | — | |
| C13 | Navegar con red lenta | Skeleton en cada cambio; nunca se mezclan clases de 2 semanas | — | |

### D. Filtro de instructor

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Al entrar | Hoy queda seleccionado el primer instructor de la lista | ✓ | |
| D02 | Ver todos los instructores a la vez | Hoy no hay opción "Todos" (S15) — **decisión** | — | |
| D03 | Cambiar de instructor | La grilla muestra solo sus horarios y clases | ✓ | |
| D04 | Lista del filtro | Instructores activos no teóricos de la sede + los "ambas sedes" de la otra | ✓ | |
| D05 | D6 (sin vehículo, teórico) | El teórico no aparece. El sin vehículo aparece con la grilla vacía — confirmar | — | |
| D06 | Instructor seleccionado → cambiar de semana | Se mantiene el filtro | ✓ | |
| D07 | Instructor seleccionado → salir y volver | ¿Se mantiene? — anotar | — | |
| D08 | Sede sin instructores | Estado coherente, sin errores | — | |
| D09 | Vista maestra (si se habilita) | Celdas con "N libres · N ocup."; clic expande y muestra cada slot; clic de nuevo colapsa | — | |

### E. Detalle de slot (drawer)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Clic en slot disponible | Drawer "Horario disponible": horario, instructor, vehículo. Sin botón de agendar (S18) | ✓ | |
| E02 | Clic en clase agendada | "Clase: Nombre": estado, horario, instructor, vehículo, alumno, Nº de clase | ✓ | |
| E03 | Pastilla de estado "Agendada" / "En progreso" | Tiene color (S18) | — | |
| E04 | Clase completada (D14) | Muestra KM inicio, KM fin, distancia y observaciones | ✓ | |
| E05 | Clase en progreso | ¿Muestra el KM inicial? (hoy solo se muestra en completadas) | — | |
| E06 | Clase "No asistió" | "No asistió" con estilo apagado | ✓ | |
| E07 | Día fuera del límite | Los slots no reaccionan al clic | ✓ | |
| E08 | Teclado: Tab + Enter/Espacio sobre un slot | Abre el detalle | — | |
| E09 | "Cerrar detalle" | Cierra el drawer | ✓ | |
| E10 | Abrir el detalle con la Agenda ya dentro de un drawer (A07) | Se apila y "volver" regresa a la agenda | — | |
| E11 | Desde el detalle, ¿se puede iniciar, cancelar o reprogramar? | No (solo lectura). **Decisión:** ¿debería haber un atajo a la ficha/asistencia? | — | |

### F. Sedes y multi-sede

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Admin "Todas las sedes" | Instructores y clases de ambas sedes | ✓ | |
| F02 | Admin cambia a sede 1, luego sede 2 | Recarga sola; la lista de instructores y la selección cambian a la sede elegida | ✓ | |
| F03 | Instructor "ambas sedes" (D4) visible en las 2 sedes **(§4)** | Aparece en el filtro de ambas (regresión `fix-028-i`) | ✓ | |
| F04 | Secretaria sede 2 | No ve clases de alumnos de la sede 1 | ✓ | |
| F05 | Secretaria sede 2 y horario ocupado por D4 en la sede 1 **(§4)** | Se ve ocupado, no "Disponible" (S6) | — | |
| F06 | Secretaria con grant cambia de sede | La Agenda recarga sin salir de la pantalla (S16) | — | |
| F07 | Cambio rápido de sede A→B→A con red lenta | Termina en A sin mezclar datos | — | |
| F08 | D5 (instructor ambas sedes, vehículo de una sede) en la sede que su vehículo no cubre | Aparece en el filtro pero sin horarios — confirmar que es lo esperado | — | |

### G. Tiempo real y concurrencia (Agenda)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | 2 sesiones: matricular en A **(§4)** | Las clases aparecen en la Agenda de B sin recargar | ✓ | |
| G02 | 2 sesiones: iniciar y finalizar una clase en A | En B el slot pasa a "En progreso" y luego a "Completada" | ✓ | |
| G03 | 2 secretarias matriculan eligiendo el mismo horario **(§4)** | Solo una se queda con él; la otra recibe aviso claro (S21) | ✓ | |
| G04 | Confirmar una matrícula con la Agenda abierta en otra sesión | Sin ráfaga de recargas que congele la pantalla (DevTools → Network) (S17) | — | |
| G05 | Crear un instructor nuevo y agendarle una clase | En la Agenda abierta, ¿sale su nombre o "#id"? (S17) | — | |
| G06 | Salir de la Agenda | Se cierra el canal (DevTools → WS) | — | |
| G07 | Agenda abierta en la página y en el drawer del dashboard | Al cerrar uno, el otro sigue recibiendo cambios | — | |

### H. Flujo 1 — Matrícula presencial (paso 2)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Lista de instructores (secretaria sede 1) | Instructores activos con vehículo; con marca y patente | ✓ | |
| H02 | Instructor "ambas sedes" de la sede 2 (D4) matriculando en la sede 1 | Debe aparecer (S7) | ✓ | |
| H03 | Instructor teórico / sin vehículo (D6) | No aparecen | ✓ | |
| H04 | Elegir instructor | Grilla con semanas "Semana 1 de N", slots libres y ocupados | ✓ | |
| H05 | Horarios de hoy que ya pasaron **(§4)** | No se pueden elegir (S2) | ✓ | |
| H06 | Selección de 12 clases | Contador "N / 12"; al llegar a 12 no deja elegir más | ✓ | |
| H07 | Máximo 2 por día | El 3er horario del mismo día queda deshabilitado | ✓ | |
| H08 | Horizonte **(§4)** | Todas las semanas del límite configurado deberían tener horarios; hoy solo 4 (S3) | — | |
| H09 | Instructor con poca disponibilidad | Aviso "Este instructor tiene cupo en solo N días…" | ✓ | |
| H10 | Horario libre pero con borrador expirado (D15) **(§4)** | Se puede guardar; hoy falla con "El instructor ya tiene una clase…" (S14) | — | |
| H11 | Vehículo con SOAP vencido (D2) / por vencer (D3) | Triángulo amarillo con tooltip "Vehículo con SOAP vencido"; no bloquea (fix-165/166) | ✓ | |
| H12 | Horario ya ocupado por otra clase del instructor | Gris, no seleccionable (regresión `fix-152-m`) | ✓ | |
| H13 | Horario ocupado por el vehículo (clase de otro instructor con ese vehículo, tras reasignación) | Gris | — | |
| H14 | Alumno con otra matrícula B activa y clases agendadas | ¿Se le ofrecen horarios que chocan con sus clases existentes? (S5) | — | |
| H15 | Cambiar de instructor con horarios ya elegidos | Se limpia la selección; la grilla no queda con datos del instructor anterior | ✓ | |
| H16 | Cambiar de instructor rápido 3 veces con red lenta | La grilla final es la del último instructor | — | |
| H17 | Continuar → volver al paso 2 | Los horarios reservados siguen marcados como propios (no "ocupados") | ✓ | |
| H18 | Retomar un borrador | Instructor y horarios restaurados | — | |
| H19 | Confirmar la matrícula | Las 12 clases pasan a "Agendada" y aparecen en la Agenda | ✓ | |
| H20 | Descartar el borrador | Los horarios reservados vuelven a quedar libres | ✓ | |
| H21 | Matrícula desde el drawer de la Base de Alumnos | Mismo comportamiento que la página | — | |
| H22 | Refuerzo Clase B (6 clases) | Pide 6, no 12 | ✓ | |

### I. Flujo 2 — Reprogramación individual (ficha)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Ficha → Ficha técnica → "Reprogramar" en una clase agendada | Drawer "Reprogramar Clase" con "Clase #N — Nombre" | ✓ | |
| I02 | Lista de instructores | Sede del alumno + "ambas sedes" de la otra | ✓ | |
| I03 | Elegir instructor → horario → Confirmar | Toast "Clase reprogramada correctamente"; la ficha y la Agenda reflejan el cambio | ✓ | |
| I04 | Misma hora que otra clase del alumno, con otro instructor **(§4)** | Bloqueado (S5) | ✓ | |
| I05 | Día donde el alumno ya tiene 2 clases | Todos los horarios de ese día aparecen ocupados (sin explicar por qué) — anotar | — | |
| I06 | Horarios de hoy que ya pasaron | No se pueden elegir (S2) | ✓ | |
| I07 | Reprogramar un `no_show` (D10) **(§4)** | Deja de verse "Ausente" y no cuenta para penalización (S9) | — | |
| I08 | Reprogramar una clase `in_progress` | ¿Debería permitirse? Hoy vuelve a "Agendada" conservando el KM inicial (S9) — **decisión** | — | |
| I09 | Reprogramar una clase completada | No hay botón | ✓ | |
| I10 | Clase sin sesión (número sin agendar) | Crea la clase nueva | — | |
| I11 | Historial de reagendamientos después de I03 | ¿Aparece? Hoy la reprogramación individual no lo registra (S9) | — | |
| I12 | Vehículo con documentos vencidos | Triángulo con tooltip (fix-165) | ✓ | |
| I13 | Cambiar de instructor rápido y confirmar | Se guarda con el vehículo del instructor elegido, no del anterior | — | |
| I14 | "Cancelar" | Hoy cierra todo el drawer en vez de volver a la Ficha técnica — confirmar si es lo deseado | — | |
| I15 | Error al guardar (choque detectado por la BD) | Mensaje legible en el drawer, sin cerrar | — | |
| I16 | Doble clic en "Confirmar Reprogramación" | Una sola actualización | — | |
| I17 | Notificaciones | Se crean para el alumno y el instructor (aunque sus portales estén bloqueados) — confirmar si molesta | — | |
| I18 | Mientras cargan los instructores (traspasado de `024b` F03) | Se ve un estado de carga, no "No hay instructores disponibles" por un instante | — | |
| I19 | Instructor sin horarios (traspasado de `024b` F05) | "Sin disponibilidad", con explicación | — | |
| I20 | Navegar semanas y días dentro del panel (traspasado de `024b` F06) | Las flechas se deshabilitan en la primera y la última semana; al cambiar de semana se elige el primer día | — | |

### J. Flujo 3 — Reagendamiento masivo (ficha → "Reagendar Clases")

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Alumno sin clases penalizadas ni no asistidas | No aparece el botón | ✓ | |
| J02 | D11 | Botón "Reagendar Clases (N)"; paso 1 con checklist de clases | ✓ | |
| J03 | Paso 2 sin razón | "Selecciona una razón para el reagendamiento." | ✓ | |
| J04 | Razón "Otro" sin detalle | "Especifica el motivo cuando eliges 'Otro'." | ✓ | |
| J05 | Una clase falla a mitad del guardado **(§4)** | Todo o nada; hoy quedan cambios parciales sin historial (S10) | — | |
| J06 | Guardado exitoso | Clases en "Agendada", historial con fecha anterior/nueva, asistencia vieja archivada (no "Ausente") | ✓ | |
| J07 | Tope por día con una clase ya existente ese día | No deja 3 clases el mismo día (S5) | — | |
| J08 | Horarios de hoy ya pasados | No se pueden elegir (S2) | — | |
| J09 | Volver al paso 1 desde el paso 2 | Conserva la selección | — | |
| J10 | Después de reagendar, ¿la penalización vuelve a cancelar? | No (regresión `fix-191-m`) | — | |

### K. Flujo 4 — Iniciar y finalizar la clase (ciclo de vida)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Ciclo completo desde Asistencia B como secretaria **(§4)** | Agendada → En progreso → Completada; KM del vehículo actualizado; Agenda coherente | ✓ | |
| K02 | Mismo ciclo desde "Clases Actuales" del dashboard secretaria | Abre los mismos drawers y funciona igual | ✓ | |
| K03 | Mismo ciclo desde "Agenda de Hoy" del dashboard admin | Igual | — | |
| K04 | Iniciar: KM precargado | Trae el KM actual del vehículo | ✓ | |
| K05 | Iniciar: KM vacío, negativo o > 999.999 | Mensaje de error y botón deshabilitado | ✓ | |
| K06 | Iniciar cambiando a un vehículo ocupado a esa hora **(§4)** | Bloqueado o advertido (S8) | — | |
| K07 | Iniciar: selector de vehículo | ¿Incluye vehículos "ambas sedes"? ¿Advierte SOAP vencido? (S8) | — | |
| K08 | 2 secretarias inician la misma clase **(§4)** | La segunda recibe un aviso; no se pisan los datos (S8) | — | |
| K09 | Finalizar con KM menor o igual al inicial | "Debe ser mayor al inicial (N km)"; botón deshabilitado | ✓ | |
| K10 | Exclusión mutua: iniciar una 2ª clase del mismo instructor **(§4)** | "El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra." | ✓ | |
| K11 | Clase colgada de ayer (D13) | Se ve destacada como atrasada; se puede finalizar | — | |
| K12 | Iniciar una clase de las 08:30 a las 18:00 (retroactivo) | ¿Qué hora real queda registrada? Hoy la del clic — **decisión** | — | |
| K13 | Iniciar una clase de hoy que es a futuro (17:30, siendo las 09:00) | Hoy se permite — **decisión** | — | |
| K14 | Firmas: mostrar, firmar, ocultar | Opcionales; se guardan si se firmó | — | |
| K15 | Finalizar con red cortada | Mensaje de error en el drawer; la clase sigue "En curso" | — | |
| K16 | Nota/evaluación de la clase | Nadie puede registrarla en el piloto (portal Instructor bloqueado) (S1) — **decisión** | — | |
| K17 | Clase 12 completada | Se habilita el certificado (trigger), aunque las clases no tengan nota — ver en Certificación | — | |
| K18 | Doble clic en "Comenzar Clase" / "Cerrar Clase" | Una sola acción | — | |

### L. Matriz Triple Match: cada regla en cada flujo

Marcar ✅/❌ en cada celda. "—" = no aplica.

| Regla | H Matrícula | I Reprog. individual | J Masivo | K Iniciar (cambio de vehículo) | N Reactivar horario |
|---|---|---|---|---|---|
| L01 Instructor ya ocupado a esa hora → imposible | | | | — | |
| L02 Vehículo ya ocupado a esa hora → imposible (S4) | | | | | |
| L03 Alumno ya tiene clase a esa hora → imposible (S5) | | | | — | |
| L04 Horario ya pasado → no se ofrece (S2) | | | | — | |
| L05 Límite de fecha respetado (S3) | | | | — | — |
| L06 Máx. 2 clases por día del alumno | | | | — | |
| L07 Advertencia SOAP/revisión técnica visible | | | | | — |
| L08 Instructor "ambas sedes" disponible (S7) | | | | — | — |
| L09 Choque en la otra sede detectado por secretaria (S6) | | | | — | — |
| L10 Vehículo en mantención no se ofrece (S20) | | | | | — |
| L11 2 secretarias en paralelo → solo una gana | | | | | — |

### M. Cron de fin de jornada y penalización

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Clase de hoy sin iniciar **(§4)** | Al día siguiente está "No asistió" con asistencia "Ausente" (regresión `fix-163-m`) | — | |
| M02 | Clase en progreso sin cerrar | Al día siguiente sigue "En progreso" (a propósito) y bloquea al instructor (K10) | — | |
| M03 | 2 faltas consecutivas **(§4)** | Se cancelan las clases futuras; aparece "Reagendar Clases" en la ficha y alerta en Asistencia | — | |
| M04 | Clase completada | El cron no la toca | — | |
| M05 | Clase de mañana | El cron no la toca | — | |
| M06 | Una sola falta | No cancela nada | — | |
| M07 | Falta justificada antes de las 22:00 | ¿Evita la penalización? (el cron solo mira `scheduled`) | — | |
| M08 | Clase de las 20:00 terminada a las 20:45 sin iniciar en el sistema | Queda "No asistió" — riesgo operativo del piloto (S1) | — | |
| M09 | Clase en feriado (D18) | ¿Se marca "No asistió" si nadie la inicia? — **decisión** | — | |

### N. Flujo 5 — Eliminar y reactivar horario (alertas de Asistencia B)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | "Eliminar horario" | Pide confirmación; cancela solo las clases agendadas; los horarios quedan libres en la Agenda | ✓ | |
| N02 | "Reactivar horario" en un alumno penalizado (D11) **(§4)** | No debe revivir clases canceladas por penalización ni fechas pasadas (S13) | — | |
| N03 | Reactivar cuando otro alumno ya tomó uno de esos horarios | Mensaje claro de cuál choca; hoy falla todo con "Error al reactivar el horario" | — | |
| N04 | Eliminar y reactivar enseguida | Las clases vuelven a sus horarios originales | ✓ | |

### O. Seguridad (RLS y BD)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Secretaria sede 1 modifica una clase de la sede 2 desde la consola **(§4)** | Rechazado (S12) | ✓ | |
| O02 | Doble agendamiento del instructor por API **(§4)** | Rechazado por la BD (fix-152-m) | ✓ | |
| O03 | Doble agendamiento del vehículo por API **(§4)** | Rechazado (S4) | ✓ | |
| O04 | Secretaria sede 1 lee todas las clases (`/rest/v1/class_b_sessions` sin filtro) | 0 filas de la otra sede (S12) | ✓ | |
| O05 | Secretaria borra una clase de otra sede | Rechazado (S12) | — | |
| O06 | Inserción concurrente del mismo instructor/horario desde 2 contextos (Playwright) | Una sola fila (S4) | ✓ | |

### P. Visual, responsive y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Modo oscuro y claro | Slots, leyenda, pastillas y advertencias legibles | ✓ | |
| P02 | 375 px | Pestañas de día; un día visible a la vez; sin scroll horizontal | ✓ | |
| P03 | Móvil: día inicial | Hoy abre en lunes aunque hoy sea miércoles — **decisión** | — | |
| P04 | 768 / 1440 px | Sin scroll horizontal del documento | ✓ | |
| P05 | Toolbar en pantalla angosta | Navegación, "Ir a fecha", texto del límite y filtro no se superponen | — | |
| P06 | Solo teclado | Se llega a flechas, "Hoy", fecha, filtro y slots; el foco se ve | — | |
| P07 | Tooltips | Presentes en el triángulo de vehículo y en "siguiente" deshabilitado | — | |
| P08 | Animación de entrada y al cambiar de semana | Sin parpadeos ni saltos | — | |
| P09 | Consola | Sin advertencias de claves duplicadas en `@for` (S19) | ✓ | |

---

## 4. Casos con pasos numerados

### A08 — Error de carga visible

**Precondición:** sesión admin.
1. DevTools → Network → "Offline".
2. Navegar a Agenda (o cambiar de semana si ya estás ahí).
3. Mirar qué se muestra al terminar el skeleton.
4. Volver a "No throttling" y cambiar de semana.

**Esperado:** en el paso 3, un mensaje de error claro. Si solo se ve una semana vacía o sin
"Disponible", S11 confirmada. En el paso 4 carga normal. **Evidencia:** captura del paso 3.

### C05 — Clics rápidos en "Semana siguiente"

**Precondición:** límite en 2 meses (Ajustes); DevTools → Slow 3G.
1. Ir a la semana actual.
2. Hacer 15 clics seguidos y rápidos en "Semana siguiente".
3. Soltar el mouse y esperar 10 segundos sin tocar nada.
4. Anotar la semana mostrada y la fecha límite del texto "Mostrando horarios hasta el …".

**Esperado:** la semana final contiene la fecha límite o es anterior; nunca una semana completa
fuera de rango. En el paso 3 la grilla no cambia sola.

### F03 — Instructor "ambas sedes" visible en las 2 sedes

**Precondición:** D4.
1. Como secretaria sede 1, abrir Agenda → filtro de instructor → buscar a C.
2. Como secretaria sede 2 (otro navegador), lo mismo.
3. Como admin, elegir sede 1 y luego sede 2 en el topbar.

**Esperado:** C aparece en los 4 casos, con sus horarios de cada sede.

### F05 — Horario ocupado en la otra sede

**Precondición:** D4 y D16: el instructor C tiene una clase el lunes a las 08:30 con un alumno de
la **sede 1**.
1. Como secretaria **sede 2**, abrir la Agenda → filtro = C → semana de ese lunes.
2. Mirar el lunes 08:30.
3. Iniciar una matrícula de prueba en la sede 2 → paso 2 → instructor C → mismo lunes 08:30.
4. Si aparece libre, elegirlo (con los demás horarios) y presionar Continuar.

**Esperado:** en los pasos 2 y 3 el horario aparece ocupado. Si aparece "Disponible" y en el paso
4 sale "El instructor ya tiene una clase agendada que se solapa…", S6 confirmada. Descartar el
borrador al terminar.

### G01 — Tiempo real: matrícula nueva

**Precondición:** 2 navegadores distintos; B con la Agenda abierta en la semana y el instructor
que se va a usar.
1. En A, completar una matrícula Clase B con ese instructor, con al menos 1 clase esta semana.
2. Sin tocar B, esperar 5 segundos.
3. Si no aparece, recargar B.

**Esperado:** las clases aparecen en B sin recargar. El paso 3 separa "no llegó el evento" de
"no se guardó".

### G03 — 2 secretarias eligen el mismo horario al matricular

**Precondición:** 2 navegadores (la misma secretaria en ambos o 2 secretarias), mismo instructor.
1. En A y B, llegar al paso 2 de una matrícula con el mismo instructor.
2. En ambos, elegir el mismo horario (p. ej., miércoles 10:10) y completar los 12.
3. En A, presionar Continuar.
4. En B, mirar el contador y el horario (sin tocar nada) durante 5 segundos.
5. En B, presionar Continuar.

**Esperado:** en el paso 4, B ve el horario ocupado **y un aviso**; hoy se desmarca en silencio
y el contador baja a 11 (S21). En el paso 5, si B no alcanzó a ver el cambio, recibe un error
legible y sus otros horarios no se pierden. En la Agenda, el miércoles 10:10 tiene **una sola**
clase. Descartar ambos borradores al terminar.

### H05 — Horarios que ya pasaron hoy

**Precondición:** ejecutar después de las 12:00 de un día hábil.
1. Matrícula → paso 2 → instructor con horarios hoy.
2. Buscar el día de hoy en la grilla.
3. Intentar elegir el horario 08:30 de hoy.
4. Repetir en Reprogramar (ficha) y en la Agenda (ver si 08:30 de hoy dice "Disponible").

**Esperado:** los horarios pasados no aparecen o están deshabilitados. Si se pueden elegir, S2
confirmada (y esa clase quedaría "No asistió" esta noche). No confirmar la matrícula de prueba.

### H08 — Horizonte de agendamiento

**Precondición:** límite en 3 meses.
1. Matrícula → paso 2 → instructor con buena disponibilidad.
2. Anotar "Semana 1 de N" y la fecha del último día con horarios.
3. En la Agenda, avanzar hasta la semana 6 y mirar si hay "Disponible".

**Esperado:** coherencia entre el límite configurado y los horarios ofrecidos. Si la grilla termina
a los 28 días y la Agenda muestra semanas sin "Disponible" dentro del límite, S3 confirmada.

### H10 — Borrador expirado bloquea un horario "libre"

**Precondición:** un borrador de matrícula con clases reservadas creado hace más de 14 horas y
antes de la limpieza de las 03:00 UTC (medianoche hora Chile en verano). Anotar su instructor y un
horario reservado.
1. Nueva matrícula → paso 2 → ese instructor.
2. Verificar si el horario reservado del borrador aparece libre.
3. Elegirlo (con el resto) y presionar Continuar.

**Esperado:** o el horario aparece ocupado, o se puede guardar. Si aparece libre y al guardar sale
"El instructor ya tiene una clase agendada…", S14 confirmada.

### I04 — Alumno con 2 clases a la misma hora

**Precondición:** D12 (alumno B4 con 1 clase un día futuro a las 10:10 con el instructor A).
1. Ficha de B4 → Ficha técnica → "Reprogramar" en otra de sus clases.
2. Elegir el instructor B (otro).
3. Ir al día de la clase de las 10:10 y elegir 10:10.
4. Confirmar.
5. Revisar la Ficha técnica y la Agenda de ese día.

**Esperado:** en el paso 3, 10:10 bloqueado para ese alumno. Si se guarda y el alumno queda con 2
clases a las 10:10, S5 confirmada. Revertir la reprogramación al terminar.

### I07 — Reprogramar un "No asistió"

**Precondición:** D10 (alumno con 1 clase `no_show`, sin penalización).
1. Ficha → Ficha técnica → "Reprogramar" en la clase no asistida.
2. Elegir instructor y un horario futuro → Confirmar.
3. Revisar la Ficha técnica: ¿la clase dice "Ausente"?
4. Abrir Asistencia B en la fecha nueva: ¿la clase dice "Pendiente" o "Ausente"?
5. Revisar el historial de reagendamientos.

**Esperado:** la clase queda limpia ("Agendada"/"Pendiente"), la falta anterior queda como
histórico y aparece en el historial. Si sigue "Ausente" o no hay historial, S9 confirmada.

### J05 — Reagendamiento masivo con un choque a mitad

**Precondición:** D11 con 3 clases por reagendar; 2 navegadores.
1. En A, abrir "Reagendar Clases" → marcar las 3 → paso 2 → instructor X → elegir 3 horarios →
   razón. **No guardar.**
2. En B, agendarle al instructor X, por otro flujo (p. ej., Reprogramar de otro alumno), el
   **3er** horario elegido en A.
3. En A, presionar "Guardar Reagendamiento".
4. Revisar la Ficha técnica de D11 y el historial de reagendamientos.

**Esperado:** error claro y **ninguna** clase movida (todo o nada). Si las 2 primeras quedaron
movidas y no hay historial de ellas, S10 confirmada.

### K01 — Ciclo completo de una clase como secretaria (pregunta crítica)

**Precondición:** sesión secretaria sede 1; D9 con una clase hoy; anotar el KM actual del vehículo en Flota.
1. Menú → Asistencia → fecha de hoy → buscar la clase → "Iniciar".
2. Verificar el ticket (alumno, hora, instructor, patente) y el KM precargado.
3. Escribir el KM del odómetro → "Comenzar Clase".
4. Verificar el toast "Clase iniciada" y la fila en "En clase" con botón "Finalizar".
5. Abrir la Agenda: la clase debe verse "En progreso".
6. Volver a Asistencia → "Finalizar" → KM final mayor al inicial → "Cerrar Clase".
7. Verificar el toast "Clase finalizada" y la fila "Presente".
8. Agenda → clic en la clase → detalle con KM inicio, fin y distancia.
9. Flota → el vehículo muestra el KM final.
10. Ficha del alumno → el progreso práctico sumó 1.

**Esperado:** todo lo anterior. **Evidencia:** capturas de los pasos 5 y 8. Si algo falla aquí,
reportarlo como **P0 del piloto**: es la única forma de cerrar clases sin el portal Instructor.

### K06 — Iniciar cambiando a un vehículo ocupado

**Precondición:** 2 instructores con clase a la misma hora hoy, cada uno con su vehículo (V1, V2).
1. Asistencia → iniciar la clase del instructor 1 con V1 (normal).
2. Iniciar la clase del instructor 2 y, en el selector, elegir **V1**.
3. "Comenzar Clase".

**Esperado:** bloqueado o, como mínimo, advertido. Si se inicia sin aviso y quedan 2 clases con
V1 a la misma hora, S8 confirmada. Revisar también si el selector mostró la advertencia de
documentos de V1/V2.

### K08 — 2 secretarias inician la misma clase

**Precondición:** 2 navegadores con Asistencia abierta en hoy; la misma clase "Pendiente" en ambos.
1. En A, "Iniciar" con KM 10.000.
2. En B, sin recargar, "Iniciar" la misma clase con KM 10.500.
3. Revisar el KM inicial guardado (detalle en Agenda o Asistencia recargada).

**Esperado:** B recibe un aviso de que la clase ya fue iniciada; el KM inicial sigue en 10.000. Si
queda 10.500, S8 confirmada.

### K10 — Exclusión mutua del instructor

**Precondición:** instructor con 2 clases hoy (A a las 10:10, B a las 11:00).
1. Iniciar la clase A.
2. Sin finalizarla, iniciar la clase B.
3. Finalizar A.
4. Iniciar B.

**Esperado:** en el paso 2, error "El instructor ya tiene una clase en curso. Debe cerrarla antes
de iniciar otra." dentro del drawer. En el paso 4 funciona. (Regresión spec `0001-i`, AC1/AC5.)

### M01 — Cron: clase sin iniciar pasa a "No asistió"

**Precondición:** una clase de prueba agendada hoy (alumno de prueba), que nadie inicie.
1. Anotar su estado en la Agenda hoy (Agendada).
2. Al día siguiente, abrir la Agenda en esa semana.
3. Abrir la Asistencia del día anterior y la ficha del alumno.

**Esperado:** "No asistió" en la Agenda, "Ausente" en Asistencia y una inasistencia en la ficha.
Si sigue "Agendada", el cron falló (revisar `cron.job_run_details`).

### M03 — Penalización por 2 faltas consecutivas

**Precondición:** alumno de prueba con las clases N y N+1 agendadas hoy (o marcadas ausentes a mano)
y más clases futuras.
1. No iniciar ninguna de las 2 (o marcarlas "Ausente" en Asistencia).
2. Si fue a mano: verificar el toast "Agenda liberada por inasistencias".
3. Al día siguiente (o de inmediato si fue a mano), revisar la Agenda de las semanas siguientes.
4. Abrir la ficha del alumno.

**Esperado:** todas las clases futuras canceladas (desaparecen de la Agenda y sus horarios quedan
libres); en la ficha aparece "Reagendar Clases (N)". Continuar con J06.

### N02 — Reactivar horario en un alumno penalizado

**Precondición:** alumno de M03 (clases canceladas por penalización), con al menos una fecha ya pasada.
1. Asistencia → alertas → buscar al alumno → "Reactivar horario".
2. Revisar la Agenda y la Ficha técnica.

**Esperado:** no revive las clases canceladas por la penalización (esas se recuperan con "Reagendar
Clases") ni deja clases "Agendadas" en fechas pasadas. Si las revive, S13 confirmada — y esa noche
el cron las marcaría "No asistió".

### O01 — Secretaria modifica una clase de otra sede

**Precondición:** sesión secretaria sede 1; id de una clase de la sede 2 (desde la sesión admin).
1. Desde Asistencia, iniciar/finalizar cualquier clase propia de prueba y copiar la petición PATCH a
   `/rest/v1/class_b_sessions` ("Copy as fetch").
2. En Console, pegarla cambiando `id=eq.` por el id de la sede 2 y el body a `{"notes":"prueba"}`.
3. Ejecutar y luego revisar la clase como admin.

**Esperado:** 0 filas afectadas / error. Si la nota quedó guardada, S12 confirmada → **P0**
(también podría cambiar horarios o borrar clases de la otra sede). Borrar la nota al terminar.

### O02 — Doble agendamiento del instructor por API

**Precondición:** una clase existente del instructor X (anotar `scheduled_at`); sesión admin.
1. Copiar desde Network cualquier petición a `/rest/v1/class_b_sessions` ("Copy as fetch").
2. Cambiarla a un POST con una clase nueva del mismo instructor, mismo `scheduled_at`, otro
   `enrollment_id` de prueba.
3. Ejecutar.

**Esperado:** error "El instructor ya tiene una clase agendada que se solapa con este horario."
(regresión `fix-152-m`).

### O03 — Doble agendamiento del vehículo por API

Misma precondición que O02, pero con **otro instructor** y el **mismo `vehicle_id`** de la clase existente.
1. POST de la clase nueva con instructor Y, vehículo de X, mismo `scheduled_at`.
2. Ejecutar.
3. Repetir con PATCH de una clase existente de Y cambiando solo `vehicle_id`.

**Esperado:** ambas rechazadas. Si se guardan, S4 confirmada. Borrar la fila de prueba al terminar.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| K01 / K16 / M08 | Con el portal Instructor bloqueado, ¿la secretaria inicia y cierra **cada** clase en tiempo real? ¿Quién registra la nota/evaluación? ¿Se ajusta el cron o se suspende la penalización durante el piloto? |
| D02 / D09 | ¿La Agenda debe permitir ver todos los instructores a la vez? |
| C06 / H08 | ¿Cuál es el horizonte real de agendamiento: 28 días o el límite de 2/3/4 meses? |
| C08 | ¿El límite de la Agenda es una preferencia por computador o una regla de la escuela? |
| H05 / L04 | ¿Se puede agendar en una hora de hoy que ya pasó (p. ej., para registrar una clase hecha)? |
| L06 / J07 | ¿El máximo es 2 clases por día fijo, o `courses.max_classes_per_day`? ¿Cuenta las clases que el alumno ya tiene ese día? |
| B14 / L10 | ¿Un vehículo en mantención debe dejar de ofrecer horarios? |
| H11 / S20 | ¿La advertencia de documentos debe calcularse con la fecha de la clase? ¿Se debe **bloquear** agendar con SOAP vencido (circular sin SOAP es ilegal)? |
| B15 / M09 | ¿Cómo se manejan los feriados (horarios ofrecidos, clases agendadas, cron)? |
| B11 | ¿Qué pasa con las clases futuras de un instructor desactivado? |
| I08 / I11 | ¿Se puede reprogramar una clase en progreso, no asistida o cancelada desde la ficha? ¿Debe quedar en el historial? |
| K12 / K13 | Si la secretaria inicia tarde, ¿la hora real registrada es la del clic o la agendada? ¿Se puede iniciar una clase de hoy que todavía no llega? |
| N02 | ¿"Reactivar horario" debe revivir clases canceladas por penalización o de fechas pasadas? |
| E11 | ¿El detalle de una clase en la Agenda debería tener atajos (iniciar, reprogramar, ir a la ficha)? |
| P03 | En móvil, ¿la Agenda debe abrir en el día de hoy en vez del lunes? |
| I17 | ¿Se deben enviar notificaciones a alumnos e instructores cuyos portales están bloqueados? |
