# Fix: guardrail que valide el rol (Dumb vs Organismo) en `shared/`

> id: fix-156-b-guardrail-rol-dumb-organismo
> refs: ASG-b-092 (`specs/assignments/ASG-b-092-organismos-carpeta-por-rol.md`)
> status: done
> closed: 2026-09-07
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

## Hallazgo que cambió la forma del fix

**El guardrail ya existía — enforceando la regla vieja.** `.claude/hooks/pre-write-guard.js:170`
bloquea, en tiempo de escritura, *cualquier* `inject(...Facade)` en `shared/`. Es la versión
previa a `fix-146-b`: carpeta = rol. O sea, el problema real nunca fue "no hay guardrail", sino
**la prosa se corrigió y el guard no**, quedando en contradicción silenciosa. Rastro en el
código: `ex-alumnos-content.component.ts:34` documenta la restricción vieja como si siguiera
siendo la ley.

Y ese guard además tiene un **falso positivo**: su patrón `/inject\s*\(\s*\w*Facade/` matchea
`LayoutDrawerFacadeService`, que es plomería de UI de `core/services/ui/`, no un Facade de
dominio. Lo inyectan **5 de los 8** componentes involucrados — es decir, el guard bloquea a
cualquier componente de `shared/` que abra un drawer.

Por eso el fix corrige **dos** consumidores (linter + guard de escritura) con **una sola**
implementación compartida: que la regla viva escrita dos veces es lo que produjo la divergencia.

### Criterio de rol elegido: allowlist declarativo

De las 3 opciones evaluadas:

1. **Derivar del call site** (`LayoutDrawerFacadeService.open()`) — descartada: el guard de
   escritura ve **un solo archivo** y no puede hacer un pase cross-file. Además no cubre a los
   `*-content`, que se usan por selector en templates.
2. **Tag inline `@organism`** — descartada: se lo auto-otorga cualquiera, sin revisión.
3. **Allowlist declarativo** ✅ — `scripts/lib/shared-organisms.allowlist.json`. Agregar un
   organismo aparece en el diff de un archivo de gobierno y exige justificación escrita. Mismo
   precedente que `bento-classes.allowlist.json` (ARCH-21).

### Sin ratchet: arranca en CERO

Barridos los **91** componentes de `shared/`: **0 violaciones** con los 6 organismos declarados.
No hace falta baseline (a diferencia de ARCH-15/16/17). Verificado también en negativo: con el
allowlist vacío detecta las 7 inyecciones reales, así que no pasa por vacuidad.

## Restricción: los dos consumidores son archivos protegidos

`scripts/architect.js` y `.claude/hooks/` los protege el File Protector — un agente no puede
editarlos, y eso es **el diseño funcionando**, no un bloqueo a destrabar: un agente no debe poder
cambiar los guardrails que lo evalúan. Se sigue el mismo canal que `ASG-b-097` / `hotfix-053-b`:
el agente entrega **patchers idempotentes y anclados**, y una persona corre dos comandos.

La lógica NO vive en el parche: vive en `scripts/lib/shared-roles.js` (no protegido, testeable,
editable por un agente). Lo que se inyecta en los archivos protegidos son ~20 y ~12 líneas de
cableado, para que el diff sobre ellos sea trivial de revisar.

## Cómo aplicarlos (requiere una persona)

```bash
node scripts/harness/test-arch24-patches.js          # 1. validar (28 casos, sobre copias)
node scripts/harness/patch-architect-arch24.js       # 2. aplicar al linter
node scripts/harness/patch-pre-write-guard-role.js   # 3. aplicar al guard de escritura
npm run lint:arch                                    # 4. confirmar: sigue en 0 errores
```

Ambos patchers son idempotentes y abortan sin escribir nada si algún ancla no matchea exacto.
Reversión: los dos archivos están versionados → `git checkout -- scripts/architect.js .claude/`.

## Out of scope

- **Mover archivos a `shared/organisms/`** (opción 1 de la ASG) y **mudar cada organismo a su
  dominio** (opción 2). Si el guardrail funciona, el residuo estructural se re-evalúa aparte; no
  se resuelve acá.
- Re-litigar si los 6 organismos de `fix-146-b` son legítimos. Ya se verificó que lo son — ver la
  Root Cause de `specs/fixes/fix-146-b-facade-en-dumb-components/fix.md`.

## ACs Afectados

Ninguno — fix autónomo de tooling. No hay cambio de comportamiento visible para el usuario final.

## Cambio

Archivos nuevos (todos fuera del perímetro protegido):

- **`scripts/lib/shared-roles.js`** — implementación única de ARCH-24: `findSharedRoleViolations()`
  + carga del allowlist. Ignora `core/services/ui/*` (mata el falso positivo de
  `LayoutDrawerFacadeService`). Fail-closed: sin allowlist, todo `shared/` se trata como Dumb.
- **`scripts/lib/shared-organisms.allowlist.json`** — los 6 organismos declarados, con `why` por
  entrada + el waiver de transversales de `ajustes-drawer`.
- **`scripts/lib/shared-roles.test.mjs`** — 20 casos, las dos direcciones.
- **`scripts/harness/patch-architect-arch24.js`** — patcher del linter (4 anclas).
- **`scripts/harness/patch-pre-write-guard-role.js`** — patcher del guard de escritura (1 ancla).
- **`scripts/harness/test-arch24-patches.js`** — 28 casos end-to-end sobre copias parcheadas.

Archivos modificados:

- **`indices/ANTI-PATTERNS.md`** — AP-016 (el anti-patrón + el criterio general que dejó).
- **`.claude/rules/architecture.md`** — la regla ahora apunta a su guardrail.
- **`src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts`** — el
  comentario que documentaba la regla vieja ("el Architect Guard bloquea cualquier
  `inject(...Facade)` en `shared/`") ahora dice la vigente. Es la misma causa raíz propagada a
  código fuente, no scope nuevo.

Pendiente de aplicar por una persona (protegidos): `scripts/architect.js`,
`.claude/hooks/pre-write-guard.js`.

## Test de Regresión

- `node scripts/lib/shared-roles.test.mjs` → **20/20 PASS** ✓
- `node scripts/harness/test-arch24-patches.js` → **28/28 PASS** ✓, incluyendo los 4 casos que
  prueban que el parche cambia algo real: sin parchear, el hook bloquea `LayoutDrawerFacadeService`
  y bloquea a un organismo legítimo; el linter sin parchear no ve la violación que el parcheado sí.
- `npm run lint:arch` → 0 errores, 174 advertencias (idéntico a antes del cambio) ✓
- `npm run test:ci` → 2292 pass · 5 skipped · **1 fail preexistente y ajeno** a este track:
  `agenda.facade.spec.ts > timeRows — baseline de jornada completa`. Es el mismo flaky de DST que
  `fix-155-b`: el test asume UTC-4 ("horario estándar") y Chile entró en horario de verano el
  domingo 2026-09-06 (offset 240 → 180), así que `17:30Z` ahora es `14:30` y no `13:30`. Necesita
  su propio track — una causa raíz distinta, en un archivo que este fix no toca.

> El corolario de `fix-155-b` (aritmética de calendario, no de milisegundos) se escribió para el
> caso que se encontró entonces, no como barrido: quedó al menos un test más asumiendo un offset
> fijo. **Criterio: cuando un fix corrige una suposición de zona horaria en un test, vale barrer
> el resto de la suite por la misma suposición antes de cerrar** — el costo es un grep y evita
> que el próximo cambio de hora vuelva a romper el CI.

## Referencias

- `specs/assignments/ASG-b-092-organismos-carpeta-por-rol.md`
- `specs/assignments/ASG-b-089-facade-en-dumb-components.md` §Resolución
- `specs/fixes/fix-146-b-facade-en-dumb-components/fix.md` §Root Cause
- `.claude/rules/architecture.md` §Smart vs Dumb Components
- `.claude/rules/facades.md` §7
