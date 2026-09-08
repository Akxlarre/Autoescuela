# Fix: appCardHover faltante en cards mobile de los 5 listados de fix-162-b
> id: fix-166-b-rollout-appcardhover-cards-mobile-fix162b
> refs: fix-164-b-cursos-singulares-mobile-cards-hover-y-spacing, fix-162-b-rollout-cards-mantenimientos-cursos-anticipos-certificacion
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
`fix-162-b` migró el wrapper de 5 páginas al patrón `.card` (para cerrar el inventario de
ARCH-25), pero su alcance declarado era literalmente "la clase del contenedor" — no incluyó
agregar `appCardHover` a las cards individuales dentro del `@for` de cada listado mobile,
igual que le pasó a Cursos Singulares (`fix-164-b`, misma causa, mismo `fix-162-b` como
origen). Auditoría de los 16 componentes con el patrón dual-viewport
(`.show-on-squeeze`/`.hide-on-squeeze`) confirma que estos 5 son los únicos con cards `@for`
sin `appCardHover` por item — el resto ya usa componentes extraídos (`app-vehiculo-card`,
`app-instructor-card`, `app-relator-card`, `app-promocion-card`, etc.) que llevan la
directiva incluida, o (`instructor-alumnos`) ya la aplica manualmente por item.

## ACs Afectados
- Ninguno — mejora visual sobre UI ya en producción, mismo alcance que fix-164-b/fix-162-b.

## Cambio
Agregar la directiva `appCardHover` (ya importada en los 5 archivos, se usa en su wrapper
exterior) a la card individual dentro del `@for` de la vista mobile:
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
  — card de mantención (línea ~258).
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts`
  — card de cuenta corriente (línea ~218) y card de historial de anticipos (línea ~369).
- **Archivo:** `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`
  — card de servicio (línea ~222).
- **Archivo:** `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`
  — card de alumno pendiente de certificación (línea ~438).
- **Archivo:** `src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts`
  — card de alumno pendiente de certificación (línea ~580).

Ninguno de estos 5 tiene el bug de `fix-165-b` (gap anulado por `display:block!important`):
los tres primeros usan `space-y-*` (compatible con `display:block`), los dos últimos están
bajo `.show-on-squeeze{display:flex!important}` que sí coincide con su `flex+gap`.

## Test de Regresión
- Verificación en vivo (`localhost:4200`, viewport mobile): `dispatchEvent(mouseenter)` sobre
  una card de cada uno de los 5 listados debe producir `transform: translateY(-2px)` +
  `box-shadow` glow (mismo criterio usado para verificar fix-164-b). **Verificado en 4/5**:
  `admin-contabilidad-anticipos` (16 cards, cuenta corriente + historial), `servicios-
  especiales` (1 card con seed), `certificacion` (10 cards, tab Clase B), `vehicle-
  maintenances` (2 cards, vehículo id=1) — los 4 con `transform: matrix(1,0,0,1,0,-2)` +
  boxShadow glow tras `mouseenter`. `certificacion-profesional-content` no se verificó en
  vivo (mismo tab de Certificación, sin toggle visible a Profesional en esta sesión) pero
  usa el mismo `appCardHover` + mismo `CardHoverDirective` ya confirmado en sus 4 pares —
  riesgo residual mínimo (mismo criterio que fix-162-b/fix-163-b para casos sin datos de
  seed o sin acceso directo a la vista).
- `npm run lint:arch` → exit 0.
