# Acceptance 0018-b — Guardrails quick-wins (2026-07-01)

> Ejecutado por Fable 5. Baseline relevante: `lint:arch` ya estaba ROJO en HEAD por backlog
> pre-existente fuera de scope (29× ARCH-02, 11× ARCH-03, 5× ARCH-11). Los ACs se miden
> contra los conteos por regla, no contra "lint verde global".

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC1 (ARCH-12 dispara) | ✅ | Primera corrida tras activar la regla: exactamente los **2 errores predichos** (task-reply-thread, admin-configuracion-web) — fixture real, no sintético |
| AC2 (backlog resuelto) | ✅ | `TaskReply` re-exportado en `ui/task.model.ts`; `ui/website-config.model.ts` nuevo re-exporta `SiteData`; imports corregidos → ARCH-12: 0. `ng build` limpio (126s, solo warning pre-existente de bundle budget) |
| AC3 (ARCH-13 dispara) | ✅ | Fixture `zz-fixture-arch13.facade.ts` con `effect()` real → exactamente 1 error ARCH-13. Fixture eliminado tras la prueba |
| AC4 (ARCH-06 inline) | ✅ | La regla atrapó una violación REAL invisible hasta hoy: 3× `[ngClass]` en template inline de `live-classes-panel.component.ts` → convertidos a `[class.x]`. ARCH-06: 1→0 |
| AC5 (colector pipes) | ✅ | PIPES.md auto-generado: `safe` (pure), `relativeTime` (impure), `shortCurrency` (pure) con clase y archivo |
| AC6 (idempotencia) | ✅ | Segunda corrida de `indices:sync`: "(3 cached)", sin cambios |
| AC-E1 (spec.ts exento) | ✅ | El barrido excluye `.spec.ts` desde el filtro de archivos (mismo mecanismo pre-existente) |
| AC-E2 (comentario/string) | ✅ | El fixture contenía `effect()` en comentario Y en string: solo la CallExpression real disparó (conteo = 1) |
| AC-E3 (pipe fuera de carpeta convencional) | ✅ | `collectPipes` barre todo `src/app/` por sufijo `.pipe.ts` (encontró pipes en `core/pipes/` y `shared/pipes/`) |

## Desvíos del plan

- **T6 descubierta:** al corregir el `[ngClass]` de live-classes-panel, el Architect Guard
  exigió reemplazar las clases muertas de esas líneas: `bg-surface-hover`→`bg-subtle`,
  `text-brand-contrast`→`text-brand-text` (AP-011: no renderizaban nada; se usó el equivalente
  canónico de la intención). ARCH-11 del archivo: resuelto de paso.
- `architect.js` se aplicó vía staging (`architect.staged.js`) + copia, autorizada por el
  flujo acordado con el humano (File Protector no cubre canal shell — ver spec 0023).

## Estado: DONE
