# Hotfix: Botón "Papelera" de listados de alumnos sin label visible

> id: hotfix-004-i-papelera-alumnos-sin-label-visible
> refs: fix-037-i-qa-visual-piloto
> created: 2026-09-22

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
