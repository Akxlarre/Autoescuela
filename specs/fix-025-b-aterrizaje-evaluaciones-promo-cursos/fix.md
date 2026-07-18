# Fix: Aterrizaje de evaluaciones — promoción-padre con tarjetas de curso
> id: fix-025-b-aterrizaje-evaluaciones-promo-cursos
> refs: fix-024-redisenio-evaluaciones-profesional
> status: done
> created: 2026-06-16

## Root Cause
Tras el rediseño del gradebook (fix-024), el **estado inicial** de la página
seguía sintiéndose vacío: hero + un par de selectores solitarios + un placeholder.
Con 0 o 1 promoción, un dropdown/píldora de una sola opción se ve patético.
Causa de fondo: se usan **controles de formulario para "elegir"** cuando el
dominio pide **contenido**. Además invertía la jerarquía: la promoción —el objeto
padre que se crea, contenedor de 1..N cursos— quedaba como filtro secundario.

## ACs Afectados
Ninguno — fix autónomo (continúa el rediseño de fix-024 sin alterar el contrato
de datos del gradebook ni su flujo de carga de grilla).

### Criterios de aceptación (auto-declarados)
- AC1: El estado inicial muestra la(s) promoción(es) activa(s) como **cabecera-padre**
  con sus cursos anidados como **tarjetas**, no como selectores vacíos.
- AC2: Cada tarjeta de curso muestra resumen vivo: total alumnos, alumnos con notas,
  promedio del curso, y estado (`sin_iniciar` / `en_edicion` / `confirmada`).
- AC3: Click en una tarjeta de curso carga la grilla (flujo existente de `selectCurso`);
  hay una acción para **volver** al aterrizaje desde la grilla.
- AC4: 0 promociones activas → **estado vacío real** con CTA "Crear promoción".
- AC5: La cabecera de promoción muestra totales (nº cursos, nº alumnos, nº confirmados).
- AC6: El hero se mantiene.
- AC7: La lógica de armado del aterrizaje vive en **funciones puras** testeadas
  (`buildLanding`), no en la facade ni el componente.
- AC8: Cero violaciones nuevas de `npm run lint:arch`; `ng build` verde; verificación visual.
- AC9: Escala por cardinalidad: 0 → vacío; 1 → un grupo lleno; varias activas → grupos
  apilados. Solo se cargan promociones activas (`planned`/`in_progress`) — las históricas
  no se renderizan (búsqueda histórica = follow-up).

## Cambio
- **`core/models/ui/evaluaciones-profesional.model.ts`** — `CursoResumen`, `PromocionConCursos`, `CursoEstado`.
- **`core/utils/evaluaciones-landing.ts`** (nuevo) — `buildLanding(promotions, courses, enrollments, grades)` puro + spec.
- **`core/facades/evaluaciones-profesional.facade.ts`** — `loadLanding()`, signal `landing`, `cerrarGrilla()`.
- **`features/admin/profesional-evaluaciones/admin-profesional-evaluaciones.component.ts`** — template del aterrizaje (grupos de promoción + tarjetas de curso + estado vacío), botón "volver".

## Test de Regresión
- `src/app/core/utils/evaluaciones-landing.spec.ts` — armado del aterrizaje por cardinalidad y resumen de cursos (estado, promedio, conteos).
- `ng build` exit 0 — compila template + TypeScript.
- `npm run lint:arch` — cero violaciones nuevas.
- Verificación visual `/verify` — aterrizaje con tarjetas, estado vacío, click→grilla, volver.
