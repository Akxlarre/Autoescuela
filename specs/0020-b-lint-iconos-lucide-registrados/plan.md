# Plan 0020-b — Cross-reference íconos Lucide

> **Status:** approved
> **Approved by:** Akxlarre ("empecemos entonces, todas menos la 23", 2026-07-01)
> **Modelo ejecutor:** Fable 5

## Diseño

### `scripts/lib/icon-registry.js` (nuevo, no protegido, testeable)

- `kebabToPascal(name)`: `trending-up`→`TrendingUp`, `trash-2`→`Trash2`, `rotate-ccw`→`RotateCcw`.
- `collectUsedIcons(content)`: sobre el contenido de un archivo devuelve
  `{ statics, ternaryLiterals, dynamicCount }`:
  - `statics`: `name="x"` en tags `<app-icon>`/`<lucide-icon>` **+** `icon: 'x'` en objetos
    de config TS (AC-E3 decidido: se escanea TODO src/app — hay 46+ declaraciones en
    features/shared, no solo layout).
  - `ternaryLiterals`: si `[name]="cond ? 'a' : 'b'"`, se extraen los literales de las ramas.
  - `dynamicCount`: bindings `[name]=` no resolubles → reporte informativo, no bloquea.
- `parseRegisteredIcons(appConfigSrc, ts)`: AST — CallExpression `LucideAngularModule.pick`,
  claves del ObjectLiteral (shorthand o `Clave: Valor` → cuenta la CLAVE, AC-E2).

### `scripts/architect.js` (staging + copia)

- ARCH-14 en RULES. Durante el barrido, acumular usos por archivo (map ícono → archivos).
- `app.config.ts` no está en targetDirs → se parsea aparte al final.
- Post-barrido: faltantes (Pascal ∉ pick) → **error** ARCH-14 por ícono con archivos y el
  identifier exacto a agregar; registrados sin uso → **warning** agrupado; dinámicos → línea
  informativa (dim).

### Micro-suite `scripts/lib/icon-registry.test.mjs`

Casos: estáticos multi-línea, ternario resoluble, binding opaco, icon:'x' config,
alias en pick, conversión kebab→Pascal con dígitos.

## Verificación

1. Micro-suite verde.
2. Corrida real: AC5 — si hay faltantes reales, registrarlos en app.config.ts en esta misma
   spec (track activo); si no, verde directo. Huérfanos solo se listan.

## Decisiones cerradas de §9

- AC-E3: SÍ se escanean los `icon: '...'` de configs TS (en todo src/app).
- Sección en índice: NO por ahora — el warning de huérfanos del linter cumple el rol
  informativo; crear ICONS.md sería un índice más que mantener sin consumidor claro.
