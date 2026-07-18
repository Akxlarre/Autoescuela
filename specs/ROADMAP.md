# Roadmap SDD — Autoescuela

> Índice vivo de todas las specs del proyecto.
> Mantener actualizado: cada spec nueva o cambio de estado se refleja acá.

---

## Activa

| ID | Título | Owner | Activada |
|----|--------|-------|----------|

---

## Backlog

| ID | Título | Prioridad | Owner | Notas |
|----|--------|-----------|-------|-------|
| [0005](./0005-publicacion-automatica-cpanel-self-hosted/spec.md) | Publicación Estática Automática en cPanel Self-Hosted | P1 | Akxlarre | Desactivada por ahora; se implementará tras finalizar el desarrollo visual. |
| [0006](./0006-borrado-mensajes-modulo-comunicacion/spec.md) | Borrado de mensajes en módulo de comunicación | P1 | Akxlarre | Criterios acordados. Botón eliminar + filtro 90 días para completadas. |
| [0023](./0023-bash-guard-hardening-file-protector/spec.md) | Hardening Bash Guard: File Protector para canal shell | P2 | Akxlarre | Draft. Modelo sugerido: **Fable 5**. El humano aplica el diff (hooks protegidos). Origen: bypass demostrado 2026-07-01. Excluida del batch del 2026-07-01 por decisión del owner. |

---

## En progreso

| ID | Título | % tareas | Última edición |
|----|--------|----------|----------------|

---

## Done

| ID | Título | Cerrada | Verificada por |
|----|--------|---------|----------------|
| [0032](./0032-pre-inscritos-content-fill-screen/spec.md) | Pre-inscritos: content unificado + app-like fill-screen | 2026-07-17 | 8/8 AC de código + 2 AC visuales (AC3 fill-screen, AC-E1 switch con drawer) con visto bueno visual del owner → ✅ PASA. Nuevo Dumb `pre-inscritos-content` consolida admin+secretaría (~95% duplicados): buscador+filtros+tabla/cards en 1 card. **Paginación `<p-paginator>` de PrimeNG** (12 desktop/6 móvil, pagina tabla y cards, look de Base Alumnos B). **Cards responsive** en móvil / tabla en desktop (switch por CONTENEDOR `isDesktopLayout()`, no `md:`). Fill-screen (cero SCSS nuevo) + hover canon en el card. `<app-badge variant="brand">` para el pill. Ampliación de scope in-flight (paginación + cards + p-paginator, a pedido del owner). 1335/1335 test:ci (spec del Dumb 15/15), build + lint:arch limpios. Ver acceptance.md. |
| [0031](./0031-ciclos-teoricos-fill-screen/spec.md) | Ciclos Teóricos: fill-screen app-like + fix del shift de tabs por scrollbar | 2026-07-13 | 5/5 AC + 3/3 edge cases ✅ PASA (AC4 con nota de entorno: viewport fijo del Chrome de automatización → verificado por paridad con 0030 + prueba aislada de estructura). Continuación de 0030 (Ciclos era out-of-scope). El modificador `--fill-screen-kpi` pasa a incondicional (ambos tabs) → **elimina el shift de la fila de tabs** (ya no aparece/desaparece scrollbar de página al alternar). `ciclos-teoricos-content`: host como celda `.bento-fill` (`:host` flex), selector fijo + 2 columnas flex con scroll interno (Clases protagonista `flex-1` / Alumnos rail `w-96`); input `isDesktop` (por contenedor, no `lg:`). Limpieza de `.bento-banner` muertas. Cero SCSS nuevo (AC5). Build + test:ci + lint:arch limpios. **Refinamiento (owner):** fusión del selector de ciclo en el header de la columna Clases (era fila-tarjeta de ~140px de un fill de 457px → Clases +72% visible, 237→407px); badge de estado migrado a `<app-badge>` (limpió ARCH-15). Ver acceptance.md §"Refinamiento post-cierre". |
| [0030](./0030-asistencia-b-layout-dual/spec.md) | Asistencia B: layout dual (fill-screen desktop / scroll móvil) + densidad adaptativa | 2026-07-13 | 8/8 AC + 5/5 edge cases ✅ PASA, con visto bueno visual del owner tras **2 rondas de feedback**. Cero SCSS nuevo (reusa `--fill-screen-kpi`; AC4 = diff vacío en `_bento-grid.scss`). **Ronda 1:** alertas de card pesada → fila compacta de 1 línea (detalle en `title`); fix bug real `formatIsoDate`+`timestamptz`. **Ronda 2:** la distribución seguía invirtiendo la jerarquía (alertas apiladas arriba comían el espacio de la tabla, que es la protagonista) → **redistribución a 2 columnas** (tabla `order-1 flex-1` ancha + alertas `<aside order-2 w-80>` rail); switch col/row por CONTENEDOR (`isDesktopLayout()`= `maxVisible()===null`), no por viewport `lg:`, para apilar con el drawer abierto igual que la densidad. Tab Ciclos ya era 2col → intacto. 1293/1293 test:ci, build + lint:arch limpios. Ver acceptance.md §§ "Revisión post-cierre" (×2). |
| [0029](./0029-comunicaciones-task-list-consolidacion/spec.md) | Comunicaciones: consolidar 3 implementaciones + patrón dual (spec 0028) | 2026-07-12 | 6/6 AC + 3 edge cases ✅ PASA (2 AC con evidencia unitaria, no end-to-end, declarado). Nuevo `<app-task-list-content>` compartido reemplaza 3 templates casi duplicados (Admin/Secretaria/Instructor). Nuevo modificador CSS `.bento-grid--fill-screen-kpi` (hero+KPI-row+lista). Bug real encontrado y corregido en vivo (selector `.bento-fill` no cubría el modificador nuevo). Login real con los 3 roles vía Playwright. Ver acceptance.md. |
| [0028](./0028-layout-responsive-dual-densidad-adaptativa/spec.md) | Layout responsive dual: fill-screen desktop / scroll natural móvil + densidad adaptativa | 2026-07-11 | 13/13 ACs ✅ PASA (verificación en vivo Playwright). Canon `.bento-fill` en `_bento-grid.scss` (contain:size solo lg+), fix capa `.bento-card min-height` scoped, `LayoutService.tier()` por ResizeObserver de `<main>`, presupuestos 4/3/3 dashboard + 6/"Cargar más" alumnos. 1274/1274 tests, lint:arch 0 errores. Rollout a ~28 páginas = deuda declarada. Ver acceptance.md. |
| [0027](./0027-notificaciones-ola-4/spec.md) | Notificaciones Ola 4: vencimiento de documentos de flota (D3) | 2026-07-10 | ✅ 5/5 AC + 3/3 edge cases, todos verificados con datos reales vía RPC/REST directo (sin harness — mismo criterio que Spec 0026). Función `notify_vehicle_document_expiry()` + `cron.schedule` diario. Alcance reducido a D3 (D2 diferido documentado, D4 bloqueado, WhatsApp fuera). `lint:arch` sin cambios (0 TS tocado). Datos de prueba limpiados sin residuos. Corrección adicional de documentación: `vehicles.vehicle_id` (inexistente) → `vehicles.id` en `indices/DATABASE.md`. Ver acceptance.md. |
| [0026](./0026-notificaciones-ola-3/spec.md) | Notificaciones Ola 3: triggers SQL (clase completada, tareas, aviso 2ª cuota) | 2026-07-10 | ✅ 11/11 ACs, todos verificados con datos reales vía REST directo (no solo tests con mocks — no hay harness para triggers SQL). 2 bugs reales encontrados y corregidos en QA en vivo: guard `payment_mode='deposit'` (valor inexistente, real es `'partial'`) y `reference_id` INT vs UUID de tareas. También se reparó un drift pre-existente de tracking de migraciones remoto (99/139 sin registrar) + 5 archivos con timestamp duplicado, pre-requisito para poder aplicar la spec. `lint:arch` sin cambios (0 TS tocado). Datos de prueba limpiados sin residuos. Ver acceptance.md. |
| [0025](./0025-notificaciones-ola-2/spec.md) | Notificaciones Ola 2: circuito financiero (A4-A7) + onboarding (B2, B3) | 2026-07-10 | ✅ 11/12 ACs con evidencia (AC-E3 documentado como no aplicable al dominio real — no bloqueante), 0 fallidos. 100 tests nuevos/actualizados verdes en 7 facades. `lint:arch` 0 errores nuevos (+3 warnings ARCH-10 aceptados, verificado contra HEAD vía `git stash` parcial). `ng build` limpio (encontró y corrigió un TS2345 real en `servicios-especiales.facade.ts`). QA en vivo real (AC4): anticipo de prueba registrado contra la BD de desarrollo, verificado con datos reales vía REST directo (RLS admin lee todas las notifications) que `recipient_id` coincidió exactamente con el instructor correcto, luego eliminado limpiamente sin dejar residuos. Ver acceptance.md. |
| [0024](./0024-notificaciones-ola-1/spec.md) | Notificaciones Ola 1: infraestructura de tipos + primeros productores (RF-022) | 2026-07-07 | ✅ 12/12 ACs (10 con test dedicado, 2 por construcción documentada), 0 fallidos. 155 tests nuevos/actualizados verdes en 6 specs (uno creado desde cero: `certificacion-clase-b.facade.spec.ts`, no existía). `lint:arch` sin errores nuevos (verificado contra HEAD vía `git stash`). QA manual Playwright (T5.3) verificado OK por el owner el 2026-07-07. Ver acceptance.md. |
| [0018](./0018-guardrails-quick-wins-linter-indexer/spec.md) | Guardrails quick-wins: ARCH-12 (DTO en componentes), ARCH-13 (effect en facades), ARCH-06 inline, PIPES.md | 2026-07-01 | 9/9 ACs. ARCH-12 atrapó las 2 violaciones predichas (corregidas vía re-export en ui/); ARCH-06-inline atrapó 3 [ngClass] reales en live-classes-panel (corregidos). PIPES.md auto-generado (3 pipes). `ng build` limpio. Ver acceptance.md. |
| [0019](./0019-theme-whitelist-clases-token/spec.md) | Whitelist de clases token derivada del `@theme` (ARCH-11 v2) | 2026-07-01 | 8/8 ACs. `scripts/lib/theme-tokens.js` + suite 28 casos. Backlog real: 20 clases muertas en 12 archivos (el "~549" ya migrado por fix-030 + inflado por bug de \b). Warning default + `--strict`. Atrapó familias que la lista negra no conocía (`*-dark`, `bg-brand-primary`). Ver acceptance.md. |
| [0020](./0020-lint-iconos-lucide-registrados/spec.md) | Cross-reference íconos Lucide usados vs `pick()` (ARCH-14) | 2026-07-01 | 9/9 ACs. `scripts/lib/icon-registry.js` + suite 11 casos. **19 íconos sin registrar detectados y corregidos** (18 registrados + `pen-to-square`→`square-pen`, que no existe en Lucide). 23 huérfanos listados. Ver acceptance.md. |
| [0021](./0021-indexer-routes-y-huerfanos/spec.md) | Indexer: ROUTES.md + huérfanos en USAGE-MAP | 2026-07-01 | 9/9 ACs. ROUTES.md: 107 rutas (paths anidados, guards, redirects). Huérfanos: 11 componentes + 2 directivas (spot-checks confirman: `app-kpi-card` real sin uso — solo vive su skeleton). shared/ ahora cuenta como consumidor. Ver acceptance.md. |
| [0022](./0022-database-md-desde-migraciones/spec.md) | DATABASE.md auto-generado desde migraciones SQL | 2026-07-01 | 10/10 ACs. `scripts/lib/sql-schema.js` (regex por sentencia, cero deps) + suite 21 casos. 133 migraciones → 76 tablas / 274 policies / 40 funciones / 4 vistas con **0 warnings**. Todas las tablas con RLS. Manual intacto. Ver acceptance.md. |
| [0017](./0017-secretaria-multi-sede-grant-admin/spec.md) | Secretaria multi-sede (grant del admin) | 2026-07-01 | Akxlarre |
| [0007](./0007-reorganizacion-modular-menu-candado-ajustes/spec.md) | Reorganización Modular del Menú, Candado de Sede y Drawer de Ajustes | 2026-07-01 | Akxlarre |
| [0009](./0009-rediseno-ux-flujo-inscripcion-online-publico/spec.md) | Rediseño UX del Flujo de Inscripción Online Público | 2026-07-01 | Akxlarre |
| [0016](./0016-base-alumnos-split-b-profesional/spec.md) | Separación de Base de Alumnos en páginas Clase B / Profesional | 2026-06-23 | 15/15 ACs cumplidos (1 con salvedad de scope). 3 fases: Base B acotada a `class_b`, Base Profesional nueva (facade+componente propio, semáforo `v_professional_attendance`, módulos 1–7), Ex-Alumnos split. Admin+Secretaría. 15/15 tests facades, `ng build` limpio, QA Playwright 0 errores consola. Pre-inscritos movido a sección profesional. `secretaria-ex-alumnos` (B) reconstruido de stub a funcional (paridad). Ver acceptance.md. |
| [0015](./0015-header-slim-mode/spec.md) | Header Slim Mode (Section Hero Compacto) | 2026-06-18 | 12/12 ACs cumplidos Playwright. `density="slim"` + `kpis` en `app-section-hero`. Dashboard + liquidaciones migrados. row1=59px ≤60px, total=120px ≤120px. `sparkline.utils` 8/8 tests verdes. `ng build` limpio. Ver acceptance.md. |
| [0014](./0014-reemplazar-inputs-fecha-nativos-por-p-datepicker/spec.md) | Reemplazar inputs de fecha nativos por p-datepicker del Design System | 2026-06-13 | 18 instancias `type="date"` → `app-date-input` (wrapper `p-datepicker`). 0 nativos restantes en build. Playwright: calendario abre en flujo público `/inscripcion`, junio 2026, locale español, 0 errores consola. `ng build` limpio. |
| [0013](./0013-reemplazar-selects-nativos-por-design-system/spec.md) | Reemplazar selects nativos por componentes del Design System | 2026-06-12 | 5 componentes: `p-select` (anticipo ×2, vehículo, tema, curso) + segmented control gender (público + admin). `ng build` limpio. Playwright: segmented control interactivo, dark mode OK, 0 errores consola. |
| [0012](./0012-validaciones-ux-flujo-inscripcion-publica/spec.md) | Validaciones UX — Flujo de inscripción pública | 2026-06-12 | 18/19 ACs verificados Playwright. AC19 cubierto por browser nativo + unit tests. `app-phone-input` E.164, dirty-state per-field, dirty-all-on-submit, ARIA WCAG 3.3.1. Ver acceptance.md. |
| [0011](./0011-auditoria-ui-ux-global/spec.md) | Auditoría UI/UX Global — responsive, polish, Design System | 2026-06-04 | ⚠️ PARCIAL. Flujo público auditado a fondo (Playwright mobile/tablet/desktop): 0 overflow, touch targets ≥44px, 4 fixes (7cad8de, 721263d) + fix-007/fix-008. AC-R1 retorno success/cancelled = deuda manual (necesita pago real). ACs del panel admin diferidos (fuera de §7). Ver acceptance.md. |
| [0010](./0010-hardening-seguridad-flujo-inscripcion-publico/spec.md) | Hardening de Seguridad del Flujo de Inscripción Online Público | 2026-06-04 | 7/10 ACs verificados en cloud. AC-F1/F2 (E2E Webpay completo) documentados como deuda manual. |
| [0008](./0008-eliminar-estilos-inline-clases-semanticas/spec.md) | Eliminar estilos inline — migrar a clases semánticas del design system | 2026-05-28 | Akxlarre (AC5 dark mode pendiente QA visual manual) |
| [0001](./0001-sistema-de-tareas-multi-rol/spec.md) | Sistema de tareas y observaciones multi-rol | 2026-05-18 | Akxlarre (T6.3/T6.4 pendientes QA manual con Supabase local) |
| [0002](./0002-instructor-tareas-vista-por-tipo/spec.md) | Instructor: Vista de Tareas con Diferenciación por Tipo | 2026-05-22 | Akxlarre (T3.3 QA manual pendiente usuario) |
| [0003](./0003-landing-pages-panel-control-autoescuelas-chillan/spec.md) | Landing Pages & Panel de Control — Autoescuelas Chillán | 2026-05-22 | Akxlarre (8/8 tests automatizados vitest verdes) |
| [0004](./0004-refactor-website-config-courses-fk/spec.md) | Refactor website_config.courses → FK al catálogo operacional | 2026-05-23 | Akxlarre (build + Astro build limpios; 24/24 tests facade verdes; QA manual pendiente con Supabase local) |

---

## Archived (descartadas / superseded)

| ID | Título | Motivo | Reemplazada por |
|----|--------|--------|-----------------|

---

## Convenciones

- **IDs:** `NNNN-kebab-slug`, secuencial, nunca se reutilizan
- **Prioridad:** P0 (bloquea producción) / P1 (necesario sprint) / P2 (nice-to-have)
- **Estado:** draft → approved → in_progress → done | archived
- **Owner:** quién es responsable de redactar + cerrar la spec
