# Hotfix: El título del modal de archivar alumno casi no se ve
> id: hotfix-122-m-modal-archivar-titulo-invisible
> refs: —
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
En el modal "Archivar alumno" / "Archivar con historial", el título se ve casi blanco sobre el fondo blanco de la tarjeta. Reportado por el owner con captura (2026-10-01).

**Causa:** el título usa la clase `text-base` pensando en el tamaño de letra (1rem), pero en este proyecto el `@theme` define `--color-base` (el fondo de la página, `src/tailwind.css:44`), así que Tailwind genera `text-base` como utilidad de **color**: pinta el texto con el color de fondo de la página. El título no tenía ninguna otra clase de color que lo corrigiera.

## Cambios
- **Archivo:** `src/app/shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts` — el título deja de usar `text-base` y lleva `text-text-primary`. El tamaño no cambia: sigue en 16px, heredado.

## Verificación
Verificado el 2026-10-01 en navegador, abriendo el modal desde la lista y desde la ficha: el color calculado del título es `rgb(9, 9, 11)` en modo claro y `rgb(244, 244, 245)` en modo oscuro, a 16px. Captura revisada.

## Fuera de este hotfix
`text-base` aparece en otros 24 lugares de 17 archivos (entre ellos `eliminar-servicio-modal` y `ciclos-teoricos-content`, con el mismo patrón de título). Donde no haya otra clase de color después, el texto tiene el mismo problema. Queda para un fix aparte, idealmente con un guardrail como ARCH-22 que bloquee `text-base`.
