# Fix: Rail de alertas comprimido — fila de 2 líneas
> id: fix-047-b-alertas-fila-2-lineas
> refs: 0030-asistencia-b-layout-dual
> status: done
> closed: 2026-07-16
> created: 2026-07-16

## Root Cause
En el rail de alertas (Prácticas, `asistencia-clase-b-content`), cada alerta mete avatar +
nombre + "— N faltas" + botón en UNA sola línea dentro de un rail `w-80` (320px). Con
~180px útiles para texto, el nombre y el conteo se **truncan** ("12 f…"). Además datos del
modelo (`ultimaFechaFalta`, `branchName`, la política) sólo viven en el `title` nativo →
poco descubribles. El origen es la compresión de spec 0030 (tabla protagonista), que peleó
espacio horizontal cuando el rail en realidad tiene espacio vertical de sobra (scrollea).

## ACs Afectados
Ninguno funcional — mejora de legibilidad/UX del rail de alertas. No cambia acciones
(Eliminar / Reactivar / Recordar) ni contratos.

## Cambio
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- **Qué cambia:** cada alerta pasa de 1 a **2 líneas** (decisión del owner):
  - Línea 1: avatar + nombre completo (sin truncar, wrap si hace falta).
  - Línea 2: "N faltas · últ. DD-MM" (saca la fecha del tooltip) + botón de acción.
  - Rail sigue `w-80` → la tabla mantiene su ancho (tabla protagonista intacta).
  - Nuevo helper `formatIsoDateShort()` (DD-MM). Se conserva el `title` (política) como
    enriquecimiento en hover.
  - Ajuste del skeleton del rail (fix-046) al alto de la nueva fila para mantener fidelidad.

## Test de Regresión
Cambio de layout (template). Verificación:
- `ng build` compila.
- `/verify` (Playwright): en Prácticas con datos, los nombres se ven completos (sin "…"),
  la última fecha es visible en la fila, las 3 acciones siguen funcionando, y el ancho de
  la tabla no cambia. Light + dark.
