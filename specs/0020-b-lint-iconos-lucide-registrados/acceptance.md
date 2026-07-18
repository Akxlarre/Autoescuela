# Acceptance 0020-b — Cross-reference íconos Lucide (2026-07-01)

> Ejecutado por Fable 5. Evidencia: `scripts/lib/icon-registry.test.mjs` (11 casos) +
> corridas en `.claude/temp/lint-0020{,-final}.txt`.

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC1 (recolección) | ✅ | Tags `<app-icon>`/`<lucide-icon>` multi-línea en .html e inline; el barrido encontró usos en 100+ archivos |
| AC2 (parseo pick vía AST) | ✅ | ObjectLiteral de `LucideAngularModule.pick` parseado; shorthand y alias cubiertos en test |
| AC3 (faltante = error con identifier exacto) | ✅ | Primera corrida real: **19 íconos usados sin registrar** (crashes de runtime latentes), cada error con kebab, Pascal a agregar y archivos: `radio` (dashboard), `zap`, `pie-chart`, `eye-off` (login), `mail-warning`… |
| AC4 (huérfano = warning) | ✅ | 23 íconos registrados sin uso listados como warning agrupado, nunca error |
| AC5 (verde o corregido en la spec) | ✅ | 18 registrados en app.config.ts (sección "Registrados por lint ARCH-14") + 1 fix de nombre → ARCH-14: 0 |
| AC-E1 (dinámicos) | ✅ | Ternarios resolubles validados (test); 49 archivos con `[name]` opaco reportados como info sin bloquear |
| AC-E2 (alias) | ✅ | Test: `pick({ CircleAlert: AlertCircle })` registra la CLAVE, no el valor |
| AC-E3 (icon: en configs) | ✅ | Decidido SÍ: se escanea `icon: '...'` en todo src/app (46+ declaraciones); `pi-*` excluido |

## Hallazgo destacado

`pen-to-square` usado en `instructor-clase-detail.component.ts` **no existe en Lucide**
(es nomenclatura FontAwesome) — el botón "Editar Evaluación" tenía el ícono roto en
producción. Corregido a `square-pen`.

## Decisiones cerradas (§9)

- AC-E3: SÍ (todo src/app). Índice ICONS.md: NO — el warning de huérfanos cumple el rol.

## Estado: DONE
