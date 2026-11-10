# Plan 0060-b — Una lectura que falla se ve como error, no como ceros o "sin datos"

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-11-10)
> **Created:** 2026-11-10
> **Talla:** L (confirmada por el owner)

> ⚠️ **Revisar el plan antes de implementar — tamaño alto.** 30 facades y sus pantallas, en 4
> etapas. Cada etapa es un PR que se puede revisar, probar y mergear por separado.

---

## 1. Resumen ejecutivo

Primero se construyen las dos redes que miden el problema: un guard que falla si un facade
descarta el `error` de una lectura, y el E2E de X01 que corta la red y recorre las pantallas.
Después se corrigen los facades y sus pantallas por etapas, de mayor a menor consecuencia, sacando
cada facade de la lista de pendientes del guard. No hay migración, ni facades, ni componentes
nuevos.

### Lo que la medición agregó a la spec

Un detector más fino que el conteo de la spec (ve desestructuraciones en varias líneas y
resultados de `Promise.all`) encontró **122 lecturas sin chequeo en 30 de 63 facades**. El defecto
tiene tres formas:

| Forma | Cantidad | Quién la detecta |
|---|---|---|
| **F1** — `const { data } = await …` sin `error` | 86 | Guard |
| **F2** — resultado de `Promise.all` del que se usa `.data` y nunca `.error` | 36 | Guard |
| **F3** — el facade captura el error, pero la pantalla no lo muestra o un `catch` vacío lo traga | por revisar | Solo el E2E |

F3 explica por qué `servicios-especiales` y `reportes-contables` fallaron en X01 aunque sus
lecturas ya lanzan. Por eso el E2E pasa a la etapa 0: el guard cubre el facade, el E2E la pantalla.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/facades/unchecked-reads.guard.spec.ts` | Test guard | Detector de F1 y F2 + lista `PENDING` (AC1) |

### Archivos a MODIFICAR — etapa 0

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/utils/db-error.utils.ts` (+ spec) | Agregar `assertReadOk(result)`: lanza si hay `error` y devuelve `data` | Par de `assertWriteOk`. Acorta F2 (un `Promise.all` con 4 resultados) y le da al guard una forma fácil de reconocer |
| `.claude/rules/swr-pattern.md` | El ejemplo de `refreshSilently()` deja de ser un `catch` vacío; se agregan los casos A y B | AC2 |
| `.claude/rules/facades.md` | La estructura obligatoria muestra el chequeo de `error` en la lectura | AC2 |
| `e2e/transversal-shell.spec.ts` | Nuevo bloque "X01. Pantallas sin red", una fila por pantalla, con las no migradas marcadas `knownBug` | AC8 |
| `indices/DOMAIN-GOTCHAS.md` | Gotcha nuevo, par de DG-103 (escrituras): una lectura que falla tampoco lanza | Sincronización |
| `indices/UTILS.md` | `assertReadOk` | Sincronización |

### Archivos a MODIFICAR — etapas 1 a 3

Por cada facade: `*.facade.ts`, su `*.facade.spec.ts` y los componentes que muestran sus datos.
Entre paréntesis, lecturas F1+F2 detectadas.

| Etapa | Facades | Pantallas principales |
|---|---|---|
| **1 — Dinero** | `pagos` (8), `liquidaciones` (3), `dashboard` (3), `enrollment-payment` (3), `reportes-contables` (F3), `anticipos` (1) | `admin-pagos`, `*-contabilidad-reportes`, `*-contabilidad-liquidaciones`, `secretaria-dashboard` |
| **2 — Lecturas que alimentan una escritura o decisión** | `enrollment` (22), `admin-alumno-detalle` (8), `cursos-singulares` (6), `certificacion-clase-b` (4), `enrollment-documents` (2), `public-enrollment` (2), `admin-pre-inscritos` (2), `student-enrollment-context` (1), `servicios-especiales` (F3) | Matrícula presencial y pública, ficha del alumno, Cursos singulares, Servicios especiales, Certificados |
| **3a — Gestión Clase B** | `asistencia-clase-b` (5), `admin-alumnos` (4), `dashboard-alerts` (4), `dms` (4), `flota` (2), `instructores` (1), `tasks` (1), `instructor-alumnos` (2), `instructor-clases` (1), `student-clases` (4), `student-home` (4, sumado por el guard), `ex-alumnos` (KPIs) | Asistencia, Alumnos, Ex-Alumnos, Documentos, Flota, Instructores, Comunicación, portales |
| **3b — Profesional** | `asistencia-profesional` (12), `certificacion-profesional` (6), `archivo-profesional` (5), `admin-alumnos-profesional` (3), `libro-de-clases` (1), `promociones` (1), `relatores` (1) | Módulo Clase Profesional |

La lista definitiva de cada etapa es la que entregue `PENDING` al crear el guard: si el detector
final encuentra un facade más, entra en la etapa que le corresponda por consecuencia.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos

- `app-empty-state` (`message`, `subtitle`, `icon`, `actionLabel`, `(action)`) — caso A: reemplaza
  la lista y los KPIs con el estado de error y "Reintentar".
- `app-alert-card` (`severity="error"`, `title`) — caso B: aviso sobre los datos que siguen
  visibles. Referencia: `cuadratura-content.component.ts:111`.
- `app-kpi-card` y `app-section-hero` ya aceptan `loading`; con la carga fallida los KPIs no se
  renderizan (los reemplaza el estado de error), así que no necesitan un input nuevo.

### Facades, utils y tests existentes que extendemos

- `unchecked-writes.guard.spec.ts` (fix-362-m) — se copia su estructura: detector con tests
  propios, lista `PENDING` y un test que obliga a sacar de la lista lo ya corregido.
- `assertWriteOk` / `toFriendlyDbMessage` en `db-error.utils.ts` — `assertReadOk` vive al lado.
- `createRequestGuard()` — el error solo se aplica si la respuesta sigue vigente (como ya hace
  `pagos.facade.ts:194`); no se toca el orden `throw` antes de `isCurrent()`.
- `CuadraturaFacade` (`cargarDia()`, `_cargaFallida`, `reintentar()`) y `AgendaFacade` (`retry()`,
  `_weekData.set(null)` al fallar un cambio de semana) — implementaciones de referencia.
- Método de X01 en `fix-190-b`: `page.route` con `abort('internetdisconnected')` sobre `rest/v1` y
  `functions/v1`, navegación por el menú.

### Qué NO existe y se crea

- `unchecked-reads.guard.spec.ts` — el guard de escrituras ignora las lecturas a propósito.
- `assertReadOk` — no hay equivalente; `assertWriteOk` exige filas afectadas y no devuelve `data`.

Nada más. Sin wrapper de consultas ni componente "boundary" (descartados en la spec).

---

## 4. Modelo de datos

**N/A.** No hay migración, RLS ni modelos nuevos.

---

## 5. Arquitectura del cambio

### Receta por facade

```
fetchXxxData()                      ← toda lectura lanza
  ├─ token = guard.next()
  ├─ const data = assertReadOk(await q)        (o: if (error) throw error)
  ├─ Promise.all → assertReadOk en cada resultado que alimenta un total
  ├─ if (!guard.isCurrent(token)) return
  └─ signals.set(...)

initialize() / cambio de filtro, período o sede     ← CASO A
  ├─ _error.set(null); _isLoading.set(true)
  └─ catch → retirar los datos de la consulta anterior + _error.set(mensaje)

refreshSilently()                                   ← CASO B
  └─ catch → los datos quedan; _refreshFailed.set(true)
     (una carga que termina bien lo vuelve a false)

reintentar()  → público, misma ruta que el caso A
```

- `_refreshFailed` (nombre por definir en la etapa 0; en Caja se llama `cargaFallida`) solo se
  agrega donde la pantalla lo usa: para el aviso del caso B y para bloquear las acciones que
  guardan un valor calculado con esos datos (decisión 1 de la spec).
- "Retirar los datos" en el caso A significa volver los signals a su estado inicial; la pantalla
  no llega a mostrarlos porque el error tiene prioridad en el template.

### Receta por pantalla

```
@if (facade.error() && !hayDatos)      → app-empty-state + Reintentar   (caso A)
@else
  @if (facade.refreshFailed())         → app-alert-card + Reintentar    (caso B)
  KPIs + lista
```

El estado de error del caso A va dentro de la celda `.bento-fill`, en un wrapper
`flex-1 flex items-center justify-center` (regla de `visual-system.md` para estados vacíos). El
aviso del caso B es una celda `.bento-banner` más: revisar el modificador `--fill-screen*` como
hizo `fix-044-i`, que tuvo que pasar a `--fill-screen-kpi` mientras el aviso está visible.

### Capas tocadas

- **Facade**: los 30 de §2. **Smart / Organismo**: sus pantallas. **Utils**: `db-error.utils.ts`.
- **Dumb**: ninguno cambia de contrato.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade, OnPush, control flow nativo (`@if`)
- [x] `facades.md` — branch-scoped y `createRequestGuard`; además **se edita** (AC2)
- [ ] `models.md` — sin modelos nuevos
- [x] `visual-system.md` — estado de error dentro de `.bento-fill`; sin colores a mano
- [x] `swr-pattern.md` — **se edita** (AC2): es la regla que hoy enseña el `catch` vacío
- [x] `notifications.md` — no se agregan toasts de error de carga; el aviso va en la pantalla
- [x] `testing-tdd.md` — test en rojo antes de cada cambio de facade
- [x] `ai-readability.md` — `data-llm-action` en cada botón "Reintentar"
- [x] Harness Gate — las ediciones a `.claude/rules/` deben enunciar la regla con su criterio de
  aplicabilidad, no como anécdota de este track

---

## 7. Plan de testing

- **Guard (etapa 0):** tests del detector para F1 en una línea, F1 en varias líneas, F2, lectura
  con `error` capturado, lectura envuelta en `assertReadOk`, y que no marque una escritura.
- **Por facade (TDD, en rojo antes del cambio):**
  - primera carga con `{ error }` → `error()` con mensaje, datos en estado inicial (AC3);
  - cambio de filtro o sede con `{ error }` → no quedan los datos anteriores (AC4);
  - refresco con `{ error }` → datos intactos y aviso activo (AC5);
  - reintento que sale bien → `error()` en `null` (AC6);
  - una de varias consultas con `{ error }` → carga fallida, sin total parcial (AC7).
- **Zona horaria:** los facades con fechas se corren con `node scripts/test-tz.mjs <specs>`.
- **E2E (AC8):** `e2e/transversal-shell.spec.ts` bloque X01. Cada etapa quita el `knownBug` de sus
  pantallas. Se corre contra el build de producción, como X01 original.
- **`/verify` por etapa:** caso A y caso B en claro y oscuro, y que la página siga app-like con el
  aviso visible.
- **Antes de cada PR:** `npm run lint:arch` y `npm run test:ci`.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Una lectura que hoy falla siempre (RLS, columna inexistente, vista con timeout) y pasa desapercibida empieza a mostrar error en producción | Media | Antes de mergear cada etapa, recorrer sus pantallas con cada rol (admin, secretaria de cada sede, instructor, alumno) con la red normal. Un error que aparezca ahí es un bug previo: se anota y se resuelve antes de salir |
| Una lectura secundaria (catálogo, nombres) tumba una pantalla entera | Media | Decisión 2 de la spec: en la etapa 1 siempre error completo; en las demás se decide por pantalla y se deja escrito en `tasks.md` |
| El detector da falsos positivos o deja pasar una forma nueva | Media | Tests propios del detector; lo que no cubre lo cubre el E2E. Un falso positivo se resuelve ajustando el detector, no agregando el archivo a `PENDING` |
| `enrollment.facade.ts` (22 lecturas) es el flujo de matrícula, el más sensible | Alta | PR propio dentro de la etapa 2, con la suite E2E de matrícula completa antes de mergear |
| Choque con `fix-073-i` (testing de Contabilidad, en curso) en la etapa 1 | Media | Avisar a Ignacio antes de empezar; partir de `main` con sus PR mergeados |
| El aviso del caso B rompe el layout fill-screen | Baja | Precedente y solución conocidos (`fix-044-i`); se verifica con `/verify` en cada pantalla |
| La spec queda abierta semanas y bloquea otros tracks del autor | Media | Cada etapa cierra con su PR; entre etapas se puede desactivar la spec y retomarla |

---

## 9. Orden de implementación

1. **Etapa 0 — Base (1 PR).** `assertReadOk` + spec · guard con `PENDING` completo · bloque X01 del
   E2E con `knownBug` · reglas `swr-pattern.md` y `facades.md` · gotcha e índices.
   Al terminar, `PENDING` y los `knownBug` son el tablero de avance de la spec.
2. **Etapa 1 — Dinero (1 PR).** `pagos` primero (confirmado en vivo, 8 lecturas), después
   `reportes-contables`, `liquidaciones`, `dashboard`, `enrollment-payment`, `anticipos`.
3. **Etapa 2 — Lecturas que alimentan una escritura (2 PR).** `enrollment` solo; el resto junto.
4. **Etapa 3a — Gestión Clase B (1 PR)** y **3b — Profesional (1 PR).**
5. **Cierre.** `PENDING` vacío, sin `knownBug` en X01, `/spec-verify`.

En cada facade: test en rojo → facade → pantalla → `/verify` → sacar de `PENDING`.

---

## 10. Estimación

**L.** Etapa 0: 1 día. Etapa 1: 1 a 2 días. Etapa 2: 2 a 3 días. Etapa 3: 2 a 3 días.
Total: 6 a 9 días de trabajo, en 6 PR.

---

## Changelog

- 2026-11-10 — plan inicial
- 2026-11-10 — T0.3: el guard dejó 31 facades en `PENDING` (se sumó `student-home`, cabecera de
  `Promise.all` en varias líneas que el conteo inicial no veía). `reportes-contables` y
  `servicios-especiales` pasan el guard: siguen en sus etapas como casos F3, a cargo del E2E.
- 2026-11-10 — T0.4: el E2E de X01 muestra que 10 pantallas ya avisan del error (varias por tracks
  posteriores a X01, como `fix-473-m` en Documentos). Servicios especiales ya no es caso F3. En
  Dashboard, Documentos y Flota la pantalla principal ya avisa, pero sus facades siguen en
  `PENDING`: las lecturas sin chequeo están en otros caminos (drawers, KPIs, refrescos), así que la
  etapa sigue siendo necesaria, con menos trabajo de pantalla.
