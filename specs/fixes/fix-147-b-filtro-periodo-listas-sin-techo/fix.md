# Fix: Listas sin techo — filtro de período por defecto, con búsqueda y export que lo ignoran

> id: fix-147-b-filtro-periodo-listas-sin-techo
> refs: ASG-b-087
> status: in_progress
> created: 2026-08-22

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

<!-- Se completa durante la implementación. -->

Obligatorios (la lógica de ventana de período es lógica nueva → TDD):

- [ ] La ventana de 12 meses recorta la lista cuando no hay búsqueda activa.
- [ ] Con término de búsqueda activo, un registro **fuera** de la ventana **sí** aparece.
- [ ] El export parte del dataset completo, no de la vista recortada por período.
- [ ] `fetchAlumnosConDeuda` aplica `.limit(200)`.

## Verificación visual

`/verify` en las 3 páginas afectadas, con y sin drawer abierto (`force-compact`), y a 768px de
alto — checklist de edge cases de `indices/APP-LIKE-ROLLOUT.md`.
