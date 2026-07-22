# Asignación ASG-025 — Fix H-037: botones y títulos recortados a mitad de palabra

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En la ficha de alumno (`/app/admin/alumnos/{id}`), los 6 botones de acción bajo la foto de perfil ("Reagendar Clases (2)", "Ver Contrato", "Carnet", etc.) se muestran cortados a mitad de palabra ("Reag...", "Ca...") sin puntos suspensivos ni tooltip — el texto completo SÍ está en el DOM. Causa raíz confirmada: son contenedores flex con un `<span class="truncate">` interno, pero el hijo flex no tiene `min-width: 0` (por defecto un ítem flex se niega a encogerse por debajo de su ancho de contenido), así que el truncado de Tailwind nunca se activa. Segunda instancia del mismo patrón: en el panel "Detalle de Instructor", el título de página "Instructores" se recorta a "Instruc...".

## Alcance sugerido

- Agregar `min-w-0` (o `min-width: 0`) al contenedor flex padre del `<span class="truncate">` en cada uno de los 6 botones — archivo: `admin-alumno-detalle.component.ts:331-347` y el sistema de `SectionHeroAction`.
- Mismo fix en la fila del título de página en Instructores (antes de los botones "Horas trabajadas"/"Nuevo Instructor").
- Alternativa si `min-w-0` no alcanza visualmente: envolver el texto en 2 líneas en vez de truncar en botones tan angostos.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-037 (con el fix sugerido ya detallado).

## Notas para quien la reclame

- Fix acotado y de bajo riesgo — es un problema clásico de Tailwind/Flexbox, no de contenido ni de lógica.
