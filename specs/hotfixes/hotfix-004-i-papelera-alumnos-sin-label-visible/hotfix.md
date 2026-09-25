# Hotfix: Botón "Papelera" de listados de alumnos sin label visible

> id: hotfix-004-i-papelera-alumnos-sin-label-visible
> refs: fix-037-i-qa-visual-piloto, ASG-i-018
> status: done
> created: 2026-09-22
> closed: 2026-09-24

## Problema

El botón que abre la vista de papelera (alumnos archivados) en `admin-alumnos.component.ts`
(grupo "Acciones principales", junto a "Nueva Matrícula") solo tiene ícono, sin texto visible
ni `data-llm-action`/`aria-label` explícito distinguible del resto de los botones del grupo.
En la auditoría de accesibilidad automática (Playwright), el botón salió indistinguible de
"Nueva Matrícula" hasta clickearlo — un usuario real (o un agente) puede no descubrir cómo
deshacer un archivado si no conoce de antemano que ese ícono es "Papelera".

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto), recorrido "Archivar y
restaurar alumno".

## Cambio

- Agregar tooltip visible (`pTooltip` o equivalente al patrón ya usado en el resto de la app)
  y `data-llm-action="toggle-papelera-alumnos"` al botón de papelera en
  `admin-alumnos.component.ts` (y su equivalente en `admin-alumnos-profesional.component.ts`
  si comparte el mismo patrón).
- No se cambia el comportamiento, solo la discoverability.

## Test de Regresión

- Verificación manual: `/verify` confirmando que el tooltip aparece al hacer hover y que el
  atributo `data-llm-action` está presente en el DOM.

## Evidencia de Verificación

- **2026-09-24, verificación antes de implementar (ASG-i-018):** al revisar
  `alumnos-list-content.component.ts` y `alumnos-profesional-list-content.component.ts`,
  ambos ya definen `{ id: 'papelera', label: 'Papelera', icon: 'trash-2', ... }` en
  `heroActions()`. El componente compartido `section-hero.component.ts` (que renderiza estas
  acciones) ya muestra `{{ action.label }}` como texto visible junto al ícono, y ya asigna
  `[attr.data-llm-action]="action.id"` automáticamente — confirmado en vivo con Playwright en
  `/app/admin/alumnos`: el botón "Papelera" se ve con texto visible y
  `data-llm-action="papelera"` en el DOM, ya distinguible de "Nueva Matrícula" sin necesidad de
  hacer clic.
- No se pudo determinar con certeza cuándo se resolvió (la búsqueda en `git log` del archivo
  `section-hero.component.ts` muestra que este patrón de label+data-llm-action visible es
  anterior a la fecha del hallazgo original, `2026-09-22` — probablemente el QA de
  `fix-037-i-qa-visual-piloto` se hizo contra una versión distinta del componente, un viewport
  donde el label se ocultaba, o fue un falso positivo).
- **Conclusión:** el síntoma no reproduce con el código actual. Se cierra sin cambios de
  código — no hay Root Cause vigente que corregir.
