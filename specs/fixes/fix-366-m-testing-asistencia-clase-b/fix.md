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

## Decisiones de negocio pendientes

_(se completa al ejecutar)_

## Regression Test

- Casos "Auto ✓" del checklist en `e2e/` (suite de `0019-m`).

## Tracks generados

_(cada bug encontrado → su propio fix/hotfix)_

| Track | Causa | Estado |
|---|---|---|
| `fix-367-m` | S13: `send-zoom-email` envía a cualquier dirección para cualquier sesión (+ L05: guardar enlace no https) | ✅ cerrado 2026-10-11 |
| `fix-368-m` | S19: instructor lee y modifica la asistencia de cualquier clase | ✅ cerrado 2026-10-11 |
