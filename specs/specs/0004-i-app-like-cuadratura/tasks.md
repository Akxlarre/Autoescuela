# Tasks 0004-i — App-like: cuadratura (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-25

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Decisión de diseño previa (bloqueante, resuelta)

- [x] **T1.1** — Resolver dónde vive el estado del arqueo (`cantidades`, `notas`, `realizarArqueo`)
  - **DoD:**
    - [x] Decisión: sube a `CuadraturaFacade` (mutable público, mismo patrón que
      `fondoInicial`/`egresoTipoPreset` ya existentes en ese Facade) — necesario porque el
      Drawer nuevo (`ArqueoCierreDrawerComponent`) no es hijo de `cuadratura-content` (se
      renderiza vía `LayoutDrawerFacadeService.open()`, NgComponentOutlet) y el botón "Cerrar
      Caja" (que se quedó en el Hero de `cuadratura-content`) necesita leer si el arqueo
      habilita el cierre sin que el Dumb inyecte el Facade directo

---

## Fase 2 — Facade

- [x] **T2.1** — Subir estado y computeds de arqueo a `CuadraturaFacade`
  - **DoD:**
    - [x] Signals públicos: `cantidades`, `notasArqueo`, `realizarArqueo`
    - [x] Computeds públicos: `totalArqueo`, `diferenciaArqueo`, `puedeCerrarCaja`,
      `colorDiferenciaArqueo`
    - [x] `cerrarCaja()` cambia de firma: ya no recibe `CierrePayload` como parámetro — lo arma
      internamente (`buildCierrePayload()`) desde su propio estado
    - [x] `resetArqueoState()` privado, llamado tras un cierre exitoso — el conteo no debe
      arrastrarse al día siguiente
    - [x] `npm run test:ci` — 34/34 tests de `cuadratura.facade.spec.ts` siguen verdes (ninguno
      testeaba `cerrarCaja(payload)` directamente, cambio de firma sin breakage)

---

## Fase 3 — Componente Drawer nuevo

- [x] **T3.1** — Crear `ArqueoCierreDrawerComponent`
  - **AC ref:** AC2, AC3, AC4
  - **DoD:**
    - [x] `src/app/features/admin/contabilidad-cuadratura/arqueo-cierre-drawer.component.ts`
      (mismo patrón que `RegistrarEgresoDrawerComponent`: `app-drawer-form`, inyecta
      `CuadraturaFacade` directo, no recibe inputs)
    - [x] Contiene todo lo que antes vivía en el card `.bento-tall`: fondo de apertura,
      resumen ingresos/egresos efectivo, saldo, toggle de arqueo, contador de
      billetes/monedas, diferencia, justificación
    - [x] NO contiene el botón "Cerrar Caja" (footer solo tiene "Listo", que cierra el Drawer)
    - [x] Usa `.micro-label` en vez de clusters tipográficos ad-hoc (`ARCH-19` limpio)
    - [x] `ng build` compila sin errores

---

## Fase 4 — Reestructurar `cuadratura-content.component.ts`

- [x] **T4.1** — Shell app-like: 2 columnas flex dentro de una celda `.bento-fill`
  - **AC ref:** AC1
  - **DoD:**
    - [x] Root: `.bento-grid--fill-screen .bento-grid--rows-fit` (reutiliza modificador
      existente, no hizo falta crear uno nuevo — a diferencia de 0003-i)
    - [x] `.bento-banner.bento-fill.cuadratura-columns` envuelve 2 columnas flex
      (`.cuadratura-col--left` 2/3, `.cuadratura-col--right` 1/3), cada una con su propio
      scroll interno (`.cuadratura-col-scroll`)
    - [x] Switch de layout por **contenedor** (`@container layoutmain`), NO por `lg:` de
      Tailwind — corregido durante la implementación (primera versión usaba `lg:flex-row`/
      `lg:w-2/3`, trampa ya documentada en visual-system.md §"Trampas ya resueltas")
    - [x] `force-compact` (otro drawer abierto encima, ej. Ingreso/Egreso) sigue apilando las
      columnas — CSS existente adaptado, no reimplementado desde cero (AC5)

- [x] **T4.2** — Egresos a la columna derecha + resumen/trigger de Arqueo
  - **AC ref:** AC1
  - **DoD:**
    - [x] "Egresos / Retiros" movido de la columna izquierda a la derecha (ya no requiere
      scroll para llegar a él)
    - [x] Card resumen "Arqueo y Cierre Operativo" (Debe Haber en Caja + estado del arqueo si
      está en curso + "Ver Arqueo y Cierre") reemplaza el card completo — hace clic → abre el
      Drawer

- [x] **T4.3** — "Cerrar Caja" al Hero
  - **AC ref:** AC1
  - **DoD:**
    - [x] Nuevo item en `heroActions` (junto a "Ver Historial"/"Exportar"), label/ícono
      dinámico según `isSaving()`/`cajaYaCerrada()`/`puedeCerrarCaja()`/justificación pendiente
    - [x] `onHeroAction('cerrar-caja')` emite el output `cerrarCaja` (sin payload)

- [x] **T4.4** — Nuevos inputs para que el Hero lea el estado del arqueo (ahora en el Facade)
  - **DoD:**
    - [x] `realizarArqueo`, `diferenciaArqueo`, `notasArqueo`, `puedeCerrarCaja`,
      `colorDiferencia` — inputs nuevos, pasados por los Smart wrappers desde `facade.*()`
    - [x] Outputs actualizados: `cerrarCaja` (reemplaza `guardarCierre`), `abrirArqueo` (nuevo)
    - [x] Removidos: `fondoInicialChange`, signals/computeds/métodos locales de arqueo
      (`cantidades`, `notas`, `fondoLocal`, `realizarArqueo`, `totalArqueo`, `saldoComputado`,
      `diferencia`, `puedeCerrar`, `colorDiferencia`, `onCantidadChange`, `selectAll`,
      `getInputValue`, `onFondoChange`, `onGuardarCierre`)

---

## Fase 5 — Smart wrappers

- [x] **T5.1** — Conectar `admin-contabilidad-cuadratura.component.ts` y su par `secretaria`
  - **DoD:**
    - [x] Import de `ArqueoCierreDrawerComponent`, método `abrirDrawerArqueo()` (mismo patrón
      que `abrirDrawerIngreso()`/`abrirDrawerEgreso()` ya existentes — el Smart wrapper inyecta
      `LayoutDrawerFacadeService` directo, no vía Facade, siguiendo el precedente ya usado en
      esta página)
    - [x] `onCerrarCaja()` reemplaza `onGuardarCierre(payload)` — llama `facade.cerrarCaja()`
      sin argumentos
    - [x] Nuevos bindings de input pasando los computeds del Facade
    - [x] `ng build` compila sin errores tras conectar ambos wrappers

---

## Fase 6 — Validación

- [x] **T6.1** — Lint arquitectónico y suite completa
  - **DoD:**
    - [x] `npm run lint:arch` → 0 errores. Encontró 1 hallazgo real durante la implementación
      (`ARCH-19` en el Drawer nuevo, clusters tipográficos ad-hoc en vez de `.micro-label`) —
      corregido, no es un warning preexistente ignorado
    - [x] `npm run test:ci` → 2221 passed, 1 failed (preexistente y no relacionado —
      `secretaria-contabilidad-cuadratura.component.spec.ts` → `openIngresoDrawer`, un mismatch
      de nombre de método que ya existía antes de esta spec), 5 skipped

- [x] **T6.2** — `/verify` visual
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC-E1, AC-E2
  - **DoD:**
    - [x] `/admin/contabilidad/cuadratura` (con selección de sede — branch gate) — layout final
      confirmado: Hero con "Cerrar Caja", Ingresos (izquierda, toda la altura), Egresos +
      resumen de Arqueo (derecha)
    - [x] Clic en el resumen de Arqueo → Drawer se abre correctamente, `force-compact` apila
      las columnas de fondo (Ingresos/Egresos) sin romper nada
    - [x] Toggle "Realizar arqueo de efectivo físico" dentro del Drawer → el contador de
      billetes/monedas aparece y el Drawer crece/scrollea **internamente**, sin afectar el
      grid de fondo — **el bug técnico original queda confirmado resuelto**
    - [x] `/secretaria/contabilidad/cuadratura` — mismo layout, confirmado idéntico
    - [x] Mobile 390×844 — columnas apiladas verticalmente, scroll nativo, Hero actions en su
      propia fila — confirma que el switch por `@container` (no `lg:`) funciona
    - [x] Consola limpia (0 errores, 0 warnings) en las 4 corridas de `/verify`

---

## Fase 7 — Cierre

- [ ] **T7.1** — Actualizar `indices/APP-LIKE-ROLLOUT.md`, `indices/COMPONENTS.md`,
  `indices/FACADES.md`
  - **DoD:**
    - [ ] Fila de `/admin/contabilidad/cuadratura` (y secretaria) marcada como cerrada
    - [ ] Nueva entrada para `ArqueoCierreDrawerComponent` en `indices/COMPONENTS.md`
    - [ ] `CuadraturaFacade` actualizado en `indices/FACADES.md` con los signals/computeds
      nuevos y el cambio de firma de `cerrarCaja()`

- [ ] **T7.2** — `/spec-verify` para generar `acceptance.md`
  - **DoD:**
    - [ ] Todos los AC (AC1-AC6, AC-E1, AC-E2) verificados con evidencia
    - [ ] Veredicto final: PASA
