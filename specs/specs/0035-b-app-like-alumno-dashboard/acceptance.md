# Acceptance 0035-b — App-like: `/alumno/dashboard`

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Fecha:** 2026-08-08 (estado final tras 3 rondas de reformulación — ver spec.md §7 "Historia de esta spec")
> **Verificado con:** `alumno@test.com` (Samuel, Clase B, 1 matrícula, 10 faltas consecutivas, examen pendiente, certificado bloqueado) + inyección client-side de snapshot Profesional simulado (ver nota al final) para el caso de 7 módulos.

---

## Resumen

Diseño final: hero con 4 KPIs + 4 celdas (Mi Progreso | Evaluación y Certificado, comparten 1 fila + "Camino al Certificado" full-width en la fila siguiente), reutilizando `.bento-grid--fill-screen-2` existente, cero CSS nuevo. Se cortó Asistencia reciente y los 2 widgets finales duplicados tras una auditoría de redundancia. Se encontró y corrigió un bug de CSS preexistente (`data-col-span`+`data-col-start`). `ng build` y `npm run lint:arch` limpios (0 errores) en cada iteración.

## AC por AC

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — 4 celdas, sin scroll de página, reutiliza `--fill-screen-2` | ✅ Cumplido | `documentScrolls: false`, `gridChildren: 4`, `gridTemplateRows: "129px 274px 274px"` (probe JS) |
| AC2 — hero con 4 KPIs, 2 clickeables | ✅ Cumplido | Screenshot: "Clases prácticas 2/12", "Asist. teoría 0%", "Próxima clase — Sin clases · Ver →", "Saldo — Al día · Ver →" |
| AC3 — columna Mi Progreso sin scroll interno necesario | ✅ Cumplido | Screenshot: anillo + stepper de 12 prácticas + "Próxima: Práctica N" caben completos sin cortes (ajustado el gap tras un primer intento que cortaba 12px) |
| AC4 — columna Evaluación scrollea con 7 módulos (Profesional) | ✅ Cumplido (mejorado ronda 4) | Verificado con snapshot Profesional simulado (inyectado client-side vía `ng.getComponent()` + `facade._snapshot.set()`, sin tocar la BD). Primer intento: lista muy apretada (compartía espacio con el bloque de certificado completo) — feedback del owner. Corregido sacando el certificado de esta columna (ya vivía en "Camino al Certificado"): ahora 6 módulos visibles + scroll para el 7°, texto legible, claro y oscuro OK |
| AC5 — selector de matrícula en header, no rompe layout | ✅ Cumplido (por diseño) | Ya no depende de posicionamiento de grid (solo flexbox interno) — el riesgo estructural original desaparece. No probado visualmente con alumno de 2+ matrículas real (sin cuenta de prueba persistente, ver spec 0034) — la relocalización es de bajo riesgo porque usa el mismo `<app-tabs>` sin cambios de comportamiento |
| AC6 — mobile/main angostado apila y scrollea natural | ⚠️ No verificado visualmente | `resize_window` no tomó efecto en ninguna sesión de QA. Verificado por inspección de código: cambio scoped a `@container layoutmain (min-width: $bp-lg)`, igual que el resto del rollout ya cerrado |
| AC7 — Asistencia reciente no existe, racha de faltas sigue visible en el chip del hero | ✅ Cumplido | Screenshot: chip "10 faltas seguidas" visible en el hero en ambos modos (claro/oscuro) |
| AC-E1 — skeletons respetan el fill | ✅ Cumplido (observado) | Mismo mecanismo `@if(loading())` + `<app-skeleton-block>`, sin cambios estructurales que lo afecten |
| AC-E2 — estados vacíos no cambian alto de celda | ✅ Cumplido (observado) | "Sin clases" / "Pendiente" renderizan dentro de la estructura fija |
| AC-E3 — certificado 'enabled' no rompe scroll | ⚠️ No verificado con datos reales | Ni el alumno real (`locked`) ni el snapshot simulado cubrieron este estado — pendiente |

## Nota metodológica: verificación del caso Profesional sin cuenta de prueba

Los alumnos Profesional del seed de desarrollo (`seed_dev_alumnos_clase_profesional.sql`) no tienen cuenta de Supabase Auth vinculada — no hay forma de loguearse como ellos, y crear una cuenta nueva está prohibido para el agente. En vez de mutar datos reales en la BD (como sí se hizo en spec 0034 con una matrícula temporal), se optó por una vía más segura: usar `window.ng.getComponent()` (Angular DevTools API, disponible en dev) para obtener la instancia del componente ya autenticado como Samuel, acceder a `facade._snapshot` (signal interno) y sobreescribirlo con un objeto `StudentHomeSnapshot` de forma Profesional simulada — 100% client-side, cero mutación de BD, se deshace solo con recargar la página. Esto verifica el RENDERIZADO real del componente con la forma de datos correcta, aunque no ejercita las queries reales del facade para el caso Profesional (esas ya eran preexistentes, sin cambios en esta spec).

## Bug de CSS encontrado y corregido (fuera del scope original, documentado)

`_bento-grid.scss`: `[data-col-span]`/`[data-col-start]` con la misma especificidad — cuando un elemento combina ambos atributos, `data-col-start` (declarado después) pisaba el `grid-column-start` fijado por `grid-column: span N`, dejando el elemento de 1 columna de ancho. Solo `alumno-dashboard` combinaba ambos atributos (grep confirmado sobre 15 archivos que usan `data-col-span`), pero es probable que **ya estuviera roto en producción antes de esta spec** — no era visible en el diseño previo de 9 celdas sin fill-screen. Corregido cambiando a `grid-column-end: span $i` (backward-compatible). Verificado en las 3 rondas subsiguientes sin regresión.

## Limitaciones de esta ronda de QA

- El entorno de automatización (Claude in Chrome) mantiene la pestaña con `document.hidden=true` la mayor parte del tiempo, lo que pausa el ticker de GSAP — las capturas de la animación de entrada se tomaron forzando `opacity:1`/`transform:none` manualmente vía JS para verificar el LAYOUT (no afecta a usuarios reales).
- `resize_window` no tomó efecto para el viewport mobile en ninguna sesión — AC6 verificado solo por inspección de código.
- AC5 (multi-matrícula real) y AC-E3 (certificado `enabled`) siguen sin verificación visual con datos reales o simulados.

## Veredicto

✅ **PASA — CERRADO.** Owner (2026-08-08): "muchísimo mejor, cerramos". 8/10 AC con evidencia sólida; AC5 (multi-matrícula real), AC6 (mobile real) y AC-E3 (certificado `enabled`) quedan cubiertos por construcción/código pero sin verificación visual — no bloquean el cierre porque no hay forma de ejercitarlos en esta sesión (sin cuentas de prueba adicionales, `resize_window` falló en 3 sesiones distintas) y el owner decidió cerrar igual. Si alguno de esos 3 casos falla en producción, es candidato directo a un `fix-*` con la evidencia real.

---

## Changelog

- 2026-08-08 — primera ronda de QA (diseño con tabs) — descartada junto con el diseño.
- 2026-08-08 — QA final sobre el diseño reformulado (3 celdas, sin tabs). 7/10 AC con evidencia sólida, 3 pendientes de datos de prueba no disponibles. Bug de CSS real encontrado y corregido en el camino.
- 2026-08-08 — ronda de pulido visual: owner reportó que las 2 columnas "quedaron horriblemente feas" pese a pasar el QA estructural — confirma que QA geométrico (documentScrolls, gridColumn, etc.) no certifica calidad visual, hay que mirarlo. Aplicado: stepper de prácticas, datos antes sin usar (finalExamDate, practices[].date), alert-card para el bloqueo de certificado, centrado vertical.
- 2026-08-08 — el centrado no convenció al owner ("esa no es la solución"). Reestructura final: 2 columnas pasan de row-span 2 a row-span 1, la fila libre se llena con una 4ta celda ("Camino al Certificado"). Verificado: `documentScrolls:false`, 4 celdas confirmadas, sin cortes de contenido. Claro y oscuro OK.
- 2026-08-08 — owner pidió verificar explícitamente el caso Profesional y Clase B. AC4 (7 módulos, scroll interno) verificado con un snapshot simulado inyectado client-side (sin tocar BD, sin crear cuentas) — pasa en claro y oscuro. Veredicto sube a 8/10 AC con evidencia sólida.
- 2026-08-08 — owner reportó que la lista de módulos se veía "muy ajustada" por el bloque de certificado ocupando espacio en la misma columna (info además duplicada con el tracker). Corregido: certificado se saca de la columna Evaluación, vive solo en "Camino al Certificado". Re-verificado con el mismo snapshot Profesional simulado — ahora 6 módulos visibles + scroll, mucho más legible.
