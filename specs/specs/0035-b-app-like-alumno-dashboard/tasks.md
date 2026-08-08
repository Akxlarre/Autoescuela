# Tasks 0035-b — App-like: `/alumno/dashboard`

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Creado:** 2026-08-07 · **Reescrito:** 2026-08-08 (reformulación completa) · **Cerrado:** 2026-08-08

---

## Cómo usar este archivo

Esta spec pasó por 3 diseños (ver spec.md §7 "Historia de esta spec"). Las tareas de abajo reflejan **solo el diseño final** (3 celdas, sin tabs, `--fill-screen-2`). Las tareas de los 2 diseños descartados (`--fill-screen-stack`, tabs con `--fill-screen-kpi`) ya no aparecen acá — el código correspondiente fue revertido.

---

## Fase 1 — Auditoría y diseño (completada 2026-08-08)

- [x] **T1.1** — Mapear qué muestra cada página del portal alumno (`/alumno/horario`, `/alumno/pagos`, `/alumno/clases`, `/alumno/pruebas-online`) para encontrar redundancia con el dashboard
  - **DoD:** tabla de redundancia en spec.md §7, con veredicto de qué contenido es único vs. duplicado
- [x] **T1.2** — Decidir con el owner: KPIs sueltos vs. plegados al hero; qué hacer con Asistencia reciente
  - **DoD:** decisión registrada (`AskUserQuestion`), ambas resueltas por "Recomendado": plegar al hero, cortar asistencia reciente

## Fase 2 — Implementación

- [x] **T2.1** — Reescribir `alumno-dashboard.component.ts`: `bento-grid--fill-screen-2`, hero con 4 KPIs (2 clickeables), 2 columnas `.bento-fill`, selector de matrícula en header de columna izquierda
  - **AC ref:** AC1, AC2, AC3, AC4, AC5
  - **DoD:**
    - [x] Cortadas: sección Asistencia reciente, 2 widgets finales (Nota/Certificado sueltos)
    - [x] Computeds muertos removidos (`hasGrade`, `gradeLabel`, `gradeValue`, `gradeColor`, `certCardColor`, `certIconBg`, `semaphoreLabel`, `semaphoreVariant`, `recentSessions`, `sessionDotBg`, `sessionDotColor`, `formatSessionDate`)
    - [x] Imports muertos removidos (`BadgeComponent`, `KpiCardVariantComponent`, `ScrollRevealDirective`, `RouterLink`); `Router` inyectado para `onKpiClick`
- [x] **T2.2** — `ng build` limpio
- [x] **T2.3** — QA visual inicial → encontrado bug real: columnas con `gridColumn: "1"`/`"7"` (sin `span 6`), renderizando a 1 track de ancho

## Fase 3 — Fix del bug de CSS descubierto

- [x] **T3.1** — Diagnosticar causa raíz: `[data-col-span]` y `[data-col-start]` misma especificidad, `data-col-start` declarado después → pisa el `grid-column-start` que fijaba `grid-column: span N`
  - **DoD:** confirmado con `getComputedStyle` en vivo + grep de los 15 archivos que usan `data-col-span` (solo `alumno-dashboard` combina ambos atributos → blast radius acotado)
- [x] **T3.2** — Fix en `_bento-grid.scss`: `grid-column: span $i` → `grid-column-end: span $i` (tiers `-md` y `lg`, 2 ocurrencias)
  - **DoD:**
    - [x] `ng build` limpio
    - [x] `npm run lint:arch` — 0 errores
    - [x] QA visual re-confirmado: `gridColumn: "1 / span 6"` y `"7 / span 6"`, anchos ~705px/734px (50/50 real)

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio (0 errores, 171 warnings preexistentes no relacionados)
- [x] **T4.2** — `ng build` limpio
- [x] **T4.3** — QA manual (`/verify`), adaptado a las limitaciones del entorno de esta sesión (pestaña backgroundeada pausa GSAP vía `document.hidden`; `resize_window` no tomó efecto)
  - **AC ref:** AC1-AC7, AC-E1-E3
  - **DoD:** ver `acceptance.md` — evidencia sólida para AC1/2/3/6/7, pendiente de cuentas de prueba para AC4 (multi-matrícula), AC5-mobile visual, y el caso Profesional-7-módulos de AC (Evaluación scroll interno)
- [x] **T4.4** — Ejecutar `/spec-verify` formal y obtener visto bueno visual del owner — **confirmado 2026-08-08** ("muchísimo mejor, cerramos")

## Fase 4.5 — Pulido visual (owner: "esos dos componentes quedaron horriblemente feos")

- [x] **T4.5.1** — Rediseñar la grilla de 12 prácticas: de celdas ~140px con verde casi invisible a stepper compacto (círculos, verde sólido real) + tooltip con fecha real
- [x] **T4.5.2** — Agregar "Próxima: Práctica N — fecha" (usa `practices[].date`, dato ya existente en el modelo, antes sin usar)
- [x] **T4.5.3** — Agrandar la tarjeta de examen (Clase B) + agregar fecha de rendición (`grades.finalExamDate`, ídem — dato ya existente sin usar)
- [x] **T4.5.4** — Elevar el motivo de bloqueo del certificado de texto plano a `<app-alert-card severity="warning">`
- [x] **T4.5.5** — Centrado vertical del contenido: columna izquierda siempre (contenido acotado); columna derecha solo Clase B (Profesional ya llena el espacio con su lista + `overflow-auto` propio)
- [x] **T4.5.6** — `ng build` + `lint:arch` limpios tras cada cambio; encontrados y corregidos 3 backticks sueltos en comentarios del template (misma trampa de spec 0030/0031, memoria del proyecto)
- [x] **T4.5.7** — QA visual (claro y oscuro) confirmando el resultado

## Fase 4.6 — Reestructura a 4 celdas (owner rechazó el centrado, pidió "un componente más")

- [x] **T4.6.1** — Quitar `data-row-span="2"` de las 2 columnas (ahora comparten 1 fila fr en vez de ocupar las 2)
- [x] **T4.6.2** — Nueva celda "Camino al Certificado" (`journeySteps` computed): tracker horizontal de 3 pasos con los mismos signals ya usados (`progress`/`grades`/`certificate`), sin regla de negocio nueva
- [x] **T4.6.3** — Registrar ícono `Milestone` en `app.config.ts` (import + `pick()`)
- [x] **T4.6.4** — Ajustar espaciado (`gap-6`→`gap-3`) tras encontrar que el contenido de "Mi Progreso" excedía por 12px el alto de la fila más chica, cortando la última línea
- [x] **T4.6.5** — `ng build` + `lint:arch` limpios; encontrados y corregidos 2 backticks sueltos más en comentarios del template (misma trampa, 3ra vez en esta sesión)
- [x] **T4.6.6** — QA visual (claro y oscuro) confirmando 4 celdas, sin cortes de contenido, `documentScrolls:false`

## Fase 4.7 — Verificación Profesional + limpieza del bloque certificado duplicado

- [x] **T4.7.1** — Verificar Clase B y Profesional a pedido del owner. Sin cuenta de prueba Profesional real → inyección client-side de snapshot simulado (`ng.getComponent()` + `facade._snapshot.set()`), sin tocar la BD ni crear cuentas
- [x] **T4.7.2** — Encontrado: lista de 7 módulos muy apretada por compartir espacio con el bloque de certificado completo (alert-card + separador) — feedback directo del owner
- [x] **T4.7.3** — Sacar el bloque de certificado de la columna "Evaluación" (ya duplicaba la celda "Camino al Certificado"): motivo de bloqueo pasa a mostrarse una sola vez debajo del tracker; paso "Certificado" del tracker muestra folio cuando `issued`
- [x] **T4.7.4** — Remover computeds/imports que quedaron sin uso tras el cambio (`certIcon`, `certIconColor`, `certStatusLabel`, `AlertCardComponent`, `AnimateInDirective`)
- [x] **T4.7.5** — `ng build` + `lint:arch` limpios; QA visual confirma módulos legibles (6 visibles + scroll para el 7°) en claro y oscuro

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/COMPONENTS.md` (entrada reescrita completa con la estructura final de 4 celdas)
- [x] **T5.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T5.3** — `/spec-activate --clear`

---

## Tareas descubiertas durante implementación

- [x] **Bug preexistente de `_bento-grid.scss`** (`data-col-span`+`data-col-start`) — no estaba en el scope original de ninguno de los 3 diseños; se encontró al implementar el diseño final y se corrigió en la misma sesión (ver Fase 3). Sin blast radius fuera de esta página (grep confirmado).
- [ ] Confirmar si los 2 KPIs clickeables del hero (`proxima-clase`, `saldo`) necesitan `data-llm-description` explícito además del `data-llm-action` que ya pone `SectionHeroComponent` genéricamente — pendiente de revisar `.claude/rules/ai-readability.md` contra la implementación real de `section-hero.component.ts:583`.
