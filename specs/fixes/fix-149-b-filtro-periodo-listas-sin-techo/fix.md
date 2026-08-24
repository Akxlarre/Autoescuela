# Fix: Listas sin techo — filtro de período por defecto, con búsqueda y export que lo ignoran

> id: fix-149-b-filtro-periodo-listas-sin-techo
> refs: ASG-b-087
> status: superseded
> superseded_by: 0038-b-filtro-periodo-listas-sin-techo
> closed: 2026-08-22
> created: 2026-08-22

> ⚠️ **Track convertido a spec el 2026-08-22, a pedido del owner.**
>
> La implementación terminó tocando 9 archivos y 4 superficies, más allá de lo que el contrato
> de un `fix` describe bien ("una causa raíz = un archivo", según el hook). El contrato vive
> ahora en **[`specs/specs/0038-b-filtro-periodo-listas-sin-techo/`](../../specs/0038-b-filtro-periodo-listas-sin-techo/spec.md)**,
> con 11 ACs verificables y su `acceptance.md`.
>
> **La conversión no cambió una línea de código** — el trabajo ya estaba hecho y verde. Este
> archivo se conserva porque documenta el proceso de descubrimiento (las decisiones tomadas
> sobre la marcha y los hallazgos), que la spec resume pero no reemplaza.

## Root Cause

[Heredado de ASG-b-087, a confirmar]: Tres listas históricas crecen sin techo y sin ventana de
tiempo por defecto. Investigación completa en `docs/research/listas-grandes-virtual-scroll.md`
(secciones 2, 2.1, 5.1 y 6), originada en `indices/APP-LIKE-ROLLOUT.md` §"Edge cases estresados"
y estresada con `/grill_me` el 2026-08-03.

**El problema de fondo no es performance, es un bug de UX silencioso.** Sin ventana de período
las listas se vuelven lentas con el tiempo; pero al *agregar* la ventana, si la búsqueda y el
export la respetan, aparecen dos fallas peores:

1. Buscar a un alumno con matrícula de hace 2 años devuelve **"0 resultados"** — el usuario
   concluye que el alumno no existe.
2. Exportar a Excel/PDF **trunca el historial en silencio**. Es peor que (1), porque una
   planilla incompleta no avisa que está incompleta.

Por eso la regla no negociable de esta asignación: **búsqueda y export operan siempre sobre el
dataset completo ya fetcheado, ignorando el filtro de período**.

### Estado revalidado contra `main` (2026-08-22)

La asignación vivió 19 días sin mergear y una de sus referencias quedó obsoleta:

| Punto | Estado | Nota |
|---|---|---|
| `.limit()` en deudores | Vigente | ⚠️ `fetchDeudores` se **renombró** a `fetchAlumnosConDeuda(branchId)` en `pagos.facade.ts`. Sigue sin `.limit()`. Patrón de referencia: `fetchPagosRecientes` con `.limit(50)` en `:302` |
| Período en `ex-alumnos` | Vigente | `ExAlumnosFacade.loadEgresadosList()` trae **todos** los `enrollments` con `status='completed'`, sin `.limit()` ni filtro de fecha. ⚠️ Trampa: el `.gte('updated_at', startOfYear)` cercano pertenece a `loadStatistics()` (conteo anual), **no** a la lista |
| Período en `servicios-especiales` | Parcial | La query ya tiene `.limit(200)` (`servicios-especiales.facade.ts:185`) — la parte "sin techo" ya no aplica; falta el selector de período |

## ACs Afectados

- Ninguno de una spec previa. La asignación nace de auditoría, no de un contrato existente.
- El comportamiento nuevo (búsqueda/export ignoran el período) se cubre con tests propios de
  este fix — ver "Test de Regresión".

## Cambio

<!-- Se completa durante la implementación. -->

### 1. Techo en la lista de deudores

- `pagos.facade.ts` → `fetchAlumnosConDeuda(branchId)`: agregar `.limit(200)`, mismo patrón que
  `fetchPagosRecientes`.

### 2. Selector de período — `ex-alumnos` (Clase B y Profesional)

- Default: **últimos 12 meses**. Opción alternativa: **todo el historial**.
- Misma ventana para ambos cursos (decisión ya tomada en el estrés-test — no usar ventanas
  distintas por curso).
- El filtro es **de renderizado, no de query**: el dataset completo se sigue fetcheando igual,
  para que búsqueda y export puedan operar sobre él.

### 3. Selector de período — `servicios-especiales` (historial de ventas)

- Mismo componente y mismo default que el punto 2.

### 4. Regla crítica: búsqueda y export ignoran el período

Patrón recomendado (§2.1 y §6 del research): un `computed()` que aplica la ventana de período
**solo cuando no hay término de búsqueda activo**. El export siempre parte del dataset completo,
nunca de la vista filtrada por período.

## Decisión pendiente al arrancar

El selector de período aplica hoy a 2 páginas y potencialmente a más listas históricas futuras.
La asignación deja abierto explícitamente si conviene un componente compartido reusable o
resolverlo suelto en cada página. **Decidir antes de escribir el segundo consumidor**, no
después.

## Fuera de alcance

- Virtual scroll y migración de tablas hand-rolled a `p-table` → eso es `ASG-b-088`, independiente.
- `liquidaciones`: investigada y descartada, ya está scopeada por mes
  (`liquidaciones-content.component.ts:739-748`).

## Test de Regresión

Obligatorios (la lógica de ventana de período es lógica nueva → TDD, escritos antes del código):

- [x] La ventana de 12 meses recorta la lista cuando no hay búsqueda activa.
      → `period-window.utils.spec.ts` — "recorta los registros anteriores al corte".
- [x] Con término de búsqueda activo, un registro **fuera** de la ventana **sí** aparece.
      → `period-window.utils.spec.ts` — "con búsqueda activa devuelve también los registros
      fuera de la ventana" + "la búsqueda activa manda incluso sobre la ventana más restrictiva".
- [x] El export parte del dataset completo, no de la vista recortada por período.
      → `servicios-especiales.facade.spec.ts` — "invoca la Edge Function solo con format y
      branch_id". En esta página el export es **estructuralmente** inmune: corre server-side y
      no recibe nada de la vista.
      → **Resuelto en ex-alumnos: no hay export.** Ni las páginas de Clase B ni el content de
      Profesional tienen botón de exportar, y `ExAlumnosFacade` no tiene ningún método de
      export. El riesgo de "planilla truncada en silencio" —el peor de los tres que la
      asignación anticipaba— **no existe en ninguna de las 3 superficies**: la única que
      exporta lo hace server-side.
- [x] `fetchAlumnosConDeuda` aplica `.limit(200)`.
      → `pagos.facade.spec.ts` — "aplica .limit(200) sobre la query de deudores" (verifica
      también el `.order('pending_balance', desc)` previo).

Extra, no previsto en el contrato original:

- [x] `fechaEgreso` se mapea con precisión de día, no solo el año.
      → `ex-alumnos.facade.spec.ts` — "mapea fechaEgreso con precisión de día".

**Estado: suite completa `npm run test:ci` en verde — 2229 passed / 5 skipped (180 archivos).**
`tsc --noEmit` limpio, `lint:arch` exit 0.

## Progreso — COMPLETO

- [x] Núcleo funcional + tests (TDD)
- [x] `app-period-selector` (Dumb compartido) — índices actualizados
- [x] `.limit(200)` en deudores
- [x] Consumidor 1/4: `servicios-especiales` — verificado en navegador
- [x] Consumidor 2/4: `ex-alumnos` Clase B admin — verificado en navegador (incluye la nota
      "Buscando en todo el historial" al escribir en el buscador)
- [x] Consumidor 3/4: `ex-alumnos` Clase B secretaría — verificado en navegador
- [x] Consumidor 4/4: `app-ex-alumnos-profesional-content` — verificado en navegador

## Decisiones tomadas durante la implementación

1. **Componente compartido, no inline.** 4 puntos de consumo; inlinearlo 4 veces es como se
   llegó a los 221 overlines ad-hoc de `fix-078-b`.
2. **Nota "Buscando en todo el historial"** en vez de deshabilitar el selector (decisión del
   owner): un control que se apaga solo se lee como bug.
3. **Unificar el filtro de año dentro del selector** (decisión del owner) en Clase B. No era
   cosmético: eran dos controles de tiempo compitiendo, y con la ventana por defecto activa
   elegir un año viejo devolvía 0 filas. El mismo bug silencioso que el fix combate, entrando
   por otra puerta. En Profesional no aplica — ahí el otro filtro es por clase, no por tiempo.

## Hallazgos

- **`fechaEgreso` (corrección de precisión).** El row solo exponía `anio`, derivado de
  `updated_at` descartando el día: alguien que egresó en diciembre quedaba fuera de la ventana
  de 12 meses por hasta 11 meses de error. Se agregó el campo ISO completo.
- **El riesgo de export truncado no existe** en 2 de las 3 superficies (no hay export) y es
  estructuralmente imposible en la tercera (server-side).
- **Trampa de backticks.** El comentario que agregué en `secretaria-ex-alumnos.component.ts`
  llevaba backticks dentro del `template` literal y lo terminaba antes de tiempo — 3 errores de
  `tsc` en lugares no relacionados. Es exactamente la trampa documentada en `visual-system.md`
  (spec 0030). Quedó una nota en el propio comentario para el próximo que edite ahí.

## Nota de alcance (para la revisión)

El hook advierte "un fix = una causa raíz = un archivo tocado". Este fix toca **9 archivos**.
La causa raíz **es una sola** y el diff es coherente, pero el volumen viene de que la misma
lista existe duplicada en 2 páginas — deuda ya registrada como `ASG-b-096`. Si el revisor
prefiere tratarlo como spec, el contenido ya está escrito y solo habría que reformularlo con
ACs; no cambiaría una línea de código.

## Verificación visual

`/verify` en las 3 páginas afectadas, con y sin drawer abierto (`force-compact`), y a 768px de
alto — checklist de edge cases de `indices/APP-LIKE-ROLLOUT.md`.
