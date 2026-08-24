# Plan técnico 0039-b — La matrícula como dato principal

> **Spec:** `0039-b-matricula-dato-principal`
> **Fecha:** 2026-08-24
> **Talla:** **M** (confirmada con el owner)

---

## 1. Resumen ejecutivo

Tres bloques encadenados: **(A)** rename de dominio a "Matrícula" en commit propio y primero,
**(B)** jerarquía del número en listados de Admin/Secretaría, **(C)** matching por número en el
buscador global. Sin migración SQL y sin facades nuevos. El rename es mecánico; el buscador es la
única lógica real y concentra los 5 edge cases.

> ⚠️ **El alcance NO es "todo lo que diga `expediente` o `folio`".** Ver §2: de ~41 archivos que
> contienen esos strings, **~26 pertenecen a otros dominios** y renombrarlos sería introducir un
> bug, no limpiar.

---

## 2. Inventario de impacto

### Archivos a CREAR

- `src/app/shared/components/copy-value/copy-value.component.ts` — botón de copiar reutilizable
  (ver §3: hoy **no existe** ninguno y el único precedente está inline).
- `src/app/core/utils/matricula-number.utils.ts` — normalización y comparación del número
  (función pura, testeable sin Angular — exigido por §"Núcleo Funcional" de `architecture.md`).
- `src/app/core/utils/matricula-number.utils.spec.ts`

### Archivos a MODIFICAR

**Bucket 1 — el NÚMERO → rótulo "Matrícula" (12)**

| Archivo | Qué cambia |
|---|---|
| `core/models/ui/alumno-table-row.model.ts` | `nroExpedientes: string[]` → rename |
| `core/models/ui/egresado-table.model.ts` | `nroExpediente` → rename |
| `core/facades/admin-alumnos.facade.ts` (+ `.spec.ts`) | mapeo `nroExpedientes` (`:451,:471`) |
| `core/facades/ex-alumnos.facade.ts` (+ `.spec.ts`) | `nroExpediente: r.number` |
| `shared/components/alumnos-list-content/…` | columna (`:377,:401-404`) + **AC4/AC5** |
| `shared/components/alumnos-por-vencer-drawer/…` | `nroExpedientes[0]` |
| `shared/components/ex-alumnos-profesional-content/…` | `egresado.nroExpediente ?? '—'` |
| `features/admin/alumnos/ex-alumnos/…` | placeholder "Nº Expediente" |
| `features/secretaria/ex-alumnos/…` | placeholder "Nº Expediente" |
| `shared/components/matricula-steps/public-confirmation/…` | `Folio {{ enrollmentNumber() }}` |

**Bucket 2 — el ESTADO DOCUMENTAL → "Documentos" (D3) (2)**

| Archivo | Qué cambia |
|---|---|
| `shared/components/alumnos-list-content/…` | filtro rotulado "Expediente" (`:173,:447,:601`) — **AC2** |
| `shared/components/dms-list-content/…` | prosa "expediente del alumno" |

**Bucket 3 — buscador (1)**

| Archivo | Qué cambia |
|---|---|
| `core/facades/global-search.facade.ts` (+ `.spec.ts`) | `matches()` (`:102-105`) gana el número |

### Archivos a NO TOCAR (⚠️ contienen el string, son otro dominio)

Renombrarlos sería un **bug**, no una limpieza. Verificado uno por uno el 2026-08-24:

- **Folio de certificado / boleta SII** (`folio: number`): `certificate.model`, `certificate-batch.model`,
  `sii-receipt.model`, `certificacion-clase-b.facade(.spec)`, `certificacion-profesional.facade(.spec)`,
  `certificacion-*-content`, `certificacion-*.model`, `student-home.facade/model`,
  `alumno-dashboard` (`` `Folio ${cert.folio}` ``).
- **Tipo de documento** `factura_folios`: `dms.facade`, `dms-upload-drawer`.
- **Prosa legal / notarial** — alterarla cambia texto de cumplimiento: `contract.component.html`
  ("*la autorización notarial del expediente*"), `consent.model`, `consent-builder.utils(.spec)`,
  `privacy-policy.model`, `admin-pre-inscritos.facade`, `enrollment.facade`.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos

- **`.micro-label` + `.kpi-value`** del DS para el patrón etiqueta/valor de **AC6**.
  ⚠️ `.kpi-label` está **deprecada** (`fix-078-b`) — prohibida en código nuevo.
- **`ToastService`** para el feedback de copiar (**AC7**). Nunca `MessageService` de PrimeNG
  (`notifications.md`).
- **`AdminAlumnosFacade.alumnos()`** ya expone `nroExpedientes`, e `InstructorAlumnosFacade` ya
  expone `enrollmentNumber` → **cero queries nuevas** para el buscador (D8).

### Facades/Services existentes que extendemos

- `GlobalSearchFacade` — solo la función `matches()`. No se toca el fetch ni el scope por rol.

### Componentes/Facades que NO existen y debemos crear

- **Botón de copiar.** Verificado: `navigator.clipboard` aparece **una sola vez** en todo
  `src/app` (`media-upload-control.component.ts:205`), inline y sin componente. Como **AC7** exige
  área ≥44×44 + `data-llm-action` + toast, y se usa en más de un lugar, conviene un componente
  chico en `shared/` en vez de repetir el inline tres veces.
- **Utilidad de comparación del número.** No existe. Va como **función pura** en `core/utils/`
  (no dentro del Facade) para poder testear AC-E1/E4/E5 sin levantar Angular.

### 🔎 Precedente encontrado que ahorra diseño

`admin-ex-alumnos` y `secretaria-ex-alumnos` **ya buscan por número**
(`placeholder="Buscar por nombre, RUT o Nº Expediente…"`). El hueco es **solo el buscador
global**. Leer cómo compara ahí antes de inventar la normalización de padding.

---

## 4. Modelo de datos

### Migración(es) requerida(s)

**Ninguna.** Verificado el 2026-08-24: `expediente` aparece en las migraciones **solo dentro de
`COMMENT ON TABLE`**, nunca como columna o tabla. La columna real es `enrollments.number` y no se
toca. **No se renumera nada** (D1) — renumerar rompería la correspondencia con contratos ya
emitidos.

### RLS

Sin cambios. El buscador filtra sobre datos **ya scopeados**: `AdminAlumnosFacade` aplica
`resolveBranchScope()` y el branch instructor ya viene acotado por `instructor_id`.

### Modelos UI/DTO

Rename de campos en `alumno-table-row.model.ts` y `egresado-table.model.ts`. Sin campos nuevos.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
AC8/AC9/AC-E1  ── Ctrl+K ─────────────────────────────────────────────┐
                                                                       │
  GlobalSearchComponent (Dumb)                                         │
        │ query                                                        │
        ▼                                                              │
  GlobalSearchFacade.alumnoResults()  ← computed, sin queries nuevas   │
        │                                                              │
        ├─ matches(nombre, rut)            ya existe                    │
        └─ matchesMatricula(nros, q)  ◄── NUEVO, función pura ──────────┘
                 │
                 ▼
        core/utils/matricula-number.utils.ts
        · normaliza padding ('0042' ≡ '42')
        · exige match COMPLETO (nunca includes)
        · ignora el centinela '—'

AC4/AC5 ── alumnos-list-content (Dumb) ── recibe filas ya mapeadas por el Facade
AC6/AC7 ── detalle/drawers ── <app-copy-value> + .micro-label/.kpi-value
```

### Capas tocadas

| Capa | Qué |
|---|---|
| `core/utils/` | **Núcleo funcional**: normalización + comparación (puro, testeable) |
| `core/facades/` | `global-search` usa la utilidad; `admin-alumnos`/`ex-alumnos` solo rename |
| `core/models/ui/` | rename de campos |
| `shared/components/` | jerarquía, rótulos, `copy-value` nuevo |
| `features/` | solo placeholders de ex-alumnos |
| `supabase/` | **nada** |

---

## 6. Restricciones aplicables

- [x] **`architecture.md`** — la lógica de comparación va a `core/utils/` como función pura, no
      dentro del Facade (§Núcleo Funcional). `OnPush` en el componente nuevo.
- [x] **`visual-system.md`** — `.micro-label` + `.kpi-value`; `.kpi-label` prohibida; sin colores
      hardcodeados; ícono vía `<app-icon>`.
- [x] **`notifications.md`** — feedback de copiar por `ToastService`, jamás `MessageService`.
- [x] **`testing-tdd.md`** — la utilidad pura es `core/utils/` → **test obligatorio**, y se
      escribe **primero** (TDD).
- [x] **`ai-readability.md`** — el botón de copiar lleva `data-llm-action`.
- [x] **`models.md`** — el rename respeta `ui/` vs `dto/`; no se cruza la frontera.
- [ ] `facades.md` §multi-sede — no aplica: no se agrega filtro de sede nuevo, se reusa el scope.
- [ ] `swr-pattern.md` — no aplica: no hay fetch nuevo.

---

## 7. Plan de testing

| AC | Cómo se verifica |
|---|---|
| AC1, AC3 | `grep` sobre `src/app` + `npx tsc --noEmit` |
| AC2 | `/verify` — el filtro dice "Documentos" y sigue filtrando el estado |
| AC4, AC5 | `/verify` visual + test del orden por defecto |
| AC6, AC7 | `/verify` + test del componente `copy-value` (tiene lógica → obligatorio) |
| AC8–AC10 | **Unit sobre la función pura** + spec del `GlobalSearchFacade` |
| **AC-E1** | Unit: `'42'` vs `['0420','0142','4200']` → `false` en los tres |
| **AC-E2** | Unit: alumno con 2 números → aparece **una** vez |
| **AC-E3** | Spec del Facade con 2 sedes + `/verify` con sede "Todas" |
| **AC-E4** | Unit: query de 1 carácter → sin resultados (guarda `q.length < 2`) |
| **AC-E5** | Unit: `nroExpedientes = ['—']` → nunca matchea |

**TDD:** `matricula-number.utils.spec.ts` se escribe **antes** que la implementación.

---

## 8. Riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Renombrar un `folio` de otro dominio** (certificado, boleta SII, `factura_folios`) rompe conceptos ajenos en silencio: compila y pasa tests. | La lista de §2 "NO TOCAR" es explícita. **Nunca hacer sed global** sobre `folio`/`expediente`: ir archivo por archivo verificando el significado. |
| R2 | **Alterar prosa legal/notarial** (`contract.component.html`, `consent.model`) cambia texto de cumplimiento. | Mismo mitigante que R1. Ante la duda, no tocar y consultar `compliance-cl`. |
| R3 | **`.slice(0, 5)`** corta los resultados: si un número repetido entre sedes queda fuera del corte, **AC-E3 falla aunque el matching sea correcto**. | Verificar el orden de resultados antes de cortar; si hace falta, priorizar los match por número exacto. |
| R4 | `matches()` es **compartido** con el branch instructor. | Decisión registrada en spec §9: el instructor lo hereda a costo cero y **no contradice D5** (que excluye la jerarquía visual del portal, no el buscador). Si se quiere lo contrario, bifurcar a propósito. |
| R5 | El rename **conflictúa con el trabajo en vuelo** de `m` e `i`. | Commit propio y primero (D9). `main` acaba de absorber todo → ventana limpia. Avisar al equipo al mergear. |
| R6 | **`ASG-b-096`** (pendiente) quiere consolidar ex-alumnos B en un `*-content` compartido, y este track toca esos archivos. | No está reclamada. Si alguien la toma, coordinar antes; el rename ya habrá pasado y le simplifica el merge. |

---

## 9. Orden de implementación

1. **Rename de dominio** (buckets 1 y 2) → **commit propio**, sin ningún cambio de comportamiento.
   `tsc` + `test:ci` verdes antes de seguir.
2. **Utilidad pura + su spec** (TDD: primero el test) — AC-E1/E2/E4/E5.
3. **Buscador global** usando la utilidad — AC8/AC9/AC10/AC-E3. Revisar R3 acá.
4. **Jerarquía en listados** — AC4/AC5.
5. **`copy-value` + detalle** — AC6/AC7.
6. `/verify` en claro/oscuro y móvil; `lint:arch`; `/spec-verify`.

---

## 10. Estimación

**1–3 días.** El paso 1 es el más voluminoso pero mecánico; el paso 3 concentra el riesgo real.

---

## Changelog

- 2026-08-24 — plan inicial (talla M). Alcance corregido de ~41 a ~15 archivos tras clasificar
  los strings por **significado**: ~26 pertenecen a otros dominios y quedan explícitamente fuera.
