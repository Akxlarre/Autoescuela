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
