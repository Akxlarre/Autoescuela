# Fix: guardrail que valide el rol (Dumb vs Organismo) en `shared/`

> id: fix-156-b-guardrail-rol-dumb-organismo
> refs: ASG-b-092 (`specs/assignments/ASG-b-092-organismos-carpeta-por-rol.md`)
> status: in_progress
> created: 2026-09-07

## Root Cause

[Heredado de ASG-b-092, a confirmar]:

`fix-146-b` corrigió `.claude/rules/architecture.md` para que distinga por **rol** en vez de por
carpeta:

- **Dumb presentacional** → prohibido inyectar Facades.
- **Organismo de dominio** → puede inyectar el Facade de *su* dominio (nunca uno transversal como
  `AuthFacade` / `BranchFacade`).

La regla ya es correcta, pero **nada la verifica automáticamente**: ambas categorías conviven
mezcladas en `src/app/shared/components/` y la distinción solo existe en prosa. Un dev (o un
agente) que abre esa carpeta no puede distinguir un `app-icon` de un `detalle-cuadratura-modal`
sin leer el código de cada uno, y ningún check falla si mañana alguien inyecta `AuthFacade` en un
Dumb real.

**Decisión de enfoque al reclamar (2026-09-07):** de las 3 opciones que planteaba la ASG
(guardrail / mover carpetas / ambas), se eligió **guardrail primero** — que es lo que la propia
ASG pedía evaluar antes que nada: es más barato, no toca un solo archivo de producción, y es lo
único que frena la *próxima* violación en vez de ordenar las actuales.

**Evidencia fresca (2026-09-07)** que refuerza la elección: la ASG hablaba de "los 6 organismos
identificados en `fix-146-b`". Hoy `grep -rl "inject(.*Facade" src/app/shared/` devuelve **8**:

```
shared/components/ajustes-drawer/
shared/components/alumnos-list-content/
shared/components/alumnos-por-vencer-drawer/
shared/components/detalle-cuadratura-modal/
shared/components/ex-alumnos-content/
shared/components/pago-instructor-modal/
shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts
shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts
```

Los 2 nuevos vienen de `fix-239/240-m` (rediseño de Servicios Especiales, esta misma semana). O
sea: la carpeta **se sigue poblando de organismos** mientras la regla vive solo en prosa. Mover
archivos ordena el pasado; el guardrail protege el futuro.

## Supuesto a validar antes de implementar

⚠️ **El guardrail necesita un criterio automatizable para decidir el rol de un componente**, y
`fix-146-b` no dejó uno mecánico: su criterio es *"se abre dinámicamente vía
`LayoutDrawerFacadeService.open(Componente, …)`"*, que es una propiedad del **call site**, no del
archivo analizado.

Primer paso de este fix es resolver eso. Opciones a evaluar, en orden de preferencia:

1. **Derivar el rol del call site** — buscar si el componente aparece como argumento de
   `LayoutDrawerFacadeService.open()` en cualquier parte de `src/`. Sin marcas nuevas, pero exige
   un pase cross-file en `architect.js` (verificar si ya hay precedente de eso entre ARCH-01..23).
2. **Marca explícita en el archivo** — un tag en el JSDoc del componente (ej. `@organism`), que el
   lint lee. Barato y local, pero requiere tocar los 8 archivos una vez.
3. **Convención de nombre** — `*-content`, `*-drawer`, `*-modal` = organismo. Cero cambios, pero es
   heurística frágil (`alumnos-list-content` cumple, pero nada obliga a que el próximo lo haga).

**Si ninguna resulta razonable, este fix se cierra sin cambio de código y la ASG-b-092 vuelve al
tablero con la conclusión escrita** — que es un resultado válido, no un fracaso: la ASG pedía
exactamente "evaluar esta opción antes que las otras dos".

Lo que el guardrail debe detectar, una vez resuelto el criterio:

- Dumb presentacional que inyecta **cualquier** Facade → error.
- Organismo que inyecta un Facade **transversal** (`AuthFacade`, `BranchFacade`) → error, con el
  mensaje que ya dicta `architecture.md`: mové ese `computed()` al Facade de dominio.
- Organismo que inyecta el Facade de su propio dominio → OK.

Sería **ARCH-24** (hoy existen ARCH-01 … ARCH-23), con ratchet sobre el estado actual como hacen
las reglas previas, para no romper el build con deuda preexistente.

## Out of scope

- **Mover archivos a `shared/organisms/`** (opción 1 de la ASG) y **mudar cada organismo a su
  dominio** (opción 2). Si el guardrail funciona, el residuo estructural se re-evalúa aparte; no
  se resuelve acá.
- Re-litigar si los 6 organismos de `fix-146-b` son legítimos. Ya se verificó que lo son — ver la
  Root Cause de `specs/fixes/fix-146-b-facade-en-dumb-components/fix.md`.

## ACs Afectados

Ninguno — fix autónomo de tooling. No hay cambio de comportamiento visible para el usuario final.

## Cambio

- **Archivo:** `scripts/architect.js`
- **Qué cambia:** (pendiente — depende del criterio que gane en "Supuesto a validar")

## Test de Regresión

- (pendiente — a definir junto con el criterio)

## Referencias

- `specs/assignments/ASG-b-092-organismos-carpeta-por-rol.md`
- `specs/assignments/ASG-b-089-facade-en-dumb-components.md` §Resolución
- `specs/fixes/fix-146-b-facade-en-dumb-components/fix.md` §Root Cause
- `.claude/rules/architecture.md` §Smart vs Dumb Components
- `.claude/rules/facades.md` §7
