# Fix: `admin-pre-inscrito-drawer` renderiza 2 `.card-accent` a la vez en el tab "Test"
> id: fix-110-b-card-accent-doble-pre-inscrito-test
> refs: indices/DS-AUDIT-2026-08-03.md (H3)
> status: done
> closed: 2026-08-03
> created: 2026-08-03

## Root Cause

`admin-pre-inscrito-drawer.component.ts` (tab "test", líneas 259-355) tiene 2 tarjetas con
`card-accent` cuyas condiciones `@if` **no son mutuamente excluyentes**:

- `!p.psychAnswers || p.psychAnswers.length === 0` → "Test pendiente" (descargar/imprimir).
- `p.psychResult === null || showReEvaluate()` → "Evaluar test psicológico" (formulario).

En el estado inicial más común (pre-inscrito recién creado: sin respuestas online Y sin
resultado) ambas son `true` a la vez → 2 bordes de marca simultáneos en la misma sección,
violando la regla 3-2-1 (máx. 1 `.card-accent` por sección bento).

Las dos tarjetas SÍ deben poder coexistir funcionalmente (se puede descargar el test en papel
ahora y, cuando llegue el resultado, cargarlo con el mismo formulario visible — no son pasos
secuenciales excluyentes desde el punto de vista de negocio). El bug es puramente de jerarquía
visual, no de lógica de negocio: no corresponde ocultar ninguna tarjeta, solo dejar un único
acento de marca por sección.

## ACs Afectados

Ninguno — fix autónomo de disciplina visual (regla 3-2-1 de `.claude/rules/visual-system.md`),
sin AC de spec previa.

## Cambio

- **Archivo:** `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts`
- **Qué cambia:** la tarjeta "Test pendiente" (línea 260) pasa de `card card-accent space-y-3`
  a `card space-y-3` (pierde el acento). La tarjeta "Evaluar test psicológico" (línea 351)
  conserva `card-accent` — es la que tiene el formulario accionable (botones Apto/No apto),
  el CTA primario real del tab, mientras que "Test pendiente" solo tiene un botón secundario
  (`btn-secondary`) de descarga. Cero cambios de condición `@if`/visibilidad — ambas tarjetas
  siguen apareciendo exactamente en los mismos casos que hoy.

## Test de Regresión

Resultado (2026-08-03):

- `npx ng build` — compiló sin errores (103s, único warning es el budget de bundle
  pre-existente, no relacionado) ✓
- `npm run lint:arch` — 0 errores, 170 advertencias (idéntico al baseline pre-fix; la única
  advertencia sobre este archivo es ARCH-11 `border-success-muted`, pre-existente y no tocada
  por este cambio) ✓
- Verificación de código: `grep -n "card-accent"` sobre el archivo devuelve **1 sola línea**
  (línea 351, "Evaluar test psicológico") — confirmado que ya no quedan 2 acentos simultáneos
  en el tab "test", y que ningún otro tab del drawer tiene `card-accent` que pudiera combinarse.
- Sin test de componente dedicado: `vitest.config` excluye specs de componentes de Angular
  (memoria del proyecto), y este cambio no introduce ningún `computed()` ni decisión de negocio
  nueva — es puramente CSS de un template ya existente.
