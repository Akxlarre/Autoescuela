# Tasks 0002-i — Cuadratura editable vía ajustes + egresos de combustible por vehículo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-06

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Crear migración `20260806010000_cuadratura_adjustments.sql`
  - **AC ref:** AC1, AC2, AC3, AC5
  - **DoD:**
    - [ ] Archivo creado con el naming y contenido ya definidos en `plan.md` §4
    - [ ] `CREATE TABLE IF NOT EXISTS cuadratura_adjustments` con `tipo CHECK IN
      ('gasto_olvidado', 'correccion_manual')`, `monto` con signo, `expense_id` nullable
    - [ ] `ENABLE ROW LEVEL SECURITY`
    - [ ] Policies SELECT/INSERT admin-only — **sin** policy de UPDATE/DELETE (inmutabilidad
      real a nivel BD, no solo UI)
    - [ ] SQL entregado en chat para que el usuario lo corra manualmente en Supabase (memoria de
      sesión: migraciones se dan en chat, no se auto-aplican)
    - [ ] Documentado en `indices/DATABASE.md`

- [x] **T1.2** — Crear DTO `core/models/dto/cuadratura-adjustment.model.ts`
  - **DoD:**
    - [ ] Interface `CuadraturaAdjustment` en PascalCase singular
    - [ ] Campos mapean 1:1 con `cuadratura_adjustments` (snake_case crudo)
    - [ ] Documentado en `indices/MODELS.md`

- [x] **T1.3** — Crear UI Model `core/models/ui/cuadratura-adjustment.model.ts`
  - **DoD:**
    - [ ] `CuadraturaAdjustmentRow` (con `tipoLabel`, `autorNombre`, `fecha` derivados)
    - [ ] `AjusteFormData` (payload del formulario del drawer)
    - [ ] Documentado en `indices/MODELS.md`

---

## Fase 2 — Capa Facade

- [x] **T2.1** — Escribir tests nuevos en `historial-cuadraturas.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC2, AC3, AC4, AC-E1, AC-E2
  - **DoD:**
    - [ ] Test: `totalVigente()` = original + Σ ajustes (mezcla de montos positivos/negativos)
    - [ ] Test: `totalVigente()` sin ajustes = igual al original (no rompe el caso actual)
    - [ ] Test: cambiar de cierre seleccionado resetea `ajustesCierre()` (no arrastra los del
      cierre anterior — riesgo identificado en `plan.md` §8)
    - [ ] Test: `registrarAjuste()` con `tipo='gasto_olvidado'` inserta en
      `cuadratura_adjustments` Y en `expenses` con `date` = fecha del cierre corregido
    - [ ] Test: `registrarAjuste()` con `tipo='correccion_manual'` inserta SOLO en
      `cuadratura_adjustments`, nunca en `expenses`
    - [ ] Test: `registrarAjuste()` sobre un cierre con `closed=false` es rechazado
      client-side (AC-E1)
    - [ ] Tests FALLAN (no hay implementación aún)

- [x] **T2.2** — Implementar en `historial-cuadraturas.facade.ts`: `_ajustesCierre` signal,
  `ajustesCierre` público, `fetchAjustes(cuadraturaId)`, `computed totalVigente`
  - **AC ref:** AC3, AC4
  - **DoD:**
    - [ ] Tests de T2.1 relacionados a lectura PASAN
    - [ ] `seleccionarCierre()` dispara `fetchAjustes()` y limpia `_ajustesCierre` antes de la
      nueva carga
    - [ ] `catchError`/try-catch con `ToastService` en `fetchAjustes()`
    - [ ] Documentado en `indices/FACADES.md`

- [x] **T2.3** — Implementar `registrarAjuste(datos: AjusteFormData)` en el mismo Facade
  - **AC ref:** AC1, AC2, AC3, AC6, AC-E1, AC-E3
  - **DoD:**
    - [ ] Tests restantes de T2.1 PASAN (`npm run test:ci`)
    - [ ] Valida `cierreSeleccionado()?.closed` antes de insertar (AC-E1)
    - [ ] Branch `gasto_olvidado`: INSERT en `expenses` primero (obtener `id`), luego INSERT en
      `cuadratura_adjustments` con `expense_id` resuelto
    - [ ] Branch `correccion_manual`: INSERT directo en `cuadratura_adjustments`, sin tocar
      `expenses`
    - [ ] `vehicle_id` del form sigue el mismo campo/columna que fix-006-i/hotfix-001-i — sin
      lógica nueva de selección (AC-E3)
    - [ ] Tras éxito: `refreshSilently()` → recarga `ajustesCierre()` del cierre actual
    - [ ] Toast de éxito/error vía `ToastService`
    - [ ] Documentado en `indices/FACADES.md`

---

## Fase 3 — Capa UI

- [x] **T3.1** — Crear `RegistrarAjusteCuadraturaDrawerComponent`
  (`features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component.ts`)
  - **AC ref:** AC1, AC2, AC3
  - **DoD:**
    - [ ] OnPush
    - [ ] Inyecta `HistorialCuadraturasFacade` + `FlotaFacade` (selector vehículo)
    - [ ] Selector de tipo (Gasto olvidado / Corrección manual) primero — el resto del form
      cambia según esta elección
    - [ ] Campos condicionales (categoría + vehículo) solo visibles/requeridos cuando
      `tipo === 'gasto_olvidado'`
    - [ ] Selector de vehículo replica el patrón visual/de datos de
      `RegistrarEgresoDrawerComponent` (mismo formato de opción, mismo `FlotaFacade.vehicles()`)
      — sin extraerlo a `shared/` todavía (regla de "recién al 3er duplicado")
    - [ ] Mensaje visible en el form: "este ajuste se sumará al {fecha del cierre corregido}" —
      mitigación del riesgo de `plan.md` §8 (admin corrigiendo un mes ya cerrado sin darse cuenta)
    - [ ] `data-llm-action="registrar-ajuste-cuadratura"` en el submit,
      `data-llm-description` en campos condicionales
    - [ ] Cierra el drawer vía `LayoutDrawerFacadeService` al guardar con éxito
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T3.2** — `registrar-ajuste-cuadratura-drawer.component.spec.ts`
  - **DoD:**
    - [ ] Test: `isGastoOlvidado()` computed refleja el tipo seleccionado
    - [ ] Test: validación bloquea submit si `tipo='gasto_olvidado'` y falta categoría
    - [ ] Test: validación NO exige categoría/vehículo si `tipo='correccion_manual'`

---

## Fase 4 — Conexión y animación

- [x] **T4.1** — Modificar `DetalleCuadraturaModalComponent`: botón "Registrar ajuste" + sección
  de ajustes existentes + las 2 cifras (original vs. vigente)
  - **AC ref:** AC1, AC4, AC5, AC6, AC7
  - **DoD:**
    - [ ] Botón visible **solo** si `authFacade.currentUser()?.role === 'admin'` (guard
      client-side — AC7; la RLS es el guard real)
    - [ ] Arqueo original se muestra exactamente igual que hoy, sin ninguna modificación (AC5)
    - [ ] Total vigente se muestra como cifra separada, calculado desde
      `facade.totalVigente()` — nunca sobrescribe la cifra original en pantalla
    - [ ] Lista de ajustes existentes: motivo, monto, autor, fecha (AC6) — usar `app-badge`
      para `tipoLabel`, mismo patrón que hotfix-001-i
    - [ ] Botón abre `RegistrarAjusteCuadraturaDrawerComponent` vía `LayoutDrawerFacadeService`
    - [ ] Loading/empty states cubiertos (cierre sin ajustes → sin sección vacía rota)
    - [ ] AC verificables manualmente en browser

- [x] **T4.2** — Confirmar que no hace falta animación GSAP nueva
  - **DoD:**
    - [ ] El modal ya anima su entrada como componente de drawer/modal existente — no se
      agrega un `animateBentoGrid()` nuevo porque esta sección no es un bento-grid raíz propio

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio
- [x] **T5.2** — `npm run test:ci` corre verde (Facade + drawer nuevo, sin regresión en los
  tests existentes de `historial-cuadraturas.facade` y `detalle-cuadratura-modal` si los hay)
- [ ] **T5.3** — QA manual del happy path + edge cases (`/verify`)
  - **AC ref:** todos
  - **Estado:** ⚠️ **NO ejecutada — gap aceptado explícitamente por el owner (2026-08-06)** para
    cerrar la spec hoy. Movida a `fix-018-i-mejorar-visual-editar-cuadratura` (creado al cierre
    de esta spec), que retoma esta QA como parte de su alcance.
  - **DoD (pendiente, heredado al fix nuevo):**
    - [ ] Golden path: ajuste "Gasto olvidado" con vehículo → aparece en el modal Y en
      Contabilidad > Gastos con la fecha del cierre corregido
    - [ ] AC-E1: ajuste sobre el día de HOY (sin cerrar) rechazado
    - [ ] AC-E2: dos ajustes seguidos sobre el mismo cierre se suman, no se pisan
    - [ ] AC7: Secretaria no ve el botón "Registrar ajuste"
    - [ ] Modo oscuro/claro del drawer nuevo y de la sección de ajustes en el modal

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` generado — veredicto ⚠️ PARCIAL (10/10 AC con evidencia
    automatizada, QA visual pendiente aceptada como gap por el owner)

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` con todo lo nuevo (COMPONENTS.md, FACADES.md,
  DATABASE.md, MODELS.md — hecho incrementalmente durante la implementación)
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T6.3** — `specs/.active` pasa a `fix-018-i-mejorar-visual-editar-cuadratura` (el fix
  nuevo que retoma la QA visual pendiente)

---

## Tareas descubiertas durante implementación

- [x] Agregar `closed: boolean` y `branchId: number | null` a `HistorialCierre` (ui model) —
  necesarios para el guard AC-E1 (`registrarAjuste` rechaza cierres no cerrados) y para insertar
  el `expenses.branch_id` correcto en el ajuste tipo "gasto olvidado". No estaban en el modelo
  original porque el historial nunca los había necesitado (la query ya filtraba `closed=true`
  implícitamente, sin exponerlo). `mapCierreToHistorial()` actualizado para mapearlos.

- [x] Mover la apertura del drawer (`LayoutDrawerFacadeService.open()`) de
  `DetalleCuadraturaModalComponent` al Facade (`HistorialCuadraturasFacade.abrirRegistrarAjusteDrawer()`,
  import dinámico) — el Architect Guard bloquea cualquier `inject(...Facade...)` nuevo en un
  `.component.ts` de `shared/`, incluso `LayoutDrawerFacadeService` (el regex matchea el
  substring "Facade" en cualquier posición del nombre de clase). Se replicó el patrón ya
  existente en `ServiciosEspecialesFacade.openAgregarServicioDrawer()` — un Facade puede
  orquestar la apertura de su propio drawer sin que el componente Dumb que dispara el click
  necesite inyectar el servicio de UI directamente. Ajuste de `plan.md` §5 (el diagrama decía
  que el modal llamaría al drawer directo), sin cambiar ningún AC ni el comportamiento visible.

- [x] UX del signo del ajuste (feedback de usuario, 2026-08-06): "no es intuitivo si estoy
  sumando o restando dinero". Se agregó a `RegistrarAjusteCuadraturaDrawerComponent`: (a) toggle
  explícito "Resta (faltó dinero)" / "Suma (sobró dinero)" — **obligatorio** para
  `correccion_manual`, sin default implícito; antes el campo `monto` tenía `Validators.min(1)` y
  nunca se podía enviar un valor negativo, así que una corrección que debía restar era
  literalmente imposible de registrar antes de este ajuste; (b) preview en vivo "El total vigente
  cambiará en +/-$X" bajo el campo monto; (c) label del monto cambia a "MONTO A DESCONTAR" cuando
  el tipo es "Gasto olvidado" (ahí el signo es siempre fijo, sin toggle). Al escribir el test de
  `montoConSigno()` con dos lecturas distintas en la misma instancia se detectó que `computed()`
  envolviendo una lectura plana de `FormControl.value` **no se re-evalúa** después de la primera
  lectura (sin señales productoras, Angular nunca lo marca stale) — se migró `isGastoOlvidado`,
  `isCombustible` y `montoConSigno` a leer signals derivados de `valueChanges` vía `toSignal()` en
  vez de `form.get('x')?.value` directo. 15/15 tests verdes (7 nuevos).

- [x] Quitar el KPI "Reg ID" (`d.id` crudo de `cash_closings`) del detalle de cuadratura —
  feedback de usuario (2026-08-06): no aporta nada a un admin/secretaria, era un ID interno de
  BD expuesto sin motivo. Preexistente al alcance de esta spec (ya estaba antes de esta sesión),
  se limpia de paso por estar tocando el mismo archivo/sección. Grid de KPIs ajustado de 4 a 3
  columnas (`md:grid-cols-3`).
