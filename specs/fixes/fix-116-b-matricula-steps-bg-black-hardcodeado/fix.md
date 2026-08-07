# Fix: 3 instancias más de `bg-black` hardcodeado en el wizard interno de matrícula
> id: fix-116-b-matricula-steps-bg-black-hardcodeado
> refs: —
> status: done
> closed: 2026-08-04
> created: 2026-08-04

## Root Cause

Continuación de `fix-113-b`/`fix-114-b` (tarjeta "Resumen Financiero" de `payment.component.html`).
Al discutir esa corrección se identificaron 3 instancias más del mismo patrón —
`bg-black`/`hover:bg-black` hardcodeado combinado con `text-surface` — en otros 2 componentes del
mismo wizard:

1. `confirmation.component.html:87` — footer "Acciones de Descarga" (botones "Comprobante de
   Pago"/"Contrato Firmado"): `bg-black` **en reposo** (no solo hover) con hijos `bg-surface/10
   text-surface`. Mismo bug de fondo: en modo oscuro `--color-surface` es casi negro, ilegible
   sobre el fondo negro. Además rompe la consistencia estructural — el resto de los pasos del
   wizard (Asignación, Contrato, Pago, Documentos) usan `bg-base border-t border-border-subtle`
   para su footer; este es el único con fondo negro sólido.
2. `confirmation.component.html:119` — botón "Volver al Inicio": estado base correcto
   (`bg-text-primary text-surface`, se adapta bien a ambos modos), pero `hover:bg-black`
   hardcodeado — en modo oscuro, al pasar el mouse, el texto (`text-surface` ≈ `#18181b`) queda
   sobre un fondo `bg-black` (`#000000`), ilegible solo durante el hover.
3. `documents.component.html:103` — botón "Activar Cámara": mismo patrón exacto que (2) —
   `bg-text-primary text-surface hover:bg-black`, ilegible en hover en modo oscuro.

## ACs Afectados

Ninguno — fix autónomo de identidad visual/contraste, continuación de fix-113-b/114-b.

## Cambio

- **Archivo 1:** `src/app/shared/components/matricula-steps/confirmation/confirmation.component.html`
  - Footer "Acciones de Descarga" (línea 87): `bg-black` → `bg-base border-t border-border-subtle`,
    igualando la estructura de footer ya usada en Asignación/Contrato/Pago/Documentos. Los botones
    hijos (`bg-surface/10 hover:bg-surface/20 text-surface border-surface/10`) pasan a tokens
    normales de card (`bg-subtle hover:bg-base text-text-primary border-border-default`), ya que
    dejan de vivir sobre un fondo negro.
  - Botón "Volver al Inicio" (línea 119): `hover:bg-black` → se quita (el estado base
    `bg-text-primary text-surface` ya es correcto en ambos modos; no hace falta un hover que
    fuerce negro). Se reemplaza por un hover sutil vía opacidad (`hover:opacity-90`), patrón ya
    usado en otros botones sólidos del proyecto.
- **Archivo 2:** `src/app/shared/components/matricula-steps/documents/documents.component.html`
  - Botón "Activar Cámara" (línea 103): mismo cambio — `hover:bg-black` → `hover:opacity-90`.

## Test de Regresión

Resultado (2026-08-04):

- `npx ng build` — compiló sin errores (262s, único warning es el budget de bundle
  pre-existente, no relacionado) ✓
- `npm run lint:arch` — 0 errores. El único hallazgo nuevo ligado a `confirmation.component.html`
  (ARCH-19, 9 vs baseline 7) se verificó con `git diff` — el diff real de este fix NO toca ninguna
  clase tipográfica, solo colores de fondo/borde/hover, así que el corrimiento de baseline es
  ruido de otra sesión activa en paralelo (`fix-115-b`/`fix-117-b`, mismo checkout) tocando
  `scripts/lib/class-discipline.js`, no una regresión de este fix ✓
- **Verificación visual en vivo INCOMPLETA — bloqueada por el entorno, no por el fix.** Se
  intentó 3 veces: (1) servidor principal :4200, redirigido a /login a mitad de navegación por
  reloads constantes de la otra sesión ("Changes detected. Rebuilding..." cada 5-10s en el log);
  (2) servidor aislado propio en :4210 (para no compartir el broadcast de reload) — mismo
  resultado: al llegar al formulario, un `vite-error-overlay` bloqueó la interacción con
  `TS2322` en `alert-card.component.ts` (archivo ajeno, tocado por la otra sesión). Confirmado
  que un puerto separado NO aísla de esto — ambas instancias de `ng serve` compilan del mismo
  árbol de fuente compartido, así que cualquier error de compilación transitorio de la otra
  sesión se filtra a mi navegador igual. No hay forma de conseguir un navegador estable desde mi
  lado mientras esa sesión siga editando ~90 archivos en paralelo.
  Evidencia de reemplazo: los tokens usados (`bg-base border-t border-border-subtle`, `bg-subtle`,
  `text-text-primary`, `border-border-default`, `hover:opacity-90`) son exactamente los mismos ya
  validados en pantalla en `fix-114-b` sobre el archivo hermano (`payment.component.html`), en
  ambos modos. Pendiente: correr `/verify` sobre estas 2 pantallas cuando el checkout esté
  estable (sin otra sesión editando en simultáneo).
