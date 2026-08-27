# Plan 0012-m — Persistir borrador de Arqueo y Cierre de Caja

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-27

---

## 1. Resumen ejecutivo

Se agrega un constraint de unicidad `(date, branch_id)` y se amplía la RLS de `UPDATE` en
`cash_closings` para permitir que la secretaria persista un borrador (`status: 'draft'`) de su
propia sede. `CuadraturaFacade` gana un método de autoguardado con debounce que hace upsert sobre
esa misma fila, y carga el borrador del día al inicializar. `ArqueoCierreDrawerComponent` conecta
los signals existentes al autoguardado (sin cambiar su forma) y renombra "Listo" → "Cerrar panel".
`cerrarCaja()` pasa de INSERT a UPDATE-si-existe-borrador (o INSERT si no hay ninguno).

Orden grueso: migración → Facade (upsert + carga + tests) → conexión en el drawer → QA manual.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260827_cash_closings_draft_upsert.sql` | Migration | Constraint único `(date, branch_id)` + policy `update_cash_closings` ampliada a `secretary` sobre `status='draft'` de su sede. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/cuadratura.facade.ts` | Nuevo método privado `guardarBorrador()` (debounced, upsert), `effect()` NO se usa aquí — se dispara desde el componente vía llamada explícita en cada `(input)`; `checkCajaStatus()` se extiende para además cargar un borrador (`status='draft'`) y restaurar `fondoInicial`/`cantidades`/`notasArqueo`/`realizarArqueo`; `cerrarCaja()` cambia de `insert` a `upsert` sobre `(date, branch_id)`. | AC1, AC2, AC4, AC5 |
| `src/app/core/facades/cuadratura.facade.spec.ts` | Tests nuevos: upsert de borrador, restauración al inicializar, `cerrarCaja()` actualiza fila existente en vez de duplicar. | testing-tdd.md — obligatorio para lógica nueva en Facade |
| `src/app/features/admin/contabilidad-cuadratura/arqueo-cierre-drawer.component.ts` | Cada `(input)`/`(click)` que muta `fondoInicial`/`cantidades`/`notasArqueo`/`realizarArqueo` dispara `facade.guardarBorrador()` (fire-and-forget, debounced dentro del Facade). Botón "Listo" → "Cerrar panel". | AC1, AC3 |
| `indices/DATABASE.md` | Documentar constraint nuevo y policy ampliada de `cash_closings`. | Auto-mantenimiento (CLAUDE.md) |
| `indices/FACADES.md` | Documentar `guardarBorrador()` en la entrada de `CuadraturaFacade`. | Auto-mantenimiento (CLAUDE.md) |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `ArqueoCierreDrawerComponent` — no se crea un componente nuevo, solo se conecta a un método
  nuevo del Facade y se renombra un botón.
- `ConfirmModalService` — ya inyectado (`fix-225-m`), sin cambios.

### Facades/Services existentes que extendemos
- `CuadraturaFacade` — se extiende con `guardarBorrador()` y ajustes a `checkCajaStatus()` y
  `cerrarCaja()`. No se crea un Facade nuevo: el borrador vive en la misma fila/tabla que el
  cierre final, es el mismo dominio.
- Patrón de debounce: no existe uno reutilizable en `core/utils/` — se implementa con
  `setTimeout`/`clearTimeout` privado dentro del Facade (alcance acotado, no amerita una utility
  compartida todavía; si aparece un segundo caso de autoguardado en el proyecto, extraer).

### Componentes/Facades que NO existen y debemos crear
- Ninguno. Todo el cambio vive en capas existentes.

---

## 4. Modelo de datos

### Migración(es) requerida(s)

```sql
-- supabase/migrations/20260827120000_cash_closings_draft_upsert.sql
-- ⚠️ SQL FINAL, validado localmente en T1.2/T1.3 — reemplaza el pseudo-SQL original
--    (un índice sobre expresión COALESCE no sirve como target de `onConflict` en
--    PostgREST/supabase-js: falla con "duplicate key value violates unique constraint"
--    en el segundo upsert. Ver tasks.md T1.3 para la prueba que lo demostró).

-- 1) Constraint único para permitir upsert seguro por (date, branch_id). branch_id es
--    nullable (admin "todas las sedes") — se normaliza en una columna GENERADA no-nula
--    (branch_id_key) porque el UNIQUE debe vivir sobre columnas reales, no una expresión,
--    para poder usarse directo en onConflict: 'date,branch_id_key' desde el cliente.
ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS branch_id_key INT
  GENERATED ALWAYS AS (COALESCE(branch_id, -1)) STORED;

CREATE UNIQUE INDEX ux_cash_closings_date_branch
  ON cash_closings (date, branch_id_key);

-- 2) Ampliar UPDATE: admin sigue con acceso total; secretary puede actualizar
--    SOLO filas status='draft' de su propia sede (nunca una fila ya 'closed').
DROP POLICY IF EXISTS update_cash_closings ON cash_closings;
CREATE POLICY update_cash_closings ON cash_closings
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND status = 'draft' AND branch_visible(branch_id))
  );
```

Validado localmente (Docker + `npx supabase db reset`, sin tocar el remoto):
upsert con `branch_id: null` dos veces seguidas actualiza la misma fila (no duplica); upsert
con `branch_id` real ídem; `secretary` autenticada actualiza una fila `draft` de su sede (1 fila
afectada) y queda bloqueada en silencio sobre una fila `closed` (0 filas afectadas, sin error
explícito — comportamiento normal de RLS de Postgres).

Nota: `status='draft'` en el `USING` de la policy es la barrera real — una vez que
`cerrarCaja()` hace `UPDATE ... SET status='closed'`, esa misma fila deja de ser editable por
`secretary` en cualquier UPDATE posterior (incluida una carrera de autoguardado tardío), sin
necesitar lógica adicional en el Facade.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `cash_closings` | `secretary` | UPDATE | `status = 'draft' AND branch_visible(branch_id)` (nuevo — antes bloqueado por completo) |
| `cash_closings` | `admin` | UPDATE | Sin cambios — acceso total |
| `cash_closings` | `secretary` | INSERT | Sin cambios (`branch_visible(branch_id)`) — el primer borrador del día se sigue creando con INSERT |
| `cash_closings` | `secretary` | SELECT | Sin cambios — ya lee sus propias filas (últimos 2 días + sede) |

### Modelos UI/DTO

- Ninguno nuevo. `cash_closings` ya se lee como `any`/tipo inline en el Facade (`this._cierreHoy`
  usa el tipo existente `CashClosing` — no se agregan campos, solo se usa `status`/`closed` que
  ya existen).

> ⚠️ **Corrección post-implementación (Fase 2):** este plan asumía que "sin columnas nuevas"
> bastaba, pero `fondoInicial` y el toggle `realizarArqueo` no se derivan de ninguna otra tabla
> (a diferencia de ingresos/egresos) y ninguna columna existente de `cash_closings` los
> representa. Se agregó una segunda migración,
> `supabase/migrations/20260827130000_cash_closings_draft_columns.sql`, con dos columnas
> nullable: `opening_amount INTEGER` y `arqueo_enabled BOOLEAN`. Validada localmente (Docker +
> `db reset`) y aplicada manualmente por el usuario, mismo flujo que la migración de T1.2. Ver
> `tasks.md` Fase 2 para el detalle.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
ArqueoCierreDrawerComponent (Smart, ya inyecta CuadraturaFacade directo — NgComponentOutlet)
  (input) fondoInicial/cantidades/notasArqueo/realizarArqueo
       │
       ▼
CuadraturaFacade
  ├─ signals mutados directamente (sin cambio, ya existen)
  ├─ guardarBorrador() ← llamado tras cada mutación
  │     debounce interno (setTimeout ~800ms, clearTimeout en cada llamada)
  │     └─ supabase.client.from('cash_closings').upsert(payload, { onConflict: 'date,branch_id' })
  │
  ├─ checkCajaStatus() [ya existe, se extiende]
  │     SELECT cash_closings WHERE date=hoy AND branch_id=sede
  │     status='closed' → cajaYaCerrada=true, cierreHoy=data
  │     status='draft'  → restaura fondoInicial/cantidades/notasArqueo/realizarArqueo
  │     sin fila         → estado en blanco (comportamiento actual)
  │
  └─ cerrarCaja() [ya existe, cambia INSERT→UPSERT]
        upsert(..., status:'closed', closed:true, onConflict:'date,branch_id')
```

### Capas tocadas

- **Smart/Drawer**: `features/admin/contabilidad-cuadratura/arqueo-cierre-drawer.component.ts`
  (wiring de eventos, sin lógica de negocio nueva)
- **Facade**: `core/facades/cuadratura.facade.ts` (toda la lógica nueva vive acá — núcleo
  funcional del dominio, ver `architecture.md`)
- **Migration**: `supabase/migrations/20260827_cash_closings_draft_upsert.sql`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Facade sigue siendo el único punto de acceso a Supabase; el drawer no
  gana lógica de negocio, solo dispara el método del Facade.
- [ ] `facades.md` (branch-scoped) — `CuadraturaFacade` ya aplica `branchFacade.selectedBranchId()`
  en sus fetches existentes; el upsert nuevo reutiliza `getActiveBranchId()` ya existente, sin
  patrón nuevo que documentar.
- [ ] `models.md` — no se crean DTOs/UI models nuevos.
- [x] `visual-system.md` — el único cambio visual es el texto del botón "Listo"→"Cerrar panel";
  sin tokens ni componentes nuevos.
- [x] `swr-pattern.md` — el autoguardado sigue el mismo espíritu de `refreshSilently()`: falla
  silenciosa (AC-E3), reintento en el próximo cambio, sin bloquear la UI ni mostrar skeleton.
- [ ] `notifications.md` — no aplica (no hay toasts nuevos; el autoguardado es silencioso a
  propósito, ver AC-E3).
- [x] `testing-tdd.md` — `guardarBorrador()`, la restauración en `checkCajaStatus()` y el cambio
  de `cerrarCaja()` a upsert son lógica de decisión nueva → tests obligatorios en
  `cuadratura.facade.spec.ts`.
- [ ] `ai-readability.md` — el botón "Cerrar panel" ya tiene `data-llm-action` (heredado del
  botón "Listo" existente, solo cambia el label visible, no el atributo).

---

## 7. Plan de testing

- **Unitarios (`cuadratura.facade.spec.ts`)**:
  - `guardarBorrador()` hace upsert con `status:'draft'` y los valores actuales de los signals.
  - `guardarBorrador()` debounce: llamadas sucesivas dentro de la ventana solo disparan una
    escritura (usar `vi.useFakeTimers()`).
  - `checkCajaStatus()` restaura `fondoInicial`/`cantidades`/`notasArqueo`/`realizarArqueo` cuando
    la fila tiene `status='draft'`.
  - `checkCajaStatus()` NO marca `cajaYaCerrada()=true` para una fila `status='draft'` (AC5).
  - `cerrarCaja()` hace upsert (no insert plano) y no duplica fila cuando ya existía un borrador.
  - Falla de red en `guardarBorrador()` no lanza excepción no capturada (AC-E3).
- **QA manual (`/verify`, Playwright)**:
  - Golden path: editar fondo/cantidades/notas → esperar ~1s → F5 → los valores persisten.
  - Reabrir el drawer sin recargar → mismo estado.
  - Cerrar caja con un borrador existente → verificar en Supabase que es la MISMA fila (mismo
    `id`) que pasó de `draft` a `closed`, no una fila nueva.
  - Día siguiente (cambiar fecha del sistema o usar cuenta de prueba con fecha distinta) → drawer
    abre en blanco, no arrastra el borrador de ayer (AC-E2).
  - Confirmar en consola/network que no hay error 4xx al autoguardar como `secretary`.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Constraint único `(date, COALESCE(branch_id,-1))` choca con filas históricas duplicadas ya existentes en producción (dos cierres del mismo día/sede por algún bug pasado) | Media | Antes de aplicar el índice único, correr un `SELECT date, branch_id, COUNT(*) FROM cash_closings GROUP BY 1,2 HAVING COUNT(*)>1` en un ambiente con datos reales; si aparecen duplicados, resolverlos manualmente antes de la migración (no en este plan — bloquea el deploy, no la spec). |
| Debounce mal implementado deja una escritura "colgada" que llega después de que el usuario ya cerró la caja (carrera) | Baja | La policy RLS ya blinda esto: una vez `status='closed'`, ningún UPDATE de `secretary` puede tocar la fila (ver §4) — el peor caso es un upsert fallido silencioso, no corrupción de datos. |
| Secretaria en offline momentáneo pierde varios autoguardados seguidos sin darse cuenta | Baja | Fuera de alcance de esta spec (AC-E3 solo pide que no rompa la UI); los signals en memoria siguen teniendo el valor correcto hasta que la conexión vuelva y el próximo `(input)` reintente. |
| Upsert con `onConflict: 'date,branch_id'` no funciona igual cuando `branch_id IS NULL` (admin sin sede) vía PostgREST/Supabase client | Media | Validar en `/spec-tasks` con una prueba manual contra Supabase local antes de dar la migración por cerrada; si `onConflict` no soporta bien NULL, considerar columna generada no-nula en vez de índice sobre `COALESCE(...)`. |

---

## 9. Orden de implementación

1. Migración SQL (constraint + RLS) — validar contra `npx supabase start` local antes de continuar.
2. `cuadratura.facade.ts`: `guardarBorrador()` + extensión de `checkCajaStatus()` + `cerrarCaja()`
   a upsert, con `cuadratura.facade.spec.ts` en paralelo (TDD).
3. `arqueo-cierre-drawer.component.ts`: wiring de `(input)` → `guardarBorrador()`, rename del
   botón.
4. `npm run test:ci` + `npm run lint:arch`.
5. `/verify` (Playwright) — golden path + edge cases del §7.
6. Sync de `indices/DATABASE.md` y `indices/FACADES.md`.
7. `/spec-verify` contra los ACs de `spec.md`.

---

## 10. Estimación

M — 1 a 2 días (la migración y su validación contra datos existentes es la parte de mayor
incertidumbre, no el código de Facade/UI en sí).

---

## Changelog

- 2026-08-27 — plan inicial, talla M confirmada por el owner.
