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
Asistencia. Se agrega la sección **P** al checklist: el flujo de asistencia completo visto desde
el Dashboard (iniciar, finalizar, inasistencias, penalización, clases colgadas, alertas). La
checklist `030` prueba la UI del panel; acá se prueba el **efecto de asistencia**. Dato de
partida, leído en código: el panel solo ofrece Iniciar/Finalizar
(`core/utils/live-class-action.utils.ts`), no "Ausente".

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

_(se completa al ejecutar cada bloque)_

## Decisiones de negocio pendientes

_(se completa al ejecutar)_

## Regression Test

- Casos "Auto ✓" del checklist en `e2e/` (suite de `0019-m`).

## Tracks generados

_(cada bug encontrado → su propio fix/hotfix)_
