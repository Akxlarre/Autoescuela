# Plan 0021-b — ROUTES.md + huérfanos

> **Status:** approved
> **Approved by:** Akxlarre ("empecemos entonces, todas menos la 23", 2026-07-01)
> **Modelo ejecutor:** Fable 5

## Diseño (todo en `scripts/indices-sync.js` + `indices/ROUTES.md` nuevo)

### `collectRoutes()`

- Barrido de `src/app/**/*.routes.ts` (hoy solo `app.routes.ts`); AST real.
- Por cada ObjectLiteral de ruta: `path` (concatenado con el prefijo del padre),
  componente (regex sobre el texto del `loadComponent` para `m.X` + `import('...')`, o
  identifier de `component:`), guards (`canActivate/canMatch/canDeactivate` — el getText
  preserva calls como `hasRoleGuard(['admin'])`), `redirectTo`.
- Se registra la ruta si tiene componente, redirect, o es hoja; se recorre `children` con
  el path acumulado. Guards mostrados = propios (la herencia del padre se lee por prefijo).
- Sin cache propio (archivo único, costo despreciable).

### Huérfanos (extensión de `collectUsageMap`)

- `scanDirs` suma `shared/` como consumidor (AC-E1: shared consume shared).
- Se pasa el array completo de components (selector + filePath) para excluir el
  self-match (el template de un componente no cuenta como su propio consumidor).
- En `main()`: `orphans = { components: sin usage y sin ruta que los cargue (por
  importPath de ROUTES), directives: sin usage }` → sección nueva en USAGE-MAP con
  disclaimer fijo (AC5).

### `indices/ROUTES.md` (nuevo)

- Header manual + marcadores AUTO-GENERATED. Tabla `| Path | Componente | Guards | Archivo |`
  en el orden del archivo de rutas (legibilidad > orden alfabético).

## Verificación

1. `indices:sync` → ROUTES.md poblado; muestreo manual contra app.routes.ts
   (login, /app shell, flota anidada, redirects de instructor, `**`).
2. Segunda corrida idempotente.
3. Huérfanos: verificar que `app-kpi-card` (usado dentro de shared) NO aparece, y que los
   componentes listados realmente no tienen consumidor (spot-check con grep).

## Nota de scope

- Agregar ROUTES.md a la lista del Discovery Gate requiere editar `.claude/hooks/`
  (protegido) → queda anotado para el humano en acceptance.md.
