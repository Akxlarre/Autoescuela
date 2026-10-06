# Hotfix: La Agenda promete "agendar" en un detalle de solo lectura y la pastilla de estado sale sin color
> id: hotfix-060-b-agenda-slot-textos-y-color
> refs: ASG-i-026 (hallazgo H5 de fix-186-b — sospecha S18 del checklist 026)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Problema
[Confirmado en fix-186-b, casos E01b y E03.]
1. El horario libre de la Agenda tiene `aria-label` "… Clic para agendar." y
   `data-llm-action="schedule-class"`, pero la Agenda es de solo lectura desde `fix-017`: el clic
   abre un detalle sin acciones. Un lector de pantalla o un agente promete algo que no existe.
2. En el detalle del slot, "Agendada" y "En progreso" usan la variante `brand`, que arma
   `var(--state-brand)`: ese token no existe → la pastilla sale sin fondo ni color.

## Cambios
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-slot.component.ts` — aria-label
  "Clic para ver detalle" y `data-llm-action="view-available-slot"` en los horarios libres.
- **Archivo:** `src/app/features/agenda/agenda-slot-detail-drawer.component.ts` — la variante `brand`
  usa `var(--ds-brand)` (el mismo color que el slot en la grilla).
- **Archivo:** `e2e/agenda.spec.ts` — E01b y E03 dejan de ser `knownBug`; los selectores usan la
  acción nueva.

## Verificación
- E2E `e2e/agenda.spec.ts` contra el build de producción (E01b, E03 sin `knownBug`).
- `ng build`, `lint:arch`, `test:ci`.
- Resultado: E2E del detalle de slot 4/4 con E01b y E03 **sin** `knownBug` (aria-label sin
  "agendar"; pastilla "Agendada" con fondo); C06 sigue fallando por S3 como se espera.
  `ng build` OK, `lint:arch` 0 errores, `test:ci` 3353/3353.
