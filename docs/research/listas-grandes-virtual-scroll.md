# Listas grandes sin paginar — virtual scroll vs paginación vs otro mecanismo

> **Origen:** hallazgo "Edge cases estresados" de la auditoría app-like (2026-08-02), sección
> *"Datasets grandes en listas 'mostrar todo + scroll interno' (sin paginar)"* —
> `indices/APP-LIKE-ROLLOUT.md` (rama `claude/tareas-pendientes-sfh2vp`, no presente en esta rama).
> Ese hallazgo dejó la tarea explícitamente como "requiere investigación" y "no bloquea el
> rollout". Este documento es esa investigación.
>
> **Alcance de la decisión de diseño (specs 0028-0031):** las páginas del rollout app-like
> eliminaron deliberadamente la paginación clásica ("Anterior/Siguiente") a favor de "mostrar todo
> lo filtrado + scroll interno" en desktop, con densidad incremental ("Cargar más") solo en mobile.
> El objetivo de UX es que la secretaria vea de un vistazo TODO lo que coincide con su filtro, sin
> clickear entre páginas. Este documento no cuestiona esa decisión — asume que se mantiene, y
> resuelve el problema de escala que puede romperla.

## 1. Metodología

No arranco de un número arbitrario. Combino tres fuentes:

1. **Modelo de negocio real** (`docs/PRODUCT-VISION.md`, `docs/Análisis Base de Datos.md`): el
   sistema es para **una sola empresa con 2 sedes** (Autoescuela Chillán — Clase B/SENCE,
   Conductores Chillán — Profesional A2-A5), NO un SaaS multi-tenant con escuelas ilimitadas. Esto
   acota el "peor caso" de forma importante: el multiplicador de "Todas las sedes" es **×2**, no
   ×N escuelas.
2. **Conteos reales vía Supabase MCP** (proyecto `AutoescuelaChillan`, `skvekggejikzxhzsjmkz`):
   consulté las tablas de negocio directamente. Hoy son datos de **seed/dev** (`students`: 49,
   `enrollments`: 48, `instructors`: 6, `vehicles`: 6, `payments`: 50, `special_service_sales`: 1,
   `users`: 58, rango de fechas real de `students` desde 2026-03-06 hasta 2026-08-02 — 5 meses de
   seed, no de uso orgánico). Estos números **no sirven para proyectar el techo real** — son un
   snapshot de datos de prueba, no de producción en régimen. Los uso solo para confirmar la forma
   de cada tabla (bounded vs acumulativa), no la magnitud.
3. **Razonamiento de crecimiento por tipo de entidad**, usando el contexto de negocio (una
   autoescuela mediana en Chillán, ~180k habitantes) para estimar tasas anuales realistas.

## 2. Clasificación de listas por riesgo real de crecimiento

### Categoría A — Acotadas por naturaleza (nunca necesitan virtual scroll)

Estas entidades tienen un techo estructural que no depende del tiempo: son "cuántas personas/
vehículos tiene la empresa", no "cuánto historial se acumuló".

| Lista | Entidad | Techo realista (2 sedes combinadas) | Por qué |
|---|---|---|---|
| `/admin/instructores`, `/secretaria/instructores` | `instructors` | 10-30 | Planta docente de una autoescuela mediana; hoy 6 en seed. Aunque la empresa duplique tamaño, no pasa de unas pocas decenas |
| `/admin/secretarias` | `users` (rol secretaria) | 3-8 | Personal administrativo, no crece con el negocio |
| `/admin/flota` | `vehicles` | 10-40 | Flota física, tiene costo de capital — no se acumula "historial", es inventario activo |
| `/admin/flota/:id/mantenimientos` | `vehicle_maintenances` | 20-60 por vehículo | Mantenimientos periódicos de UN vehículo, no de toda la flota junta |

**Recomendación:** no tocar. El patrón actual ("mostrar todo + scroll interno") se queda como
está indefinidamente — son las decisiones ya tomadas en `APP-LIKE-ROLLOUT.md` para estas páginas.

### Categoría B — Acumulativas con techo natural de negocio (crecen con el calendario, lento)

Estas SÍ acumulan historial año tras año, pero a una tasa acotada por la capacidad física de la
escuela (cupos de clases, instructores disponibles, vehículos).

| Lista | Entidad | Tasa anual estimada (2 sedes) | Acumulado a 5 años (sin archivar) |
|---|---|---|---|
| `/admin/ex-alumnos`, `/admin/ex-alumnos-profesional` | `students` (estado retirado/finalizado) | Clase B: 240-600/año · Profesional: 120-240/año | 1.200-3.000 (Clase B) · 600-1.200 (Profesional) |
| `/admin/servicios-especiales` (historial de ventas) | `special_service_sales` | 60-240/año | 300-1.200 |

> **Corrección (estrés-test 2026-08-03):** `/admin/contabilidad/liquidaciones` **NO es Categoría
> B** — clasificación original errónea. Verificado en `liquidaciones-content.component.ts:739-748`:
> el input `liquidaciones` viene scopeado por `mesActual`/`anioActual` con navegación
> `mesAnterior`/`mesSiguiente` — cada vista muestra la nómina de **un mes** (6-15 filas, una por
> instructor), nunca acumula. Mismo patrón que `historial-cuadraturas` (ya correctamente excluida
> abajo). Es **Categoría A**: no necesita filtro de período ni virtual scroll, nunca lo necesitó.
> Ya tiene exportar a Excel/PDF (`exportRequested`) sobre ese mes — confirma que el patrón de
> export de este proyecto siempre es "request → el Smart Component re-deriva", nunca lee del DOM
> renderizado, lo cual es relevante para §3: activar virtual scroll en las páginas que sí lo
> necesiten no debería romper ningún export existente en el proyecto, todos siguen ese patrón.

| `/admin/contabilidad/historial-cuadraturas` | cierres de caja diarios | 2 sedes × 365 = 730/año | 3.650 (pero ya acotado por celda de calendario, máx 42 celdas visibles a la vez — **no aplica** este problema, se filtra por mes) |

**Recomendación:** la primera defensa NO es virtualización — es **acotar por defecto con un
filtro de período** (ej. "últimos 12 meses" preseleccionado en ex-alumnos e historial de ventas,
igual que liquidaciones/cuadratura ya hacen implícitamente por período/mes). Esto resuelve el
caso común sin tocar una línea de renderizado. La virtualización entra como **segunda defensa**
solo para cuando alguien expande explícitamente a "todo el historial" + "todas las sedes" — ver
umbral en §4.

#### 2.1 ⚠️ La búsqueda NUNCA puede quedar atrapada por el filtro de período

Riesgo real señalado en revisión: si "últimos 12 meses" es un filtro duro, buscar por nombre a
alguien con una matrícula de hace 2 años devuelve "0 resultados" — y eso se lee como "no existe",
no como "está fuera de rango". Es el peor tipo de bug: silencioso, y en una lista de *personas*
(no de reportes), donde el caso de uso típico de secretaría es exactamente ese ("¿tenemos algo de
esta persona?").

Verifiqué `ExAlumnosFacade.loadEgresadosList()` (`src/app/core/facades/ex-alumnos.facade.ts:137-174`):
**hoy no filtra por fecha en absoluto** — trae todos los `enrollments` con `status='completed'`
de la sede activa, sin ningún `.gte()`/`.lte()` sobre `updated_at`. Es decir, el dataset completo
ya vive en el signal `_egresados()` en memoria. Esto cambia el diseño de la propuesta: el filtro
de período de §2 **no debe implementarse como query con scope de fecha** (eso sí perdería los
registros viejos de la memoria del cliente) — debe implementarse como un filtro puramente de
**qué se renderiza**, igual que ya funciona `filteredAlumnos` en `alumnos-list-content.component.ts`.

**Regla de diseño:** el término de búsqueda (nombre/RUT/n° expediente) siempre debe evaluarse
contra el dataset **completo** ya fetcheado, ignorando el filtro de período. El período solo
acota la vista de "explorar sin buscar nada" (browse mode):

```typescript
readonly filteredEgresados = computed(() => {
  const term = this.searchTerm();
  const base = term ? this.egresados() : this.egresadosEnPeriodo(); // período solo aplica sin búsqueda
  return base.filter(matchesSearchAndOtherFilters(term, ...));
});
```

Con esto, buscar SIEMPRE encuentra al alumno sin importar la antigüedad — y como una búsqueda por
nombre normalmente devuelve un puñado de coincidencias (no cientos), tampoco compromete el umbral
de virtual scroll de §4: la búsqueda casi nunca es el caso que dispara el problema de DOM grande,
solo el browse sin filtrar lo es.

**Corolario de UI:** si el selector de período sigue mostrando "Últimos 12 meses" mientras la
búsqueda trae un resultado de hace 3 años, es un estado visualmente inconsistente (el control dice
una cosa, la lista muestra otra). Dos formas simples de resolverlo, a decidir en el fix: (a)
deshabilitar/ocultar visualmente el selector de período mientras hay un término de búsqueda activo
(implícitamente pasa a "todo el historial"), o (b) mostrar una nota bajo el buscador tipo
"Buscando en todo el historial" cuando el campo tiene texto. Cualquiera de las dos es preferible a
dejar el selector mintiendo sobre el alcance real de lo que se está mostrando.

Esta misma regla aplica a **todas** las listas de Categoría B que terminen adoptando el filtro de
período (servicios-especiales, liquidaciones si alguna vez gana buscador) — no es específica de
ex-alumnos, es la forma correcta de combinar "scope por defecto" con "buscador libre" en cualquier
lista de este proyecto.

### Categoría C — Operacionales, deberían estar acotadas por diseño de query (no por UI)

> **Verificado en código (estrés-test 2026-08-03), no solo sospechado.**

| Lista | Entidad | Riesgo real |
|---|---|---|
| `/admin/pagos` — Pagos Recientes | `payments` | **Ya resuelto.** `PagosFacade.fetchPagosRecientes()` (`pagos.facade.ts:290-298`) ya tiene `.limit(50)` server-side ordenado por `created_at desc` — techo duro independiente del volumen total de pagos. No requiere ningún cambio |
| `/admin/pagos` — Deudores | `payments` (`pending_balance > 0`) | `PagosFacade` línea 265-271: `.gt('pending_balance', 0).order('pending_balance desc')`, **sin `.limit()`**. No acumula con el calendario como Categoría B (es estado actual — se autolimita cuando la gente paga), pero no tiene el resguardo duro que sí tiene Pagos Recientes. Riesgo bajo en el negocio real (techo natural = cuántos alumnos activos+recientes tienen deuda simultánea, no debería superar unos cientos ni en el peor caso), pero es la única lista de Categoría C sin ningún techo — candidata a agregar `.limit(200)` (barato, consistente con el patrón ya usado en Pagos Recientes) más que a virtualizar |

## 3. Comparación de mecanismos

| Mecanismo | Pro | Contra | Veredicto |
|---|---|---|---|
| **Mantener "mostrar todo + scroll" tal cual** | Cero esfuerzo, cero riesgo de regresión | DOM crece sin techo en Categoría B una vez pasados varios años sin archivar | Solo válido para Categoría A |
| **Volver a paginación real (Anterior/Siguiente)** | Techo de DOM garantizado | Contradice la decisión de diseño ya tomada y ejecutada en specs 0028-0031 (razón explícita por la que se sacó la paginación: "ver todo lo filtrado de un vistazo"). Reintroducirla es un paso atrás de UX, no una mejora | Rechazado como default. Ya es la excepción correcta en `/admin/auditoria` (logs de seguridad, semántica distinta, paginación server-side ya justificada) |
| **"Cargar más" infinito en desktop (mismo patrón que mobile)** | Reusa código existente (`sliceByBudget`) | No resuelve el problema: los items cargados se acumulan en el DOM igual que "mostrar todo", solo retrasa cuándo se llega al DOM gigante. No es virtualización real | Rechazado como solución de fondo, sirve solo como affordance de UX si se combina con virtual scroll por debajo |
| **Filtro de período por defecto** (últimos 12 meses, con opción "ver todo el historial") | Resuelve el caso común con cero complejidad técnica. Mismo espíritu que el scope-por-mes que ya usa `cuadratura`/`liquidaciones` (aunque esas ni siquiera necesitan el fix, ver nota de Categoría B) | No resuelve el caso "alguien SÍ necesita ver 5 años de historial completo" (auditorías, reportes anuales) | **Adoptar como primera defensa en Categoría B** |
| **Virtual scroll (`p-table [virtualScroll]`, backed por Angular CDK)** | Techo de DOM real independiente del tamaño del dataset filtrado. PrimeNG 21 lo integra nativamente sobre `[scrollable]="true" scrollHeight="flex"` — el mismo patrón que YA se adoptó en `flota-list-content`, `dms-list-content` y `vehicle-maintenances` (ver `APP-LIKE-ROLLOUT.md`) | Requiere altura de fila fija (`virtualScrollItemSize`) — hay que auditar que ninguna fila tenga contenido multilínea variable. Rompe Ctrl+F nativo del navegador dentro de la tabla (aceptable: estas listas ya tienen su propio buscador/filtro in-app). Las tablas hechas a mano con `<table>`+`<tr>` (instructores, secretarias, servicios-especiales-historial, tablas de contabilidad) NO tienen virtual scroll gratis — primero habría que migrarlas a `p-table` | **Adoptar como segunda defensa, activada solo sobre el umbral (§4), y solo en las páginas de Categoría B cuando superen el filtro de período por defecto** |
| **CDK `cdk-virtual-scroll-viewport` crudo (sin PrimeNG)** | Más flexible para listas no tabulares | Mayor esfuerzo de integración con `<table>` semántico; el proyecto no lo usa hoy en ningún lado (grep confirma cero usos) | Descartado — si una página no usa `p-table`, migrarla a `p-table` primero es menos esfuerzo que adoptar CDK crudo, y da consistencia con el resto del DS |

## 4. Umbral recomendado

**300 filas filtradas** como punto de activación de `[virtualScroll]` en las páginas de
Categoría B, después de aplicar el filtro de período por defecto. Razonamiento:

- Es **más alto que cualquier techo realista de Categoría A** (10-60 filas) — esas páginas nunca
  pagan el costo de complejidad de CDK.
- Es **más bajo que el acumulado a 5 años sin archivar de Categoría B en "todas las sedes" + "todo
  el historial"** (600-3.000 filas) — exactamente donde SÍ hace falta.
- Con el filtro de período por defecto activo (últimos 12 meses), el caso común de Categoría B
  cae naturalmente por debajo de 300 (240-600/año repartido en 12 meses ≈ 20-50/mes visible, un
  año completo ronda 300-600 — es decir, el umbral se cruza justo en el rango donde YA tiene
  sentido virtualizar incluso el filtro por defecto en la sede más grande).
- El número no reemplaza una medición empírica real: es un punto de partida defendible con los
  datos de negocio disponibles hoy. **Antes de fijarlo en código, validar con una pasada de
  Performance (Chrome DevTools o Playwright) sembrando ~500-1.000 filas sintéticas** en una de
  estas tablas (ej. `special_service_sales` o `ex-alumnos`) para confirmar en qué punto el
  re-render de un filtro (`@for` con OnPush) empieza a sentirse lento en hardware típico de
  secretaría (no una laptop de desarrollo) — ese dato empírico debería reemplazar el 300 antes de
  cerrar el fix.

## 5. Alcance final (post estrés-test 2026-08-03): partido en 2 tracks

El interrogatorio redujo el problema real bastante más de lo que parecía en la auditoría original
(§7 tiene el detalle completo de cada hallazgo). Con eso, el trabajo se reparte en dos tracks de
naturaleza distinta — uno de corrección barata e inmediata, otro de investigación empírica que
debe EJECUTARSE (simulada, no esperada) antes de decidir si construir virtual scroll:

### 5.1 Fix inmediato (barato, sin dependencias)

1. **`PagosFacade.fetchDeudores`** (`pagos.facade.ts:265-271`) — agregar `.limit(200)`, mismo
   patrón que ya usa `fetchPagosRecientes` dos métodos más abajo. Es la única lista de Categoría C
   sin ningún techo hoy.
2. **Filtro de período por defecto** en `ex-alumnos` (Clase B y Profesional, misma ventana de 12
   meses corridos para ambos) y `servicios-especiales` (historial de ventas): selector "Últimos 12
   meses / Todo el historial", default al primero. Filtro de **renderizado**, no de query — el
   dataset completo se sigue fetcheando igual que hoy (ver §2.1).
3. **Búsqueda y exportar siempre ignoran el filtro de período por defecto** — ambos operan sobre
   el dataset completo ya fetcheado. Ver §2.1 (búsqueda) y la regla de exportar acordada en el
   estrés-test: el período por defecto es conveniencia de visualización, nunca recorte de datos.
4. **`liquidaciones` no se toca** — confirmado Categoría A, ya scopeada por mes.

### 5.2 ASG separada: investigación empírica de virtual scroll (no bloquea el fix de arriba)

El equipo decidió explícitamente **no** dejar esto como "esperar a que pase en producción" — se
puede y se debe simular ahora, como un track de investigación con entregable propio:

1. Sembrar ~500-1.000 filas sintéticas en `special_service_sales` y/o `enrollments` (ambiente de
   dev/staging, nunca producción) para tener un dataset realista del "peor caso a 5 años".
2. Correr una pasada de Performance (Chrome DevTools o Playwright) sobre `ex-alumnos` y
   `servicios-especiales` con ese volumen sembrado, filtrando/buscando como lo haría una
   secretaria real, en hardware típico de oficina (no laptop de desarrollador).
3. Con el dato empírico de en qué punto el re-render (`@for` + OnPush) empieza a sentirse lento,
   confirmar o ajustar el umbral de 300 filas de §4.
4. Solo si el benchmark confirma jank real por debajo del acumulado proyectado a 5 años,
   implementar: migrar las tablas hand-rolled afectadas a `p-table` (prerequisito) y activar
   `[virtualScroll]="true" [virtualScrollItemSize]="N"` sobre el umbral confirmado, como constante
   compartida (`LIST_VIRTUAL_SCROLL_THRESHOLD` en `core/utils/layout-tier.utils.ts`).

Este documento **no crea ningún track todavía** — es la investigación que el hallazgo de
`APP-LIKE-ROLLOUT.md` pedía. Ya se creó la asignación de equipo (paso previo a spec/fix, ver
`specs/AUTHORS.md`) para cada mitad, quedan disponibles en `specs/ASSIGNMENTS.md` para que
cualquiera del equipo las reclame con `/assign-claim`:

- **[ASG-b-087](../../specs/assignments/ASG-b-087-filtro-periodo-defecto-listas-sin-techo.md)** —
  §5.1 (fix inmediato: límite en Deudores + filtro de período + búsqueda/export lo ignoran).
- **[ASG-b-088](../../specs/assignments/ASG-b-088-investigacion-virtual-scroll-umbral.md)** —
  §5.2 (investigación empírica de virtual scroll, no bloquea la anterior).

## 6. Hallazgos del estrés-test (2026-08-03)

Antes de convertir esto en tracks, se sometió la propuesta a un interrogatorio dedicado
(`grill_me`). Resultado: **3 correcciones reales** sobre la investigación original, no solo
ratificación:

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | `liquidaciones` estaba mal clasificada como Categoría B | Es Categoría A — ya scopeada por mes (`mesActual`/`anioActual`), nunca acumula. Verificado en `liquidaciones-content.component.ts:739-748` |
| 2 | El filtro de período por defecto podía esconder resultados de **búsqueda** de matrículas viejas | Búsqueda siempre ignora el período, corre sobre el dataset completo (ya resuelto en §2.1 de una ronda anterior) |
| 3 | El mismo filtro podía truncar silenciosamente un **export** a Excel/PDF sin que nadie lo note | Exportar también ignora el período por defecto siempre — mismo principio que la búsqueda, pero más peligroso porque un Excel incompleto no "grita" el error como sí lo hace un buscador con 0 resultados |

Y **2 sospechas descartadas** al verificar contra el código real en vez de asumir:

| # | Sospecha original | Verificado |
|---|---|---|
| 4 | "Pagos Recientes" podría traer todo el historial sin scope | Ya tiene `.limit(50)` server-side (`pagos.facade.ts:290-298`) — no necesita ningún cambio |
| 5 | Las filas de `ex-alumnos`/`servicios-especiales` podrían tener altura variable, bloqueando `virtualScrollItemSize` fijo | Ambas tablas son celdas de línea fija (nombre+email apilado, badges, fecha) — sin bloqueo técnico |

Decisiones de proceso acordadas con el equipo:
- Umbral de 300 filas: **no bloquea el fix**, queda como constante nombrada ajustable.
- El umbral aplica igual sin importar cómo se llegue a más de 300 filas (búsqueda o browse).
- Misma ventana de 12 meses para Clase B y Profesional (no una ventana por curso).
- Virtual scroll se separa en su propia ASG, con benchmark empírico simulado como entregable —
  no se espera a que ocurra orgánicamente en producción.
