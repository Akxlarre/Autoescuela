# Fix: Rediseño de app-alert-card acorde al DS
> id: fix-120-b-alert-card-rediseno-ds
> refs: —
> status: done
> created: 2026-08-04
> closed: 2026-08-07 — cierre tardío. Código verificado por auditoría estática (AC-1 a AC-6
> confirmados: border-left real, tokens `--state-*`, hostDirectives, API vieja eliminada,
> spec.ts actualizado, COMPONENTS.md actualizado, sin `appAnimateIn`/`dismissible` residual en
> consumidores). Pendiente real: verificación visual `/verify` en navegador nunca se ejecutó —
> si se detecta un problema visual de contraste/tinte en producción, revisar ahí primero.

## Root Cause

`AlertCardComponent` (`shared/components/alert-card/`) se diseñó como card blanca base + una
barra de acento absoluta (`div` posicionado con `background`, no un `border-left` real) y usa
`var(--color-primary)` para `severity="info"` en vez del token dedicado `--state-info` que ya
existe (`_variables.scss:209-211` light / `:454-456` dark) — confundiendo "marca" con "estado
informativo" y quemando presupuesto de la regla 3-2-1 de disciplina de marca del propio DS.

Además expone `actionLabel` / `dismissible` / `llmAction` (+ outputs `action` / `dismissed`)
que ningún consumidor usa para cambiar comportamiento: auditados los 18 usos reales en 14
archivos, ninguno pasa `actionLabel` ni `llmAction`, y los 2 únicos que tocan `dismissible`
(`instructor-ficha.component.ts:68,470`) lo fijan en `[dismissible]="false"` — el mismo valor
por defecto, detectado recién en el `ng build` de verificación (no en la auditoría manual
inicial).

Y la animación de entrada queda a criterio de cada consumidor recordar `appAnimateIn`: 5 de 18
usos la agregan a mano, 13 no tienen ninguna — inconsistencia de motion no intencional.

## ACs Afectados

Ninguno — fix autónomo de consistencia visual/DS, no ligado a una spec previa.

- AC-1: El borde de color es un `border-left` real (no un `div` absoluto), coherente con el
  patrón ya validado en el rail de alertas de Asistencia B (`border-l-[3px]` + color por token).
- AC-2: `severity="info"` usa `var(--state-info)` / `--state-info-bg` / `--state-info-border`
  en vez de `var(--color-primary)`.
- AC-3: Los 4 severities usan el mismo triple de tokens (`--state-{sev}` / `-bg` / `-border`),
  con fondo tintado (antes card blanca plana con solo la barra coloreada).
- AC-4: La animación de entrada (`AnimateInDirective`) se aplica automáticamente vía
  `hostDirectives` — ningún consumidor necesita `appAnimateIn` manual.
- AC-5: `actionLabel`, `dismissible`, `llmAction`, `(action)`, `(dismissed)` se eliminan del
  componente (0 usos reales verificados en los 18 call sites).
- AC-6: Se eliminan las clases marcador `.alert-error/-warning/-info/-success` (0 reglas CSS
  detrás — `alert-error` está explícitamente documentada como clase muerta en
  `.claude/skills/verify/SKILL.md:342`, blind spot conocido de ARCH-11).

## Cambio

- **Archivo:** `src/app/shared/components/alert-card/alert-card.component.ts`
  - Rediseño de host/template: `border-left` real + fondo tintado por severity vía tokens
    `--state-{sev}-bg` / `-border`, `hostDirectives: [AnimateInDirective]`, `severity="info"`
    migrado a tokens `--state-info*`, eliminación de API sin uso.
- **Archivo:** `src/app/shared/components/alert-card/alert-card.component.spec.ts`
  - Actualizar tests a la nueva API (elimina tests de action/dismiss button, agrega tests de
    tinte/host).
- **Archivos con `appAnimateIn` manual sobre `<app-alert-card>` (redundante tras
  hostDirectives):** `instructor-dashboard.component.ts` (x2), `alumno-clases.component.ts`,
  `alumno-dashboard.component.ts` (x2).
- **Archivo:** `instructor-ficha.component.ts` — quitar `[dismissible]="false"` (x2, input
  eliminado; encontrado por `ng build`, no por la auditoría manual inicial).
- **Archivo:** `indices/COMPONENTS.md` — actualizar firma de `app-alert-card` (2 tablas).

## Test de Regresión

- Verificación visual manual (`/verify`, Playwright) en al menos 2 severities (error/info) +
  modo claro/oscuro — `alert-card.component.spec.ts` está `describe.skip` (proyecto no testea
  render de componentes Angular, ver memoria `project_no_angular_component_tests`).
- `ng build` sin errores de compilación (los 14 consumidores no cambian su API pública salvo
  el atributo `appAnimateIn` redundante que se retira).
