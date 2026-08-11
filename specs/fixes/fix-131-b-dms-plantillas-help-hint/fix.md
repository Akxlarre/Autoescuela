# Fix: DMS — quitar card "Cómo usar las plantillas", reemplazar por componente "?" de ayuda
> id: fix-131-b-dms-plantillas-help-hint
> refs: fix-129-b-app-like-familia-documentos
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Root Cause

La card `<app-alert-card title="Cómo usar las plantillas" severity="warning">` en la tab
"Plantillas" de `DmsListContentComponent` ocupa espacio permanente en el panel scrollable solo
para un texto de ayuda que el usuario rara vez necesita. El owner pidió sacarla y reemplazarla
por un componente reutilizable tipo "?" (ícono de ayuda con contenido on-demand, no siempre
visible) — no existía ningún componente así en `indices/COMPONENTS.md`, hay que crearlo.

## ACs Afectados

Ninguno formalizado — ajuste de diseño post-review sobre fix-129-b/fix-130-b (mismo hilo).

## Cambio

- **Nuevo archivo:** `src/app/shared/components/help-hint/help-hint.component.ts`
  - `HelpHintComponent` (`app-help-hint`) — Dumb, sin lógica: botón circular con ícono
    `circle-help` que muestra el texto de ayuda vía `pTooltip` (mismo mecanismo de tooltip que
    ya usa `dms-list-content` para nombres de archivo truncados — `TooltipModule` de PrimeNG,
    sin dependencias nuevas).
  - Input: `text = input.required<string>()` (soporta HTML simple vía `[escape]="false"`, para
    poder tener `<strong>` como el texto original).
- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  - Elimina `<app-alert-card title="Cómo usar las plantillas" ...>` de la tab "Plantillas".
  - Agrega `<app-help-hint>` junto al título "Plantillas" del header de esa tab, con el mismo
    texto que tenía la card.
  - Quita el import de `AlertCardComponent` (sin más usos en el archivo tras sacar la card de
    "Permisos DMS" en fix-130-b y esta).

## Test de Regresión

- `HelpHintComponent` es Dumb sin lógica (solo un input, sin `computed()`) → sin `.spec.ts`
  obligatorio (regla de `testing-tdd.md`: "shared/ (Dumb) SIN lógica → OPCIONAL").
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, 0 errores.
- `npm run indices:sync`: `COMPONENTS.md` actualizado automáticamente (87 componentes, antes
  86) — `app-help-hint` queda registrado sin edición manual.
- `/verify` manual en navegador (`secretaria@test.com`, tab "Plantillas"):
  - Card "Cómo usar las plantillas" confirmada ausente (extracción de texto de la página sin
    esa card).
  - Ícono "?" (`app-help-hint`) presente junto al título "Plantillas", `aria-label="Ayuda"`.
  - Tooltip disparado (`mouseenter`/`mouseover`) muestra el texto completo con `<strong>`
    renderizado (no escapado) — `[escape]="false"` funciona como se esperaba.
  - `read_console_messages`: mismos `InvalidStateError` preexistentes, sin errores nuevos.
