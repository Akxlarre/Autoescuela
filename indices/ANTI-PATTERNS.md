# Anti-Patterns (NO HACER)

> Este índice enumera atajos comunes que degradan el sistema.  
> **Regla:** si detectas uno, detente y refactoriza hacia el patrón canónico.

## AP-001 — `[ngClass]` (evitar)
- **NO** uses `[ngClass]`.
- **Sí** usa binding directo: `[class.active]="isActive()"`, `[class.foo]="cond()"`.

## AP-002 — `@Input()` / `@Output()` (evitar)
- **NO** uses `@Input()` / `@Output()`.
- **Sí** usa Signal Inputs/Outputs: `input()`, `output()`.

## AP-003 — `inject(SupabaseService)` en componentes (evitar)
- **NO** inyectes `SupabaseService` ni importes `@supabase/supabase-js` en `features/` o `shared/`.
- **Sí** usa un `*FacadeService` para datos/estado y expón Signals al template.

## AP-004 — Colores Tailwind hardcodeados (evitar)
- **NO** uses `text-red-500`, `bg-blue-200`, etc.
- **Sí** usa tokens semánticos (`text-primary`, `text-muted`, `bg-surface`, `bg-base`, `var(--ds-brand)`).

## AP-005 — `@angular/animations` (evitar)
- **NO** uses `@angular/animations`.
- **Sí** usa GSAP vía `GsapAnimationsService` (y View Transitions para navegación).

## AP-006 — Interfaces duplicadas / interfaces locales (evitar)
- **NO** crees interfaces dentro de `*.component.ts` ni copies una interfaz de `core/models/`.
- **Sí** importa desde `@core/models/dto/` o `@core/models/ui/`. Extiende con `extends` o `Pick`/`Omit` si necesitas variantes.

## AP-007 — Polling con `setInterval` (evitar)
- **NO** uses `setInterval` para refrescar datos.
- **Sí** usa Supabase Realtime (`subscribeRealtime()`) o el patrón SWR (`refreshSilently()`).

## AP-008 — `effect()` en Facades (evitar)
- **NO** pongas `effect()` dentro de un Facade para auto-recargar datos.
- **Sí** pon el `effect()` en el Smart Component que controla el ciclo de vida (ver `facades.md` §7).

## AP-009 — Lógica algorítmica pesada en Facades / Componentes (evitar)
- **NO** acumules transformaciones de datos complejas, cálculos matemáticos o utilidades dentro del Facade o del componente.
- **Sí** extrae esa lógica a funciones puras en `core/utils/` (Functional Core). Son testeables sin Angular.

## AP-010 — `MessageService` directo de PrimeNG (evitar)
- **NO** inyectes `MessageService` directamente en componentes ni en Facades.
- **Sí** usa `ToastService` (`core/services/ui/toast.service.ts`) que wrappea PrimeNG con duraciones pre-configuradas.

## AP-011 — Clases de token NO canónicas que no generan CSS (evitar)
- **NO** uses clases con forma de token-válido-pero-inexistente. **Tailwind v4 las ignora en silencio** (no generan CSS) → el elemento renderiza con el color heredado, no el esperado. El Architect Guard NO las detecta (no son colores hardcodeados).
- Clases muertas frecuentes y su equivalente **canónico** (definido en `@theme` de `src/tailwind.css`):

| ❌ No existe | ✅ Canónica |
|---|---|
| `bg-bg-{base,surface,elevated,subtle}` | `bg-{base,surface,elevated,subtle}` |
| `bg-surface-elevated` | `bg-elevated` |
| `bg-surface-hover`, `bg-surface-base` | `bg-subtle` |
| `text-state-{success,warning,error,info}` | `text-{success,warning,error,info}` |
| `bg-state-{x}` / `bg-state-{x}-bg` | `bg-{x}` / `bg-{x}-subtle` |
| `border-state-{x}` / `border-state-{x}-border` | `border-{x}` / `border-{x}-border` |
| `border-divider`, `bg-divider`, `divide-divider` | `border-border-subtle`, `bg-border-subtle`, `divide-border-subtle` |

- **OJO (sí son canónicas, no confundir):** `text-text-primary`, `text-text-muted`, `bg-text-muted`, `bg-brand-dark`, `bg-brand-muted`. Y `rows-divider` es una clase CSS **custom** legítima (en `pagos`), NO Tailwind — no tocar.
- Detección (regex para `architect.js` / CI): `\b(bg-bg-(base|surface|elevated|subtle|overlay)|(text|bg|border)-state-(success|warning|error|info)|bg-surface-(elevated|hover|base)|(border|bg|divide)-divider)\b`
- Remediado masivamente en `fix-015` (jun 2026). Ver `indices/UI-CONSISTENCY-AUDIT.md` (H1).

## AP-012 — Pill/badge ad-hoc (evitar)
- **NO** compongas badges a mano con `rounded-full` + micro-texto (`text-xs`/`text-[10px]`) + `px-*`. Hay ~122 instancias legacy (baseline ARCH-15) y cada una es un punto de divergencia visual.
- **Sí** usa `<app-badge [variant]="'success' | 'warning' | 'error' | 'info' | 'neutral'">` (`shared/components/badge/`) o las utilidades `badge-*` de `tailwind.css`.
- Guardrail: **ARCH-15** (ratchet — solo alerta regresiones vs `scripts/lib/class-discipline.baseline.json`). Consolidación total = fase 4 del roadmap de botones.

## AP-013 — Utilities de tamaño sobre `btn-*` (evitar)
- **NO** montes `px-*`/`py-*`/`p-*`, `text-{size}`/`text-[NNpx]` ni `rounded-*` encima de una utilidad `btn-*` — mutila el contrato del botón (su padding/tipografía/radio los definen los tokens `--btn-*`).
- **Sí** usa la utilidad tal cual; layout (`w-full`, `flex`, `gap-*`, `h-*`, `shrink-0`, `justify-*`) sí está permitido. Si necesitas un botón más compacto, se crea la variante en el DS (modificador `btn-sm`, fase 4-5 roadmap), no en el consumidor.
- Guardrail: **ARCH-16** (ratchet, baseline: 120 instancias).

## AP-014 — Tamaño de fuente arbitrario `text-[NNpx]` (evitar)
- **NO** uses valores JIT como `text-[10px]`, `text-[13px]`. Cada uno es un tamaño fantasma fuera de la escala.
- **Sí** usa la escala completa: **`text-2xs` (10px, piso absoluto — fix-032)**, `text-xs` (12px), `text-sm` (14px)… El token `text-2xs` solo fija font-size (line-height se hereda), igual que hacía el valor arbitrario.
- Migrado en fix-032: 252 instancias (`text-[10px]`/`text-[11px]` → `text-2xs`; `text-[12/14/16/18px]` → token exacto). Backlog residual (baseline ARCH-17: 66): tamaños 8/9/13/15/17/22px que requieren decisión de diseño — 8-9px es ilegible, subirlos a `text-2xs`; 13/15/17px deben encajarse en la escala.
- Guardrail: **ARCH-17** (ratchet). Re-baselinear tras migraciones: `npm run lint:arch -- --update-ds-baseline`.

## AP-015 — Alias bare en `@theme` para resucitar una clase muerta (evitar)
- **NO** agregues un alias `--color-X: var(--...)` bare al `@theme` de `tailwind.css` para
  hacer "funcionar" una clase corta (`text-secondary`, `text-muted`, `text-disabled`,
  `text-primary`) que no renderiza. Historia real: `a4675ee` escribió 3 componentes con
  `text-secondary`/`text-muted`, notó que no pintaban, y en vez de migrar esas 31 líneas al
  canon `text-text-*` (fix-030), agregó los alias — reabriendo la ambigüedad que fix-030
  había cerrado. Revertido en `fix-033`.
- **Sí** si una clase `text-X` no renderiza, es una señal de que el código usa la forma NO
  canónica — migra los **usos** a `text-text-X`, nunca cambies la **definición** del bridge.
- **Por qué ARCH-11 no lo detectó a tiempo:** ARCH-11 solo marca clases que NO generan CSS.
  En cuanto el alias existe en `@theme`, la clase deja de estar "muerta" y ARCH-11 queda
  ciego — el mismo mecanismo que causó la regresión es invisible para ese guardrail.
- Guardrail: **ARCH-18** — audita la *definición* del `@theme` (no el uso), y falla si
  vuelve a aparecer `--color-secondary`, `--color-muted`, `--color-disabled` o
  `--color-primary` bare (los sufijos como `--color-border-muted`/`--color-brand-muted` NO
  están prohibidos, son formas canónicas legítimas).
