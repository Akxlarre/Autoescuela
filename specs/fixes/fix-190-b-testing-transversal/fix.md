# Fix: Testing transversal — multi-sede, shell, tiempo real, responsive y modo oscuro
> id: fix-190-b-testing-transversal
> refs: ASG-i-037
> status: in_progress
> created: 2026-10-06

## Root Cause
[Heredado de ASG-i-037.] Track de **testing**, no de un bug puntual: ejecutar el checklist
`specs/testing-piloto/037-transversal-multisede-shell.md` (inventarios de edge functions, Realtime,
RLS, RPC y Storage; shell; selector de sede; barrido de rutas × rol × ancho × tema; hora de Chile;
errores; 2 pestañas; accesibilidad) y automatizar lo marcado "Auto ✓".

Regla de la tanda: **cada bug encontrado va a su propio fix/hotfix**; acá solo se registra el
resultado de cada caso (✅ / ❌ + evidencia). Una fuga entre sedes es **P0 inmediato**.

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-037). Criterios propios:

- **T1:** las sospechas S1–S15 quedan confirmadas, descartadas (con el track que las cerró) o como
  decisión pendiente.
- **T2:** el barrido de rutas (§3.B) queda en Playwright contra el build de producción.
- **T3:** las pruebas de API de la sección P que escriben se hacen en transacciones que se deshacen
  o con datos `E2E-` que se borran; nunca dejan cambios en datos reales.
- **T4:** cada ❌ tiene su propio track (fix/hotfix) o una decisión registrada.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- `npx playwright test e2e/barrido-rutas.spec.ts` contra el build de producción en `localhost:4200`.

## Sospechas — estado (2026-10-06)

| # | Resultado | Evidencia / track |
|---|---|---|
| S1 | ❌ **Confirmada y peor: ejecutable SIN sesión** | Como `anon`, `confirm_enrollment_with_payment` activó un borrador con un "pago" de $1 (prueba deshecha). Inventario: 12 funciones `SECURITY DEFINER` que escriben, todas con `EXECUTE` para `anon`. → **corregido en `fix-191-b`** (aplicado; PR #198) |
| P16 | ❌ Confirmada (mismo inventario) | `mark_end_of_day_*`, `cleanup_*`, `auto_transition_*`, etc. → `fix-191-b` |
| S2 | ✅ Descartada | La cerró `0047-b` (RLS por sede en `students`); su prueba pasa |
| S3 | ✅ Descartada | Sin sesión → **401** (`requireStaff`, `fix-043-i`, versión desplegada verificada) |
| S4 | ✅ Descartada | Sin sesión → **401**; el código exige admin (`requireStaff(['admin'])`) |
| S5 | Pendiente — de otra asignación | `audit_log` falsificable = punto 3 de **ASG-i-047** (Matías); nota dejada en esa asignación |
| S6 | ✅ Descartada | La cerró `fix-178-b` (`website-public` sin subida anónima ni sobrescritura entre sedes) |
| S7 | ❌ Confirmada → **decisión del owner** | Sin sesión, `public-enrollment` responde `load-instructors` (nombres + patentes) y `check-duplicate` (si un RUT tiene matrícula en curso: enumeración de alumnos). `reserve-slots`/`submit-pre-inscription` siguen en el código (no ejecutadas: escriben). `student-payment` conserva `reserve-slots`/`release-slots` legacy. → **cerrada en `fix-193-b`** (decisión del owner: cerrar; función desplegada v70 responde 503 sin el secret `PUBLIC_ENROLLMENT_ENABLED`; PR #203) |
| S8 | ✅ Descartada | La cerró `0047-b` (`standalone_*`, `instructor_advances`, `certificates`, `discount_applications`, `absence_evidence`, `school_documents`…) |
| S9 | ❌ Confirmada por código | `layout-drawer.component.ts` / `layout-drawer.facade.service.ts`: sin listener de Escape, sin cierre en `router.events`, sin `role="dialog"`/`aria-modal` (el único `role="dialog"` del shell es el del modal de confirmación) → **`hotfix-061-b`** (PR #200) |
| S10 | ❌ Confirmada por código | `app-shell.component.ts:118` pinta el mensaje del modal con `[innerHTML]` → **`hotfix-062-b`** (PR #201) |
| S12 | ❌ Confirmada por código | `BranchFacade` no escucha el evento `storage`: la sede elegida no se sincroniza entre pestañas hasta recargar → **decisión** (K03) |
| S15 | ❌ Confirmada por código | El selector de sede de Ajustes ("Sede activa") no mira `lockReason`/`disabledBranchIds` → **`hotfix-063-b`** (PR #202) |

## Barrido de rutas (§3.B) — `e2e/barrido-rutas.spec.ts`, build de producción, 2026-10-06

52 rutas (29 admin + 23 secretaria sede 2) × 3 celdas (375 claro, 1440 claro, 1440 oscuro) =
156 cargas, 5,8 min con 3 workers. Capturas por celda en `test-results/barrido-rutas-*`.
`E2E_BARRIDO_FULL=1` corre la matriz completa (6 celdas).

| Resultado | Rutas |
|---|---|
| ✅ 49/52 limpias en las 3 celdas | C1 consola sin errores · C2 red sin 4xx/5xx · C3 sin scroll horizontal · C4 app-like en 1440 |
| ❌ **B12 secretaria `/contabilidad/cuadratura`** | 1440/claro y 1440/oscuro: **no app-like**, `.shell-content` sobra **392 px**: "Egresos / Retiros" queda debajo de "Ingresos" y la página scrollea (la spec `0004-i` la dejó con Egresos en la columna derecha). → **`fix-192-b`** (PR #199) |
| ⚠️ B10 `/matricula` (admin y secretaria) | 1440: `.shell-content` 14 px más ancho que su caja; no se ve (tiene `overflow-x-hidden`) → observación menor, sin track |

**Limitación del barrido:** el admin corre con "Todas las sedes". En las pantallas que exigen elegir
sede (Caja Diaria, Nueva Matrícula) mide el selector de sede, no la pantalla real — por eso B12 admin
"pasó". El caso real de Caja quedó cubierto por la secretaria.

## Shell transversal (D, E, K, V, Y) — `e2e/transversal-shell.spec.ts`, build de producción, 2026-10-06

22/22 en 2,3 min (4 workers). Sin escrituras en la BD.

| Caso | Res. | Evidencia |
|---|---|---|
| D01 admin ve "Todas" + cada sede | ✅ | |
| D02 secretaria sin grant sin selector | ✅ | |
| D03 secretaria con grant ve ambas sedes | ✅ | |
| D04 sede sobrevive a F5 desde el primer render | ✅ | el `aria-label` del primer render ya dice la sede |
| D05 sede persistida inexistente → "Todas" y limpia | ✅ | |
| D09 Nueva Matrícula con "Todas" bloquea "Todas" | ✅ | en Ajustes también, tras `hotfix-063-b` |
| E01/E02 botón y Ctrl+K con foco; Escape cierra y limpia | ✅ | |
| E03 secretaria recién entrada encuentra a su alumno (H-031) | ✅ | búsqueda por RUT sin visitar la Base |
| E06 secretaria A no encuentra a uno de la sede B | ✅ | |
| E07 admin con sede A no ve a B; con "Todas", sí | ✅ | |
| E08 acciones rápidas de secretaria → `/app/secretaria/**` | ✅ | "pago", "agendar", "matrícula" |
| K01 cerrar sesión en la pestaña 1 → la 2 va a `/login` | ✅ | al navegar por el menú (SPA) |
| V02 recargar en oscuro sin flash | ✅ | `data-mode="dark"` ya en `DOMContentLoaded` (script anti-FOWT de `index.html`) |
| V05 `text-primary`/`-secondary`/`-muted` cortas | ✅ | grep en `src/app`: 0 (además lo bloquea ARCH-11) |
| V08 1440×700 app-like (Alumnos, Pagos, Agenda, Flota) | ✅ | ni el documento ni `.shell-content` scrollean |
| Y02 al navegar el foco va a `<main>` | ✅ | |
| Y03 botones de ícono del shell con nombre accesible | ❌→✅ | el de **perfil** tenía el `aria-label` en el host `<p-button>`: el `<button>` real quedaba sin nombre → **`hotfix-064-b`** (PR #204). El test pasa contra un build con ese hotfix |
| Y07 `data-llm-action` en los botones del shell | ✅ | |

## D07 — "Todas" = A + B (admin, 2026-10-06)

Exploración por UI (KPIs/contadores de cada pantalla con sede A, B y "Todas"):

| Pantalla | A | B | Todas | Res. |
|---|---|---|---|---|
| Alumnos (badge) | 66 | 66 | 132 | ✅ |
| Pagos — con deuda | 26 | 43 | 69 | ✅ |
| Ex-alumnos — egresados | 9 | 8 | 17 | ✅ |
| Flota — vehículos | 8 | 8 | 16 | ✅ |
| Instructores — todos | 8 | 8 | 16 | ✅ |
| Certificación — pendientes / alumnos | 76 / 76 | 71 / 73 | 147 / 149 | ✅ |
| Dashboard — alumnos con… | 25 | 22 | 47 | ✅ |
| Servicios especiales — catálogo | 1 | 1 | 1 | ✅ (catálogo global, sin sede) |

**P22 — filas con `branch_id` NULL** (tablas con esa columna):
- ❌ `special_service_sales` #3: venta del admin con "Todas" (2026-08-13) **sin sede** → no la ve la
  Caja ni los reportes de ninguna sede. El código actual la sigue permitiendo
  (`getActiveBranchId(true)` cae en `user.branchId`, que para el admin es `null`; la RLS de INSERT
  deja pasar al admin) → **`fix-194-b`** (PR #205). La fila #3 es un dato de QA ("Prueba AC-E1", $5.000) y las dos sedes tienen cerrada la caja del 06-08: asignarla descuadraría una de ellas → **el owner decidió dejarla así** (2026-10-06); solo se ve con "Todas".
- ⚠️ `cash_closings` #2–#5: cierres de abril del admin, $0, sin sede (anteriores a que la Caja
  exigiera sede, fix-230-m) → datos de prueba, sin efecto.
- ✅ `discounts` "Descuento Padre Hurtado", `school_documents` #1: globales a propósito.
- ✅ `users` (el admin) y `audit_log` (eventos del admin): esperables.

## T02 — Hora de Chile emulada (`transversal-shell.spec.ts`, 2026-10-06)

`timezoneId: America/Santiago` + `page.clock` el 6-oct; se abre "Registrar anticipo" y se lee la
fecha propuesta (sin guardar nada).

| Hora | Esperado | Obtenido | Res. |
|---|---|---|---|
| 15:00 (control) | 06/10/2026 | 06/10/2026 | ✅ |
| 23:30 | 06/10/2026 | **07/10/2026** | ❌ confirma **ASG-i-054** (de Matías, pendiente) en vivo → `knownBug` |

## D06 — Cambio rápido de sede (`transversal-shell.spec.ts`, 2026-10-06)

Carrera forzada: las consultas pedidas con la sede B tardan 4 s y las de la A final 0,3 s; se lee
la pantalla recién cuando no queda ninguna consulta a PostgREST en vuelo (con un tiempo fijo se
leía a mitad de carga). `--workers=1 --repeat-each=2`, build de producción.

| Pantalla | Guard (spec 0005-m) | Res. |
|---|---|---|
| Dashboard | ✅ `createRequestGuard` | ✅ 2/2 |
| Ex-Alumnos | ❌ | ❌ queda en "A" mostrando los egresados de B (8 en vez de 9) → **`fix-195-b`** (2/2 con el fix) |
| Pagos | ❌ | ❌ "con deuda" 43 (B) en vez de 26 (A) → **`fix-195-b`** |
| Certificación B | ❌ | ❌ "Pendientes" 71 (B) en vez de 76 (A) → **`fix-195-b`** |

Grep: ~19 facades branch-scoped más siguen sin guard (residuo de ASG-b-064 / spec 0005-m, que
cubrió una primera pasada) → **ASG-b-101** (PR #209) para confirmarlos con este test y corregirlos.
`fix-195-b` (PR #208): con el fix, D06 8/8 (`--workers=1 --repeat-each=2`).

## X01 — Pantallas sin red (secretaria sede 2, build de producción, 2026-10-07)

Con el shell ya cargado se cortan `rest/v1` y `functions/v1` (`route.abort('internetdisconnected')`)
y se navega por el menú lateral (SPA). Se busca un error visible en `<main>` o un toast, 8 s después.

| Pantalla | Res. | Qué muestra |
|---|---|---|
| Agenda | ✅ | "No se pudo cargar la agenda… Reintentar" (`fix-189-b`) |
| Alumnos | ⚠️ | "Error al cargar alumnos…", pero los KPIs del hero dicen 0 |
| Ex-Alumnos | ⚠️ | "Ha ocurrido un error inesperado…", KPIs en 0 |
| Libro de Clases | ✅ | "Error cargando promociones" |
| **Caja Diaria** | ❌ **grave** | Todo en $0 y "Caja Abierta", sin aviso. `fetchPayments()` ignora el `error` (`data ?? []`) y `cerrarCaja()` guarda esos totales: se puede cerrar el día con $0 |
| Pagos | ❌ | $0 y "0 con deuda", sin aviso |
| Reportes contables | ❌ | "Sin ingresos en este período" |
| Liquidaciones | ❌ | Nómina $0, "0 / 0" |
| Cursos singulares | ❌ | "No hay cursos que coincidan…" |
| Servicios especiales | ❌ | Ventas 0, $0 |
| Certificados | ❌ | Totales 0 |
| Documentos | ❌ | "Sin documentos aún" |
| Instructores | ❌ | "No hay instructores que coincidan…" |
| Asistencia | ❌ | Tasa 0%, todo 0 |
| Comunicación | ❌ | "Sin tareas en esta sección" |

Ninguna pantalla mostró un toast. Historial de cuadraturas y Notificaciones no tienen link directo
en el menú (no medidas). → **ASG-b-102** (lecturas fallidas que se muestran como "sin datos");
la Caja cruza con **ASG-i-048** (escrituras de Cuadratura, de i).

## X04 — Sesión expirada (`transversal-shell.spec.ts`, 2026-10-07)

| Variante | Res. | Qué pasa |
|---|---|---|
| Token vence (reloj +2 h) y la renovación falla (`invalid_grant`) | ✅ | Vuelve sola a `/login` en < 20 s, **sin toasts** (test `X04`) |
| Borrar el token de `localStorage` (lo del checklist) | ✅ con matiz | supabase-js conserva la sesión en memoria: la app sigue funcionando hasta recargar; con F5 → `/login` sin toasts. Es el comportamiento esperable del cliente, no un bug |
| Mensaje en el login | ⚠️ | `/login` muestra el "Bienvenido de vuelta" de siempre, sin "tu sesión expiró". Observación de UX, sin track (decisión del owner si se quiere) |

## Z — Rendimiento con D6 (secretaria sede 2, build de producción, 2026-10-07)

**D6 cargado** con `supabase/scripts/seed_d6_volumen.sql` (aprobado por el owner; se revierte con
`cleanup_d6_volumen.sql`). Sede 2: 318 alumnos, 1.104 clases, 537 pagos, 315 documentos. Sin efectos
en la operación: clases `cancelled` en 2025 (horas de instructores intactas: 798 → 798) y pagos con
fecha y `created_at` de 2025 (0 pagos con fecha de hoy). Ensayado antes en una transacción revertida.

| Caso | Res. | Medición |
|---|---|---|
| Z01 Dashboard, Alumnos, Pagos, Documentos, Caja, Asistencia, Ex-Alumnos, Reportes | ✅ | 0,5–2,3 s (3 corridas) |
| Z01 Certificados | ⚠️ | 2,9–3,6 s (consultas secuenciales; al borde de los 3 s) |
| Z01 **Agenda** | ❌ | **5,5–6,2 s**, estable. Una sola consulta: `v_class_b_schedule_availability` (4,8 s). Ver abajo |
| Z01 congelamiento | ✅ | Bloqueo del hilo principal ≤ 414 ms (Alumnos) |
| Z03 Tope de 1.000 filas | ✅ | Ninguna respuesta de PostgREST cortada en `0-999/` en las 10 pantallas |
| Z05 Buscador | ✅ | 157 ms la primera búsqueda (incluye carga de la Base), 94 ms la siguiente |
| Z02 / Z04 | — | No medidos (scroll fluido y memoria a 30 min: manuales) |

**Agenda:** no es por D6 (sus clases están canceladas y el índice parcial las excluye). `EXPLAIN
ANALYZE` impersonando a la secretaria: ~5 s; como superusuario, 0,2 s. La vista es
`security_invoker`: el `NOT EXISTS` de choques evalúa la RLS de `class_b_sessions` fila por fila
(`auth_user_role()` por fila, 4,7 ms por turno × 520 turnos) y **dos veces** (filtro + `CASE`).
Además, con RLS la secretaria no ve clases de la otra sede → un instructor/vehículo compartido
ocupado allá se le muestra **disponible**. → **`fix-196-b`**.
