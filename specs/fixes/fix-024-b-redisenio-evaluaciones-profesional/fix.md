# Fix: Rediseño completo de evaluaciones profesionales (gradebook)
> id: fix-024-b-redisenio-evaluaciones-profesional
> refs: —
> status: in_progress
> created: 2026-06-15

## Root Cause
La página `/app/admin/clase-profesional/evaluaciones` se construyó como
"dos selects + una tabla" en lugar de como un libro de calificaciones (gradebook).
La capa de datos (`EvaluacionesProfesionalFacade`) es sólida, pero la UI no
comunica contexto (qué módulo se está calificando), no instrumenta el progreso
(sin KPIs), corrige notas en silencio, deja botones mudos cuando están
deshabilitados, y no ofrece flujo de teclado para entrada masiva de notas.
Es la página más rezagada del sistema en UX respecto al estándar de Asistencia /
Certificaciones.

## ACs Afectados
Ninguno — fix autónomo (la página no tenía spec con ACs). El fix no altera el
contrato de datos ni la lógica de negocio; es rediseño de presentación +
interacción sobre la facade existente.

### Criterios de aceptación del rediseño (auto-declarados)
- AC1: Los headers de la tabla muestran el nombre real del módulo (no solo "Mod N").
- AC2: Existe un KPI strip con: alumnos completos, promedio del curso, en riesgo (<75), módulos cargados. Todo derivado de `facade.grilla()`.
- AC3: El hero es adaptativo: al elegir curso muestra identidad del curso + estado (En edición / Confirmadas) + chip "Cambios sin guardar" cuando `hayDirty()`.
- AC4: La columna "Alumno" es sticky en scroll horizontal; el header de la tabla es sticky en scroll vertical.
- AC5: Cada fila muestra progreso de módulos completados (N/7).
- AC6: Navegación por teclado entre celdas: Enter baja, Tab avanza (sin romper la validación numérica existente).
- AC7: Botones deshabilitados explican por qué (tooltip/texto contextual).
- AC8: La corrección de nota mínima (<10 → 10) avisa al usuario (toast).
- AC9: La leyenda (aprobado/reprobado) está separada de los botones de acción.
- AC10: En móvil, la grilla colapsa a tarjetas por alumno (no scroll horizontal de inputs diminutos).
- AC11: Pluralización correcta de "alumno(s)".
- AC12: Cero violaciones de `npm run lint:arch`. Tokens DS, `app-icon`, GSAP canon.

## Cambio
- **Archivo:** `src/app/features/admin/profesional-evaluaciones/admin-profesional-evaluaciones.component.ts`
- **Qué cambia:** Reescritura del template + handlers de presentación (teclado, computed de KPIs/progreso, hero adaptativo). La facade NO se toca.
- **Posibles archivos nuevos:** componente(s) dumb reutilizables para gradebook (header de módulo, celda de nota) si la extracción aporta — candidatos a Asistencia / Libro de Clases.

## Test de Regresión
> Nota: vitest del proyecto NO compila templates de componentes (sin plugin Angular),
> por eso los component specs están excluidos. La lógica nueva se cubre en la capa
> de utils (puro) y facade — ambas corren en vitest. La capa visual del componente
> se valida con `ng build` + `/verify`.

- `src/app/core/utils/gradebook-stats.spec.ts` — 13 tests (AC2 KPIs + AC5 progreso) ✓ verde
- `src/app/core/facades/evaluaciones-profesional.facade.spec.ts` — 5 tests (AC8 corrección nota mínima + dirty tracking) ✓ verde
- `ng build` exit 0 — compila template + TypeScript del componente rediseñado ✓
- `npm run lint:arch` — cero violaciones nuevas (solo flag preexistente `ConfirmModalService`) ✓
- Verificación visual `/verify` — grilla, sticky, estados de celda, modo oscuro, responsive móvil (pendiente: requiere sesión iniciada en el navegador).
