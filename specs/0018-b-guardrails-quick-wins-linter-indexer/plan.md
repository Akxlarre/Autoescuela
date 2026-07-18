# Plan 0018-b — Guardrails quick-wins: linter + indexer

> **Status:** approved
> **Approved by:** Akxlarre ("empecemos entonces, todas menos la 23", 2026-07-01)
> **Modelo ejecutor:** Fable 5 (sesión actual; la spec sugería Haiku 4.5 — sin impacto)

## Cambios

### A. `scripts/architect.js` (protegido — se aplica vía staging + copia autorizada)

1. **ARCH-12** (nueva regla, error): en `analyzeTypeScript`, si el archivo es `*.component.ts`
   y un `ImportDeclaration` tiene specifier que matchea `models/dto/`, reportar error.
   `.spec.ts` ya está excluido del barrido.
2. **ARCH-13** (nueva regla, error): si el archivo es `*.facade.ts` en core/, cualquier
   `CallExpression` cuyo callee sea el identifier `effect` reporta error (AST, no regex —
   inmune a comentarios/strings).
3. **ARCH-06 inline**: extraer template inline (`template: \`...\``) del `.ts` y correr sobre él
   los mismos 4 patrones de directivas deprecadas que `analyzeTemplate` aplica a `.html`.
4. Registrar ARCH-12/ARCH-13 en `RULES` con doc y fix.

### B. `scripts/indices-sync.js`

5. `collectPipes(cache, prev)`: barrido de `src/app/**/*.pipe.ts` (excluye `.spec.ts`),
   extrae `name:` del decorador `@Pipe`, flag `pure` (default true), clase y archivo.
   Cache mtime + reuse de prev como los demás colectores.
6. `generatePipesTable(items)` + wiring en `main()` hacia `indices/PIPES.md`.

### C. `indices/PIPES.md` (nuevo)

7. Header manual + marcadores AUTO-GENERATED.

### D. Fixes de las 2 violaciones ARCH-12 existentes (src/app — requiere track activo)

8. `ui/task.model.ts`: agregar `export type { TaskReply } from '@core/models/dto/task-reply.model';`
   (mismo patrón que la línea 4 usa para TaskType/TaskStatus) y cambiar el import en
   `task-reply-thread.component.ts` a `@core/models/ui/task.model`.
9. `ui/website-config.model.ts` (nuevo): re-export de `SiteData` desde el DTO; cambiar el
   import en `admin-configuracion-web.component.ts`.

## Orden de verificación (fixture real)

1. Aplicar reglas del linter → `npm run lint:arch` debe reportar **exactamente 2 errores ARCH-12**
   (las violaciones reales) → esto prueba AC1 sin fixtures sintéticos.
2. Aplicar los fixes D → `lint:arch` verde de nuevo (AC2).
3. ARCH-13/ARCH-06-inline: fixture temporal en core/ bajo el track activo, verificar que dispara,
   eliminar fixture (AC3/AC4 + AC-E2).
4. `npm run indices:sync` ×2 → PIPES.md poblado e idempotente (AC5/AC6).
5. `ng build` para confirmar que los fixes D compilan.
