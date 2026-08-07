# Plan 0002-i — Cuadratura editable vía ajustes + egresos de combustible por vehículo

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-06

> 🚨 **Talla L** — revisar este plan completo antes de implementar. Toca una tabla nueva con RLS,
> extiende un Facade existente y agrega un flujo de UI nuevo dentro de un componente ya en
> producción (`app-detalle-cuadratura-modal`). Sin secciones de negocio faltantes — `spec.md` ya
> tiene los 7 ACs + 3 edge cases resueltos y aprobados por el owner (2026-08-06).

---

## 1. Resumen ejecutivo

Se agrega un mecanismo de "ajuste" sobre cuadraturas ya cerradas: tabla nueva
`cuadratura_adjustments` (admin-only, inmutable), extensión de `HistorialCuadraturasFacade` para
cargar/crear ajustes y calcular el total vigente en vivo, y un drawer nuevo de formulario
(`RegistrarAjusteCuadraturaDrawerComponent`) reutilizando el patrón de selector de vehículo ya
usado en `RegistrarEgresoDrawerComponent` (fix-006-i). `app-detalle-cuadratura-modal` gana el
botón de entrada y la sección de ajustes existentes. Orden: migración → modelos → Facade → drawer
→ modal → QA visual.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260806010000_cuadratura_adjustments.sql` | Migration | Tabla `cuadratura_adjustments` + RLS admin-only + FKs |
| `src/app/core/models/dto/cuadratura-adjustment.model.ts` | DTO | Mapea 1:1 la tabla nueva |
| `src/app/core/models/ui/cuadratura-adjustment.model.ts` | UI | `CuadraturaAdjustmentRow` (con `autorNombre` resuelto vía join, `tipoLabel` derivado) + `AjusteFormData` (payload del form) |
| `src/app/features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component.ts` | Smart / Drawer | Form de ajuste — tipo, monto, motivo, categoría+vehículo condicional a "Gasto olvidado" |
| `src/app/features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component.spec.ts` | Test | Cobertura de `isGastoOlvidado()`, validación de campos condicionales |
| `src/app/core/facades/historial-cuadraturas.facade.spec.ts` | Test | **Si no existe ya** — cobertura de `registrarAjuste()`, `totalVigente()`, guard admin-only client-side |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/historial-cuadraturas.facade.ts` | Agregar: signal `_ajustesCierre`, `ajustesCierre` público, `computed totalVigente`, `fetchAjustes()`, `registrarAjuste()`. `seleccionarCierre()` dispara `fetchAjustes()`. | El Facade que ya gestiona el cierre seleccionado es el dueño natural del estado de ajustes de ESE cierre |
| `src/app/shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts` | Agregar botón "Registrar ajuste" (solo si `auth.currentUser().role === 'admin'`), sección de ajustes existentes, y las 2 cifras (original vs. vigente) | Vive dentro de la vista de detalle existente — decisión confirmada (spec.md §7) |
| `indices/DATABASE.md` | Documentar tabla `cuadratura_adjustments` (columnas + policies) | Regla `database.md` — toda tabla nueva se documenta |
| `indices/FACADES.md` | Actualizar entrada de `HistorialCuadraturasFacade` con los métodos nuevos | Sync obligatorio al cerrar el track |
| `indices/MODELS.md` | Agregar `CuadraturaAdjustment` (dto) y `CuadraturaAdjustmentRow`/`AjusteFormData` (ui) | Sync obligatorio |
| `indices/COMPONENTS.md` | Agregar `RegistrarAjusteCuadraturaDrawerComponent` | Sync obligatorio |
| `src/app/app.config.ts` | Ninguno esperado — `Wrench`/`Edit3`/`PenLine` ya están registrados | Confirmar en Discovery, no repetir el registro |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-detalle-cuadratura-modal` — punto de entrada del flujo, ya inyecta `HistorialCuadraturasFacade` y ya muestra el arqueo original (`d.saldoFisico`, `d.totalEgresos`, etc.) — se le agrega la sección de ajustes, no se duplica nada del arqueo.
- Selector de vehículo de `RegistrarEgresoDrawerComponent` (`FlotaFacade.vehicles()`, formato `"{brand} {model} - {licensePlate} (Asignado a: ... )"`) — se replica el mismo patrón visual/de datos en el drawer nuevo cuando `tipo === 'gasto_olvidado'` y la categoría es combustible. No se extrae a `shared/` en este plan — evaluar extracción futura si un tercer consumidor aparece (regla de 2 duplicaciones antes de abstraer).
- `LayoutDrawerFacadeService.open()` — mismo mecanismo de apertura que todos los drawers del proyecto.
- `ToastService` — confirmaciones/errores del `registrarAjuste()`.

### Facades/Services existentes que extendemos
- `HistorialCuadraturasFacade.seleccionarCierre()` — se le agrega el side-effect de cargar los ajustes del cierre seleccionado (`fetchAjustes()`), mismo lugar que ya gestiona `_cierreSeleccionado`.
- `AuthFacade.currentUser()` — para el guard client-side del botón "Registrar ajuste" (solo admin ve el botón; el guard real es la RLS de la tabla).

### Componentes/Facades que NO existen y debemos crear
- `RegistrarAjusteCuadraturaDrawerComponent` — no hay ningún drawer existente que combine "tipo de ajuste + monto + motivo + campos condicionales de gasto". `RegistrarEgresoDrawerComponent` es para el día en curso (fix-006-i), no para corregir un día ya cerrado — mezclar ambos casos en un solo componente violaría el AC-E1 (ajustes solo sobre cuadraturas cerradas) y complicaría innecesariamente el componente existente.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260806010000_cuadratura_adjustments.sql
CREATE TABLE IF NOT EXISTS cuadratura_adjustments (
  id              SERIAL PRIMARY KEY,
  cuadratura_id   INT NOT NULL REFERENCES cash_closings(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('gasto_olvidado', 'correccion_manual')),
  monto           INTEGER NOT NULL,              -- signo: negativo reduce el total vigente
  motivo          TEXT NOT NULL,
  expense_id      INT REFERENCES expenses(id),   -- solo si tipo = 'gasto_olvidado'
  registered_by   INT NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cuadratura_adjustments IS
  'Ajustes posteriores sobre cuadraturas cerradas (spec 0002-i / ASG-b-037). '
  'Inmutable: sin UPDATE ni DELETE — una corrección mal hecha se compensa con OTRO ajuste.';

ALTER TABLE cuadratura_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_cuadratura_adjustments ON cuadratura_adjustments
  FOR SELECT USING (auth_user_role() = 'admin');

CREATE POLICY insert_cuadratura_adjustments ON cuadratura_adjustments
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

-- Sin policy de UPDATE/DELETE a propósito (AC "inmutable" — nadie puede editar/borrar,
-- ni siquiera admin, vía API REST normal).
```

- **Por qué `monto` con signo en vez de un campo separado `es_positivo`:** simplifica el cálculo
  de `totalVigente = original + SUM(monto)` a una sola suma, sin `CASE`. Mismo patrón que
  `difference` en `cash_closings` (ya usa signo, no un enum de dirección).
- **Por qué `expense_id` nullable en vez de una tabla de unión:** un ajuste genera como máximo un
  gasto — 1:1 opcional, FK simple es suficiente, no amerita tabla intermedia.
- **Por qué NO se hereda `branch_id` directo:** se resuelve por join a través de `cuadratura_id
  → cash_closings.branch_id` — evitar duplicar el dato y el riesgo de que diverja del cierre que
  referencia.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `cuadratura_adjustments` | admin | SELECT | `auth_user_role() = 'admin'` |
| `cuadratura_adjustments` | admin | INSERT | `auth_user_role() = 'admin'` |
| `cuadratura_adjustments` | secretaria | (ninguna) | Sin policy → PostgREST deniega por default (RLS habilitado sin policy = deny-all para ese rol/operación) |
| `cuadratura_adjustments` | cualquiera | UPDATE/DELETE | Sin policy — nadie puede, ni admin (inmutabilidad real a nivel BD, no solo UI) |

### Modelos UI/DTO

- `core/models/dto/cuadratura-adjustment.model.ts` — mapea la tabla 1:1 (`snake_case` crudo).
- `core/models/ui/cuadratura-adjustment.model.ts`:
  - `CuadraturaAdjustmentRow` — `id`, `tipo`, `tipoLabel` (derivado: 'Gasto olvidado'/'Corrección manual'), `monto`, `motivo`, `autorNombre` (join a `users`), `fecha` (created_at formateado).
  - `AjusteFormData` — payload del formulario: `tipo`, `monto`, `motivo`, `categoria?`, `vehiculoId?` (solo si `tipo === 'gasto_olvidado'` y la categoría es combustible).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Historial de Cuadraturas (ya existente)
        │  click en día cerrado
        ▼
HistorialCuadraturasFacade.seleccionarCierre(cierre)
        │  (nuevo) dispara fetchAjustes(cierre.id)
        ▼
app-detalle-cuadratura-modal (MODIFICAR)
        │  arqueo original (ya existente, sin cambios)
        │  (nuevo) total vigente = original + Σ ajustesCierre()
        │  (nuevo) lista de ajustes existentes
        │  (nuevo) botón "Registrar ajuste" ── [solo admin] ──┐
        ▼                                                      ▼
   (sin cambios)                          RegistrarAjusteCuadraturaDrawerComponent (CREAR)
                                                    │  tipo=gasto_olvidado → selector vehículo
                                                    │  (mismo patrón que RegistrarEgresoDrawerComponent)
                                                    ▼
                                      HistorialCuadraturasFacade.registrarAjuste(datos)
                                                    │
                                    ┌───────────────┴────────────────┐
                                    ▼                                ▼
                     INSERT cuadratura_adjustments      INSERT expenses (solo si gasto_olvidado)
                                    │                    con date = fecha del cierre corregido
                                    └───────────────┬────────────────┘
                                                     ▼
                                        refreshSilently() → fetchAjustes()
                                                     ▼
                                     Modal se actualiza: nuevo ajuste + total vigente recalculado
```

### Mapeo de capas

- **Smart**: `RegistrarAjusteCuadraturaDrawerComponent` (`features/admin/contabilidad-cuadratura/`) — inyecta `HistorialCuadraturasFacade` + `FlotaFacade` (selector vehículo).
- **Smart-ish (ya así, no se cambia)**: `DetalleCuadraturaModalComponent` — sigue inyectando `HistorialCuadraturasFacade` directo, coherente con cómo ya está construido.
- **Facade**: `HistorialCuadraturasFacade` — dueño del estado de ajustes del cierre seleccionado.
- **Migration**: `supabase/migrations/20260806010000_cuadratura_adjustments.sql`.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade existente extendido (no UI con Supabase directo), OnPush en el drawer nuevo, Signals.
- [x] `facades.md` — `HistorialCuadraturasFacade` ya es branch-scoped (vía `getActiveBranchId()`); los ajustes heredan el scope del `cuadratura_id` seleccionado, no necesitan su propio filtro de sede.
- [x] `models.md` — DTO (`cuadratura-adjustment.model.ts` en `dto/`) vs UI (`ui/`) separados desde el inicio.
- [x] `visual-system.md` — chip/badge para `tipoLabel` (mismo patrón `app-badge` que hotfix-001-i), sin colores hardcodeados, `.card`/`.card-accent` en la sección nueva del modal.
- [ ] `swr-pattern.md` — no aplica un ciclo SWR nuevo: los ajustes se cargan on-demand al seleccionar un cierre (mismo patrón que ya usa `seleccionarCierre()`), no hay revisita a cachear.
- [ ] `notifications.md` — no aplica; feedback vía `ToastService` (capa 1), no se crea una notificación persistente por ajuste.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para el Facade (lógica de `totalVigente`) y el drawer nuevo (campos condicionales).
- [x] `ai-readability.md` — `data-llm-action="registrar-ajuste-cuadratura"` en el botón nuevo, `data-llm-description` en los campos condicionales del form.

---

## 7. Plan de testing

- **Unitarios (obligatorio, `core/facades`):**
  - `HistorialCuadraturasFacade.spec.ts`: `totalVigente()` = original + suma de ajustes (positivos y negativos); `totalVigente()` sin ajustes = original; `registrarAjuste()` inserta en `cuadratura_adjustments` y, solo si `tipo === 'gasto_olvidado'`, también en `expenses` con la fecha del cierre (no la de hoy); `registrarAjuste()` con `tipo === 'correccion_manual'` NO toca `expenses`.
- **Unitarios (`features/` Smart con lógica):**
  - `registrar-ajuste-cuadratura-drawer.component.spec.ts`: `isGastoOlvidado()` computed; validación — campos de categoría/vehículo solo requeridos cuando `tipo === 'gasto_olvidado'`.
- **QA manual (`/verify`):**
  - Golden path: Admin abre un día cerrado del mes pasado → registra ajuste "Gasto olvidado" con vehículo → confirma que aparece en el modal Y en Contabilidad > Gastos con la fecha correcta.
  - Edge case AC-E1: intentar registrar ajuste sobre el día de HOY (sin cerrar) → rechazado.
  - Edge case AC-E2: dos ajustes seguidos sobre el mismo cierre → ambos se suman, no se pisan.
  - Secretaria: confirmar que el botón "Registrar ajuste" no aparece, y que un INSERT directo a la tabla (si se pudiera probar vía API) es rechazado por RLS.
  - Modo oscuro/claro del drawer nuevo y de la sección de ajustes en el modal.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Un ajuste "gasto olvidado" con fecha pasada altera un reporte mensual ya exportado/revisado por el cliente | Media | Documentar explícitamente en el drawer ("este gasto se sumará al mes de {fecha}") — no es un bug, es el comportamiento esperado (AC2), pero debe ser visible para el admin antes de confirmar |
| `totalVigente` computed recalcula mal si `ajustesCierre()` no se resetea al cambiar de cierre seleccionado | Baja | Test explícito: seleccionar cierre A (con ajustes) → seleccionar cierre B (sin ajustes) → `totalVigente()` de B = su original, sin arrastrar los ajustes de A |
| Admin intenta registrar un ajuste sobre el cierre de HOY antes de cerrarlo (confusión con `RegistrarEgresoDrawerComponent`) | Media | AC-E1 lo cubre a nivel de datos (UI oculta el botón si `!cierre.closed`, y aunque se fuerce, el Facade puede validar `closed=true` antes de insertar) |
| Selector de vehículo duplicado entre 2 drawers (`RegistrarEgresoDrawerComponent` y el nuevo) diverge con el tiempo | Baja | Aceptado por ahora (regla de "extraer solo al 3er duplicado"); documentar en el código con referencia cruzada a ambos archivos |

---

## 9. Orden de implementación

1. Migración SQL (`cuadratura_adjustments` + RLS) — correr manualmente en Supabase (según preferencia del equipo, ver memoria de sesión) y versionar el archivo.
2. Modelos DTO + UI (`cuadratura-adjustment.model.ts` x2).
3. `HistorialCuadraturasFacade`: `fetchAjustes()`, `registrarAjuste()`, `totalVigente` computed + `.spec.ts` primero (TDD).
4. `RegistrarAjusteCuadraturaDrawerComponent` + `.spec.ts`.
5. `DetalleCuadraturaModalComponent`: botón + sección de ajustes + las 2 cifras.
6. QA visual (`/verify`) + validación de los 7 ACs + 3 edge cases contra `spec.md`.
7. Sync de índices (`DATABASE.md`, `FACADES.md`, `MODELS.md`, `COMPONENTS.md`).

---

## 10. Estimación

M/L — estimado 2-3 días de trabajo efectivo (migración + Facade + 2 componentes + tests + QA).

---

## Changelog

- 2026-08-06 — plan inicial, talla L confirmada por el owner (i). Discovery: `HistorialCuadraturasFacade`/`app-detalle-cuadratura-modal` ya existen y son el punto de extensión natural; `RegistrarEgresoDrawerComponent` (fix-006-i) provee el patrón de selector de vehículo a replicar, no a modificar (caso de uso distinto: día en curso vs. corrección de cierre pasado).
