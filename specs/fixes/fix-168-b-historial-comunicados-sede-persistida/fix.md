# Fix: El historial de comunicados de una secretaria se ve vacío si en ese navegador quedó otra sede elegida

> id: fix-168-b-historial-comunicados-sede-persistida
> refs: 0041-b-comunicado-global-alumnos (AC7)
> status: done
> closed: 2026-09-10
> created: 2026-09-10

## Root Cause

`AnnouncementsFacade.loadHistory()` filtra por `branchFacade.selectedBranchId()` **crudo**, sin
pasar por `resolveBranchScope()` (`core/utils/branch-scope.utils.ts`), que existe desde fix-027
justamente para resolver el scope de sede según el rol:

```ts
// announcements.facade.ts:103
const branchId = this.branchFacade.selectedBranchId();
...
if (branchId !== null) query = query.eq('branch_id', branchId);
```

`selectedBranchId` se persiste en `localStorage` bajo `autoescuela:selectedBranchId`, una clave
**sin namespacing por usuario que nadie limpia al cerrar sesión**. Para un admin eso es una
feature (recordar la sede elegida). Para una secretaria sin grant multi-sede es un filtro que
ella no eligió, no ve y no puede corregir: no tiene selector de sede en el topbar.

La RLS la protege de ver de más. Este filtro del cliente la deja **sin ver nada**: la
intersección entre `branch_id = <sede ajena>` y lo que la policy le permite (su sede, o `NULL`)
es vacía. La pantalla muestra el estado vacío normal — "Todavía no enviaste comunicados" — sin
error ni pista de que hay un filtro puesto.

**Por qué pasó:** al escribir el facade en `0041-b` decidí el scope de sede a mano en vez de usar
el núcleo funcional que ya existía. La misma decisión dejó un segundo agujero:
`effectiveBranchId()` devolvía `null` — o sea *todas las sedes* — cuando una secretaria no tiene
`branch_id` asignado, donde `resolveBranchScope()` devuelve `NO_BRANCH_SCOPE` para forzar cero
filas.

Es una sola causa raíz: **el módulo de comunicados resolvía el aislamiento por sede por su
cuenta.** Las dos apariciones se corrigen juntas.

## Reproducción verificada

Como `secretaria@test.com` (sede 1), con 3 comunicados suyos sembrados. Misma sesión, mismo
usuario, cambiando **solo** el `localStorage`:

| `autoescuela:selectedBranchId` | Filas en el historial |
|---|---|
| `null` | 3 |
| `{"id":2,"name":"Conductores Chillán"}` | **0** — "Todavía no enviaste comunicados" |

Camino realista para llegar ahí: PC compartida del mostrador. El admin deja elegida otra sede, se
desloguea, entra la secretaria.

## ACs Afectados

- **0041-b AC7** — "el historial responde qué se le comunicó a los alumnos y cuándo". Hoy no lo
  responde para una secretaria con una sede ajena persistida: responde "nada".
- Ningún AC de `0042-b` ni `0043-b`: la programación, el envío y la nueva jerarquía visual de la
  fila son correctos: simplemente no se llega a ver ninguna fila.

## Cambio

- **Archivos:** `src/app/core/facades/announcements.facade.ts` y
  `src/app/core/utils/branch-scope.utils.ts` (predicado nuevo, sin cambio de conducta).
- **Qué cambia:**
  - **Historial (`branchScope()`):** el cliente filtra por sede **solo si el usuario puede
    elegirla** (`canChooseBranch()`); para quien está anclado, no filtra y el scope lo pone la
    RLS. Así deja de heredar la selección de otro usuario.
  - **Segmento e INSERT (`effectiveBranchId()`):** usa `resolveBranchScope()`, que agrega
    `NO_BRANCH_SCOPE` para una secretaria sin sede asignada. El envío corta antes con un
    mensaje entendible en vez de mandar el centinela a una FK.
  - **`branch-scope.utils.ts`:** se extrae `canChooseBranch()` de adentro de
    `resolveBranchScope()`, que ahora lo usa. Cero cambio de conducta, con un test que
    verifica que no diverjan.

### Dos correcciones a mi propio fix, encontradas verificando

**1. El primer intento borró los comunicados multi-sede.** Anclé el historial con
`eq(branch_id, la suya)` — y en esta tabla `branch_id IS NULL` significa *"a todas las sedes"*,
no *"sin sede"*. La secretaria dejó de ver los avisos que administración manda a todos, que
llegaron a sus propios alumnos. Verificado en pantalla: 2 filas → 1. El scope correcto para ella
ya lo daba la RLS (`branch_visible`: su sede **o** NULL); el filtro del cliente existe solo para
servir al selector de sede del admin, y por eso ahora solo se aplica a quien tiene selector.

**2. Pasarle el grant multi-sede al helper le rompía el envío a una secretaria con grant.**
`resolveBranchScope()` codifica "el grant te deja elegir", que es cierto para **leer** tablas
branch-scoped pero no para **escribir** acá: `insert_announcements` exige
`branch_id = auth_user_branch_id()` para todo rol `secretary`, con grant o sin él. Con el grant
pasado al helper, el compositor habría mandado la sede del selector y la BD lo habría rechazado
con 403. `effectiveBranchId()` no recibe el grant, a propósito.

Ninguna de las dos se veía en los tests que había escrito para el fix: la primera apareció
mirando la pantalla, la segunda leyendo la policy contra el código.

## Test de Regresión

- `announcements.facade.spec.ts > scope de sede del historial (fix-168-b)`, 6 casos ✓
  - una secretaria ignora la sede persistida de otro usuario
  - una secretaria no filtra en el cliente: la RLS le da su sede Y los multi-sede
  - un admin sí respeta el selector de sede
  - un admin en "todas las sedes" consulta sin filtro
  - una secretaria con grant multi-sede respeta el selector (historial)
  - una secretaria con grant igual manda con SU sede: la RLS del INSERT la ancla
  - el centinela nunca llega al INSERT: el envío se corta antes con el motivo real
- `branch-scope.utils.spec.ts > canChooseBranch`, 5 casos ✓ (incluido uno que verifica que no
  diverja de la rama que toma `resolveBranchScope`)

### Verificación en el navegador (lo que de verdad cierra esto)

Como `secretaria@test.com` (sede 1), con dos comunicados sembrados — uno suyo y uno multi-sede
de administración:

| `autoescuela:selectedBranchId` | Antes del fix | Después |
|---|---|---|
| `null` | 2 filas | 2 filas |
| `{"id":2}` (sede ajena) | **0 filas** | **2 filas** |

## Fuera de alcance

- **La clave de `localStorage` sin namespacing por usuario** es el hazard de fondo y afecta a
  cualquier facade branch-scoped, no solo a este. Limpiarla al cerrar sesión (o namespacearla por
  usuario) es un cambio transversal en `BranchFacade`/`AuthFacade` con su propio riesgo de
  regresión en las ~6 facades que la leen. Se anota como candidato aparte; este fix cierra la
  exposición en comunicados usando el helper que ya neutraliza el problema por rol.
- La sede repetida en cada fila del historial (ruido cuando el sistema tiene una sola sede) es
  una decisión de UI, no un bug. No entra acá.
