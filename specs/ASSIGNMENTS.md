# Asignaciones de Equipo — Autoescuela

> Tablero vivo de tareas designadas a integrantes del equipo, **antes** de que exista
> una spec/fix/hotfix. Una Asignación no es un track — es el paso previo: alguien
> declara "esto hay que hacer, se lo asigno a X (o a quien lo tome primero)", y quien
> la reclama genera su propio track con `/assign-claim`, con contexto pre-cargado.
>
> Ciclo: `/assign-new` → esta tabla ("Pendientes") → `/assign-list` (cada dev ve lo
> suyo) → `/assign-claim` (genera spec/fix/hotfix real, con SU código de autor) →
> flujo SDD normal desde ahí.
>
> ⚠️ **Multi-rama**: si cada persona trabaja en su propia rama, este archivo puede
> quedar desactualizado entre ramas. Commiteá y pusheá los cambios acá **de inmediato**
> (antes de armar tu rama de feature) para que el resto del equipo vea la reclamación
> a tiempo. Ver sección "Conflictos entre ramas" al final.

---

## Pendientes

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|

### Tanda reunión con el cliente — 2026-07-28

> 27 anotaciones crudas de la reunión, validadas una por una antes de entrar acá. 17 se
> volvieron asignación, 3 se absorbieron en asignaciones existentes (R18→ASG-b-024,
> R25→ASG-b-010, R26→ASG-b-001) y el resto se agrupó por nudo para no repetir la misma
> conversación con el cliente en tres tracks distintos.
>
> **🔴 BLOQUEADA = no se puede ni estimar sin respuesta del cliente.** Cada una lleva las
> preguntas ya redactadas en su sección "Preguntas abiertas" — llevarlas a la reunión tal
> como están, no reformularlas de memoria.

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|
| ASG-b-037 | Cuadratura editable + egresos de combustible por vehículo | `i` | spec | Media | b | **2026-08-02: desbloqueada.** Cliente confirmó: ajuste posterior con motivo (cuadratura cerrada queda inmutable, editar = registrar ajuste con monto/motivo/autor). `cuadratura.facade.ts:289` clava los egresos a `today` y guarda snapshot. Ver `specs/assignments/ASG-b-037-*.md` |
| ASG-b-038 | Matrícula de refuerzo (6 clases) sin romper el modelo de Clase B | `m` | spec | Media | b | **2026-08-02: desbloqueada.** Cliente confirmó: otro producto/curso propio en `courses`, no toca el modelo de 12 prácticas de Clase B. Preguntas 2-4 (certificado, elegibilidad externos, precio) siguen abiertas pero no bloquean el diseño. ⚠️ Coordinar con ASG-b-014. Ver `specs/assignments/ASG-b-038-*.md` |
| ASG-b-045 | Imprimir lista de alumnos (réplica del libro de Registro de Alumnos) | `m` | fix | Baja | b | Pedir foto del libro físico antes de diseñar el formato — puede estar reglamentado. ⚠️ Solapa con ASG-b-049 |
| ASG-b-046 | Integración con Zoom API para clases teóricas Profesional | `b` | spec | Baja | b | **Ya se difirió una vez** en spec 0027 ("fork de `pg_net` sin precedente"). Leer ese cierre antes de rediseñar. Recomendado: Edge Function, no `pg_net` |
| ASG-b-049 | El número de matrícula debe ser más principal que el nombre del alumno | `b` | fix | Baja | b | Usar `.kpi-value`/`.kpi-label`, no tamaños ad-hoc. ⚠️ Solapa con ASG-b-024 (el buscador debe encontrar por número) y ASG-b-045 |
| ASG-b-050 | Poder borrar (¿o anular?) Servicios Especiales | `i` | fix | Baja | b | La policy DELETE **ya existe** — falta el botón. ⚠️ Pero es una **venta** con `paid`: recomendado anular si está pagada. Mismo criterio que ASG-b-037 |

### Tanda auditoría "peor cliente posible" — 2026-08-03

> Evaluación de qué tan resiliente es la orquestación/arquitectura ante un usuario que
> consulta/opera de la peor forma posible (doble submit, dos pestañas, cambios rápidos de
> filtro/sede). Dos hallazgos concretos, distintos en severidad: uno es plata (pierde saldo
> de alumno), el otro es UX (dato viejo un instante en pantalla).

### Tanda rollout App-like — 2026-08-03

> Primeras 5 piezas del rollout del patrón app-like (fill-screen desktop / scroll móvil) a los 4
> portales, auditado completo en `indices/APP-LIKE-ROLLOUT.md` (45 páginas candidatas, orden de
> rollout al final del documento). Estresado con `/grill_me` — 9 edge cases resueltos, ver sección
> "Edge cases estresados" del mismo documento (checklist aplicable a TODAS las piezas: verificar
> `force-compact` con drawer abierto, tests obligatorios para lógica de densidad nueva, verificar
> TODAS las rutas consumidoras si el componente es `shared`, `/verify` también en 768px de alto).
>
> **Rollout completo cubierto (2026-08-03):** ASG-b-065 a ASG-b-086 (22 asignaciones) cubren los
> 17 pasos del orden de rollout de punta a punta. Reclamar en el orden numérico salvo indicación
> contraria explícita en la asignación (ej. ASG-b-084 debe ir ANTES que ASG-b-085 a propósito).
> Las marcadas `spec` (080, 082, 083, 085, 086) necesitan diseño previo, no son mecánicas — leer
> su "Contexto/Objetivo" completo antes de estimar.
>
> **2026-08-04: repartidas entre los 3 devs** (junto con ASG-b-063/064/089/090 de las otras
> tandas), por dominio/solape para no repetir contexto entre personas y balanceando carga
> estimada (peso Alta=3/Media=2/Baja=1): **`m`** (~18) — resiliencia de Facades (063/064,
> tocan `pagos.facade.ts`) + familia pagos (076, mismo archivo) + Clase Profesional
> (080 matriz de notas + 081 archivo) + fillers bajos (069, 072, 090). **`b`** (~17) — dominio
> instructor (066/070/078) + documentos (071) + flota (067/077, ambas tocan
> `flota/mantenimientos`) + portal alumno (079/083) + fillers (065, 089). **`i`** (~17.5) —
> contabilidad (074/075/082, mismo módulo) + el par secuencial obligatorio 084→085 + libro de
> clases (086, mismo patrón de tabs que 084/085) + fillers (068, 073). Reasignar solo si alguien
> queda bloqueado — no reordenar sin avisar al resto por el solape ya armado.

| ASG-b-065 | App-like: `/secretaria/dashboard` — portar `--fill-screen-2` desde admin/dashboard | `b` | fix | Baja | b | 4 cambios reales (no 1 línea): shell, `bento-fill` en live-classes-panel, densidad adaptativa de Actividad/Alertas. Ver `specs/assignments/ASG-b-065-*.md` |
| ASG-b-066 | App-like: familia "instructores" (`admin` + `secretaria`) | `b` | fix | Baja | b | Sacar paginación Anterior/Siguiente hand-rolled → patrón `sliceByBudget`+"Cargar más" mobile / todo+scroll desktop, copiado de `alumnos-list-content`. Mismo cambio en 2 archivos independientes. Ver `specs/assignments/ASG-b-066-*.md` |
| ASG-b-067 | App-like: `/admin/flota` (`flota-list-content`) | `b` | fix | Baja | b | `p-table` MANTIENE el paginador nativo (a diferencia de instructores) — agregar `scrollable`+`scrollHeight=flex`, patrón ya probado en 6 páginas hermanas. Ver `specs/assignments/ASG-b-067-*.md` |
| ASG-b-069 | App-like: `/admin/auditoria` | `m` | fix | Baja | b | Paginador es SERVER-SIDE, no se saca. Banner informativo se pliega dentro de la card como footer fijo. Ver `specs/assignments/ASG-b-069-*.md` |
| ASG-b-070 | App-like: familia "horario" (`instructor` + `alumno`) | `b` | fix | Baja-Media | b | Ninguna de las 2 usa `agenda-semanal`. `alumno/horario` necesita agrupar celdas condicionales. Ver `specs/assignments/ASG-b-070-*.md` |
| ASG-b-071 | App-like: familia "documentos" (`admin` + `secretaria`, `dms-list-content`) | `b` | fix | Media | b | Tiene `h-125` hardcodeado que hay que sacar primero. Componente `shared` — verificar ambas rutas. Ver `specs/assignments/ASG-b-071-*.md` |
| ASG-b-072 | App-like: `/admin/configuracion-web` + `/secretaria/configuracion-web` | `m` | fix | Media | b | 6 tabs ya existentes (no 5), cada una su propio componente — verificar los 6 antes de aplicar el shell. Ver `specs/assignments/ASG-b-072-*.md` |
| ASG-b-073 | App-like: familia "servicios especiales" (`admin` + `secretaria`) | `i` | fix | Media | b | 2 `.bento-banner` apiladas (no 2 columnas), sin paginación que sacar. Ver `specs/assignments/ASG-b-073-*.md` |
| ASG-b-074 | App-like: `/admin/contabilidad/liquidaciones` + `/secretaria/...` | `i` | fix | Baja-Media | b | `--fill-screen-kpi`, sin paginación que sacar. Ver `specs/assignments/ASG-b-074-*.md` |
| ASG-b-075 | App-like: `/admin/contabilidad/historial-cuadraturas` + `/secretaria/...` | `i` | fix | Baja | b | Calendario mensual acotado, `--fill-screen-kpi`. Ver `specs/assignments/ASG-b-075-*.md` |
| ASG-b-076 | App-like: familia "pagos" (`admin` + `secretaria`) | `m` | fix | Alta | b | Alto tráfico. NO usar tabs (decisión ya tomada). 3 bloques apilados, no 2 tablas. 4 sets de tests de densidad. Ver `specs/assignments/ASG-b-076-*.md` |
| ASG-b-077 | App-like: piezas sueltas (`flota/mantenimientos`, `contabilidad/cursos`, `contabilidad/anticipos`) | `b` | fix | Baja-Media | b | 3 páginas sin relación, se pueden reclamar por separado. Ver `specs/assignments/ASG-b-077-*.md` |
| ASG-b-078 | App-like: portal instructor resto (`dashboard`, `alumnos`, `liquidacion`, `ensayos-teoricos`, `notificaciones`) | `b` | fix | Media | b | 5 páginas independientes. Solo `alumnos` necesita tests de densidad nuevos. Ver `specs/assignments/ASG-b-078-*.md` |
| ASG-b-079 | App-like: portal alumno (`clases`, `pagos`, `pruebas-online`, `pagar`) | `b` | fix | Media | b | Mobile-first, prioridad menor. `pagar` puede quedar exenta si su contenido nunca desborda. Ver `specs/assignments/ASG-b-079-*.md` |
| ASG-b-080 | App-like: matriz de notas (`admin/clase-profesional/evaluaciones` + `secretaria/profesional/notas`) | `m` | spec | Alta | b | Modo dual landing/grilla no mapeado en detalle. Necesita diseño previo, no es mecánica. Ver `specs/assignments/ASG-b-080-*.md` |
| ASG-b-081 | App-like: `/admin/clase-profesional/archivo` + `/secretaria/profesional/archivo` | `m` | fix | Media | b | Más simple que la matriz de notas — sin modo dual. `sticky-col` ya existe, no romperlo. Ver `specs/assignments/ASG-b-081-*.md` |
| ASG-b-082 | App-like: familia "reportes contables" + "cuadratura" (`admin` + `secretaria`) | `i` | spec | Alta | b | 7 secciones (reportes) + CSS custom con contador táctil (cuadratura). Necesita diseño previo. Ver `specs/assignments/ASG-b-082-*.md` |
| ASG-b-083 | App-like: `/alumno/dashboard` | `b` | spec | Alta | b | ~9 celdas condicionales, no mapeadas en detalle. Base de 2 columnas ya confirmada, resto necesita diseño. Ver `specs/assignments/ASG-b-083-*.md` |
| ASG-b-084 | App-like: `/instructor/alumnos/:id/ficha` (piloto del patrón de tabs) | `i` | fix | Media | b | Va ANTES de ASG-b-085 a propósito — piloto de bajo riesgo para validar el patrón de tabs. Ver `specs/assignments/ASG-b-084-*.md` |
| ASG-b-085 | App-like: `/admin/alumnos/:id` + `/secretaria/alumnos/:id` (⚠️ la más grande y riesgosa del rollout) | `i` | spec | Alta | b | 1654 líneas, máximo tráfico. No reclamar sin haber hecho ASG-b-084 antes. QA visual exhaustivo obligatorio. Ver `specs/assignments/ASG-b-085-*.md` |
| ASG-b-086 | App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases` | `i` | spec | Alta | b | 7 secciones secuenciales. Resolver junto con el bug de skeleton gap (fix-074) en el mismo track. Ver `specs/assignments/ASG-b-086-*.md` |

### Tanda auditoría fresca del DS — 2026-08-03

> Auditoría completa del Design System más allá de `lint:arch` (`indices/DS-AUDIT-2026-08-03.md`,
> hallazgos H1-H10). H3/H5/H10 ya se corrigieron directo (fix-110-b/111-b/112-b). Quedan estos 2
> como ASG por su tamaño — el resto de los hallazgos (H4/H6/H7/H8/H9) sigue solo documentado en
> el informe, sin ASG todavía.
>
> ⚠️ **Numeración:** la rama `claude/exciting-curie-2bdfdd` ya pusheó `ASG-b-087`/`ASG-b-088`
> (investigación de listas grandes/virtual scroll) — no reutilizar esos números. Estas 2 arrancan
> en `ASG-b-089`.

| ASG-b-089 | Facade inyectado directamente en 7 Dumb Components (`shared/components/**`) | `b` | fix | Media | b | Rompe la separación Smart/Dumb. Sin solución mecánica única — cada componente necesita su propio análisis (empezar por `logo.component.ts`, el más simple). Ver `specs/assignments/ASG-b-089-*.md` |
| ASG-b-090 | 5 paletas de color duplicadas/hardcodeadas en ~12 archivos (`SPEC_COLORS`, `COURSE_COLORS`, avatares, `INCOME_COLORS`, liquidaciones) | `m` | fix | Media | b | El mismo set de hex vive copiado en 3-4 archivos sueltos — garantiza drift si alguien cambia uno sin saber de las copias. Divisible por cluster. Ver `specs/assignments/ASG-b-090-*.md` |

### Tanda auditoría del Design System — 2026-07-31

> Revisión del DS completo (tokens, guardrails, vocabulario, a11y, doc) contrastando
> `indices/STYLES.md` + `ANTI-PATTERNS.md` + los dos audits contra el código real.
>
> **Diagnóstico de fondo:** el DS es fuerte donde la mayoría son débiles (4 capas de
> tokens + 8 guardrails AST con ratchet) y débil donde la mayoría son fuertes
> (vocabulario de componentes y accesibilidad). Las 6 asignaciones atacan esa asimetría.
>
> **Orden recomendado:** `056` primero (es barata y el resto construye sobre esa doc),
> después `053` y `054` en paralelo, `055` y `058` cuando haya hueco, `057` solo si el
> equipo decide pagar el refactor.

> ✅ **Tanda completa (2026-07-31)** — las 6 asignaciones (053-058) reclamadas y
> cerradas. Ver sección "Completadas" más abajo para los tracks resultantes.

---

## Reclamadas / En curso

> Generado automáticamente por `npm run assignments:sync` desde el frontmatter de
> `specs/assignments/ASG-X-NNN-*.md`. No editar a mano — se sobrescribe en el próximo sync.

<!-- AUTO-GENERATED:BEGIN -->
| ID | Título | Reclamado por | Track resultante | Fecha |
|----|--------|----------------|-------------------|-------|
| ASG-b-035 | Promociones automáticas: cadencia, convalidaciones y matrícula tardía | `m` | [0002-m-promociones-cadencia-automatica](specs/0002-m-promociones-cadencia-automatica/spec.md) | 2026-07-28 |
<!-- AUTO-GENERATED:END -->

---

## Completadas

> Generado automáticamente por `npm run assignments:sync` desde el frontmatter de
> `specs/assignments/ASG-X-NNN-*.md` (cruzado con el `> closed:` del track resultante).
> No editar a mano — se sobrescribe en el próximo sync.

<!-- AUTO-GENERATED:BEGIN -->
| ID | Título | Track resultante | Cerrada |
|----|--------|-------------------|---------|
| ASG-b-002 | Fix H-039: alumno con 2+ matrículas no puede pagar su saldo real | [fix-058-b-pago-multiples-matriculas](fixes/fix-058-b-pago-multiples-matriculas/fix.md) | 2026-07-23 |
| ASG-b-009 | Fix H-013: Reportes Contables no cuenta pagos reales (descuadre financiero) | [fix-056-b-reportes-contables-branch-id](fixes/fix-056-b-reportes-contables-branch-id/fix.md) | 2026-07-23 |
| ASG-b-011 | Fix H-028: RLS bloquea a la secretaria en matrícula Profesional (403) | [fix-054-m-h028-rls-secretaria-documentos-profesional](fixes/fix-054-m-h028-rls-secretaria-documentos-profesional/fix.md) | 2026-07-23 |
| ASG-b-013 | Fix H-024: Registrar Pago con monto excesivo falla en silencio | [fix-057-m-registrar-pago-monto-excesivo-silencioso](fixes/fix-057-m-registrar-pago-monto-excesivo-silencioso/fix.md) | 2026-07-23 |
| ASG-b-015 | Fix H-027: 500 real en alertas de asistencia Profesional con filtro de sede | [fix-060-m-h027-alertas-asistencia-profesional-sede](fixes/fix-060-m-h027-alertas-asistencia-profesional-sede/fix.md) | 2026-07-23 |
| ASG-b-023 | Decisión de producto + fix H-021: límite de clases/día distinto público vs interno | [fix-062-m-unificar-limite-clases-dia](fixes/fix-062-m-unificar-limite-clases-dia/fix.md) | 2026-07-25 |
| ASG-b-026 | Fix H-026: la sede activa no persiste tras F5 | [fix-068-m-branch-persistencia-localstorage](fixes/fix-068-m-branch-persistencia-localstorage/fix.md) | 2026-07-26 |
| ASG-b-019 | Fix H-038: "Clases activas" de Instructores siempre muestra 0 | [fix-072-m-instructores-clases-activas-count](fixes/fix-072-m-instructores-clases-activas-count/fix.md) | 2026-07-27 |
| ASG-b-020 | Fix H-004 + H-005: formato financiero (enum crudo + separador de miles) | [fix-070-m-formato-financiero-anticipos-reportes](fixes/fix-070-m-formato-financiero-anticipos-reportes/fix.md) | 2026-07-27 |
| ASG-b-004 | Cobertura data-llm-* — Lote 1: Admin Flota + Documentos + Certificados | [fix-088-m-data-llm-lote-1-flota-documentos](fixes/fix-088-m-data-llm-lote-1-flota-documentos/fix.md) | 2026-07-28 |
| ASG-b-006 | Cobertura data-llm-* — Lote 3: shared/components parte 1 | [fix-087-m-data-llm-lote-3-shared-parte-1](fixes/fix-087-m-data-llm-lote-3-shared-parte-1/fix.md) | 2026-07-28 |
| ASG-b-008 | Decisión de diseño: modificador btn-sm + aplicar a 3 archivos ARCH-16 | [fix-086-m-btn-sm-arch16-restante](fixes/fix-086-m-btn-sm-arch16-restante/fix.md) | 2026-07-28 |
| ASG-b-017 | Fix H-035 + H-017: Portal Alumno nunca muestra la nota del Examen Final | [fix-059-b-nota-examen-final](fixes/fix-059-b-nota-examen-final/fix.md) | 2026-07-28 |
| ASG-b-018 | Fix H-001 + H-002 + H-008: Dashboard admin — KPIs y estados | [fix-063-b-dashboard-kpis-estados](fixes/fix-063-b-dashboard-kpis-estados/fix.md) | 2026-07-28 |
| ASG-b-030 | Fix H-023: Caja Diaria muestra glosa cruda del pago | [fix-062-b-glosa-cruda-cuadratura](fixes/fix-062-b-glosa-cruda-cuadratura/fix.md) | 2026-07-28 |
| ASG-b-031 | Fix H-032: campo Contraseña visible en "Recuperar Contraseña" | [fix-061-b-password-field-inert-reset-mode](fixes/fix-061-b-password-field-inert-reset-mode/fix.md) | 2026-07-28 |
| ASG-b-032 | Fix H-036: flash de texto incorrecto en Pagos de alumno Clase B | [fix-060-b-flash-texto-pagos-clase-b](fixes/fix-060-b-flash-texto-pagos-clase-b/fix.md) | 2026-07-28 |
| ASG-b-010 | Fix H-016: Portal Instructor corre sobre datos MOCK | [fix-001-i-portal-instructor-datos-mock](fixes/fix-001-i-portal-instructor-datos-mock/fix.md) | 2026-07-29 |
| ASG-b-012 | Matrícula pública: overlay, landing sin sede, retry roto, storage huérfano | [fix-069-b-matricula-publica-varios](fixes/fix-069-b-matricula-publica-varios/fix.md) | 2026-07-29 |
| ASG-b-033 | Portal alumno no muestra matrículas múltiples | [0034-b-portal-alumno-matriculas-multiples](specs/0034-b-portal-alumno-matriculas-multiples/spec.md) | 2026-07-29 |
| ASG-b-041 | Fecha de obtención de licencia B + advertencia de los 2 años (Profesional) | [fix-089-m-licencia-b-dos-anos-profesional](fixes/fix-089-m-licencia-b-dos-anos-profesional/fix.md) | 2026-07-29 |
| ASG-b-042 | Repositorio de documentos: sección Instructores + poder abrir el archivo | [0003-m-repositorio-documentos-instructores](specs/0003-m-repositorio-documentos-instructores/spec.md) | 2026-07-29 |
| ASG-b-047 | Dígito verificador del RUT automático en Matrícula | [fix-064-b-rut-dv-automatico](fixes/fix-064-b-rut-dv-automatico/fix.md) | 2026-07-29 |
| ASG-b-052 | Firma del contrato no se persiste en el draft de matrícula pública | [fix-070-b-firma-contrato-no-persistida-draft](fixes/fix-070-b-firma-contrato-no-persistida-draft/fix.md) | 2026-07-29 |
| ASG-b-003 | Fix H-040: Realtime sin limpiar + polling prohibido en Dashboard | [fix-004-i-realtime-sin-dispose-dashboard-polling](fixes/fix-004-i-realtime-sin-dispose-dashboard-polling/fix.md) | 2026-07-30 |
| ASG-b-021 | Fix H-006: Configuración Web usa voseo argentino | [fix-002-i-voseo-configuracion-web](fixes/fix-002-i-voseo-configuracion-web/fix.md) | 2026-07-30 |
| ASG-b-025 | Fix H-037: botones y títulos recortados a mitad de palabra | [fix-003-i-textos-recortados-flex-truncate](fixes/fix-003-i-textos-recortados-flex-truncate/fix.md) | 2026-07-30 |
| ASG-b-027 | Fix H-003: Ex-Alumnos B — conteo de egresados discrepante (2 vs 16) | [fix-005-i-exalumnos-egresados-discrepancia](fixes/fix-005-i-exalumnos-egresados-discrepancia/fix.md) | 2026-07-30 |
| ASG-b-039 | Botón "Registrar egreso" accesible + atajo para carga de combustible | [fix-006-i-registrar-egreso-dashboard-boton](fixes/fix-006-i-registrar-egreso-dashboard-boton/fix.md) | 2026-07-30 |
| ASG-b-043 | Drawers muestran datos de todas las sedes en vez de una | [fix-090-m-drawers-scope-sede](fixes/fix-090-m-drawers-scope-sede/fix.md) | 2026-07-30 |
| ASG-b-001 | Fase 5 QA visual restante: skeletons, capturas, regla 3-2-1 | [fix-071-b-fase-5-qa-visual-restante](fixes/fix-071-b-fase-5-qa-visual-restante/fix.md) | 2026-07-31 |
| ASG-b-022 | Fix H-007: skeletons faltantes en Agenda y Libro de Clases | [fix-074-b-skeletons-agenda-libro-clases](fixes/fix-074-b-skeletons-agenda-libro-clases/fix.md) | 2026-07-31 |
| ASG-b-024 | Fix H-031: buscador global (Ctrl+K) no indexa alumnos ni instructores | [fix-075-b-buscador-global-datos-negocio](fixes/fix-075-b-buscador-global-datos-negocio/fix.md) | 2026-07-31 |
| ASG-b-034 | Terminar la migración de `color-mix()` pendiente | [fix-076-b-color-mix-drift-y-criterio](fixes/fix-076-b-color-mix-drift-y-criterio/fix.md) | 2026-07-31 |
| ASG-b-040 | Razones de reagendamiento (enum + "otro") | [fix-008-i-razones-reagendamiento](fixes/fix-008-i-razones-reagendamiento/fix.md) | 2026-07-31 |
| ASG-b-053 | Vocabulario tipográfico: promover los clusters repetidos a clases del DS | [fix-078-b-vocabulario-tipografico-ds](fixes/fix-078-b-vocabulario-tipografico-ds/fix.md) | 2026-07-31 |
| ASG-b-054 | Accesibilidad: 94 botones sin nombre accesible + foco en menús + primer guardrail a11y | [fix-079-b-accesibilidad-nombres-y-foco](fixes/fix-079-b-accesibilidad-nombres-y-foco/fix.md) | 2026-07-31 |
| ASG-b-055 | Escala tipográfica: eliminar los tamaños ilegibles y cerrar el ratchet ARCH-17 | [fix-082-b-escala-tipografica-legible](fixes/fix-082-b-escala-tipografica-legible/fix.md) | 2026-07-31 |
| ASG-b-056 | Alinear las fuentes de verdad del DS (la doc contradice al código) | [fix-077-b-alinear-fuentes-verdad-ds](fixes/fix-077-b-alinear-fuentes-verdad-ds/fix.md) | 2026-07-31 |
| ASG-b-057 | Sprawl de la API pública del DS: 30+ clases bento y 9 variantes de botón | [fix-084-b-sprawl-api-ds-nivel1](fixes/fix-084-b-sprawl-api-ds-nivel1/fix.md) | 2026-07-31 |
| ASG-b-058 | Cerrar la fase 4 del roadmap de badges (los 4 residuos) | [fix-083-b-cerrar-fase-4-badges](fixes/fix-083-b-cerrar-fase-4-badges/fix.md) | 2026-07-31 |
| ASG-b-014 | Fix H-025 + H-012: certificado B sin validar 12 prácticas + falta indicador de criterio | [fix-011-i-certificado-clase-b-gate-validacion](fixes/fix-011-i-certificado-clase-b-gate-validacion/fix.md) | 2026-08-01 |
| ASG-b-016 | Fix H-029: precio Profesional A2 muestra $180.000 en vez de $800.000 | [fix-013-i-precio-profesional-a2-incorrecto](fixes/fix-013-i-precio-profesional-a2-incorrecto/fix.md) | 2026-08-01 |
| ASG-b-028 | 3 fixes cosméticos: label Agenda, texto RBAC, chips ambiguos | [fix-010-i-cosmeticos-agenda-rbac-chips](fixes/fix-010-i-cosmeticos-agenda-rbac-chips/fix.md) | 2026-08-01 |
| ASG-b-044 | Alerta a secretaría cuando un instructor cierra una clase | [fix-091-m-alerta-secretaria-cierre-clase](fixes/fix-091-m-alerta-secretaria-cierre-clase/fix.md) | 2026-08-01 |
| ASG-b-051 | Poder cambiar el código de autorización del libro de clases | [fix-098-m-codigo-autorizacion-libro-editable](fixes/fix-098-m-codigo-autorizacion-libro-editable/fix.md) | 2026-08-01 |
| ASG-b-059 | Botón "Recordar" del rail de alertas no envía nada (stub que miente) + UX de los botones de alerta | [fix-093-b-boton-recordar-alertas-asistencia-b](fixes/fix-093-b-boton-recordar-alertas-asistencia-b/fix.md) | 2026-08-01 |
| ASG-b-060 | El CTA de `ConfirmModalService` ignora `severity: 'danger'` y sale en azul de marca | [fix-094-b-confirm-modal-severity-cta](fixes/fix-094-b-confirm-modal-severity-cta/fix.md) | 2026-08-01 |
| ASG-b-061 | Área táctil de los botones del rail de alertas por debajo de 44×44px | [fix-095-b-area-tactil-rail-alertas](fixes/fix-095-b-area-tactil-rail-alertas/fix.md) | 2026-08-02 |
| ASG-b-062 | El ícono del modal de confirmación es `alert-triangle` incluso para `info`/`success`/`secondary` | [fix-096-b-icono-modal-confirmacion](fixes/fix-096-b-icono-modal-confirmacion/fix.md) | 2026-08-02 |
| ASG-b-029 | Fix H-022 + H-030: vista previa de contrato y contenido genérico | [fix-014-i-contrato-preview-generico](fixes/fix-014-i-contrato-preview-generico/fix.md) | 2026-08-04 |
| ASG-b-036 | Ciclo de vida de la clase: exclusión mutua, cierre automático y aviso | [0001-i-ciclo-vida-clase-exclusion-cierre](specs/0001-i-ciclo-vida-clase-exclusion-cierre/spec.md) | 2026-08-04 |
| ASG-b-005 | Cobertura data-llm-* — Lote 2: terminar hero-tab + Config Web resto + varios | [fix-015-i-cobertura-data-llm-lote-2](fixes/fix-015-i-cobertura-data-llm-lote-2/fix.md) | 2026-08-05 |
| ASG-b-007 | Cobertura data-llm-* — Lote 4: shared/components parte 2 | [fix-016-i-cobertura-data-llm-lote-4](fixes/fix-016-i-cobertura-data-llm-lote-4/fix.md) | 2026-08-05 |
| ASG-b-048 | Secretaría no debe ver calificación ni aspectos a evaluar en Iniciar Clase | [fix-115-m-ocultar-evaluacion-secretaria-admin](fixes/fix-115-m-ocultar-evaluacion-secretaria-admin/fix.md) | 2026-08-05 |
| ASG-b-063 | Race condition "lost update" en `pending_balance` al registrar pagos | [fix-114-m-race-condition-pending-balance-pagos](fixes/fix-114-m-race-condition-pending-balance-pagos/fix.md) | 2026-08-05 |
| ASG-b-064 | Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede | [0005-m-facades-respuestas-stale](specs/0005-m-facades-respuestas-stale/spec.md) | 2026-08-05 |
| ASG-b-068 | App-like: `/admin/secretarias` | [fix-017-i-app-like-admin-secretarias](fixes/fix-017-i-app-like-admin-secretarias/fix.md) | 2026-08-05 |
<!-- AUTO-GENERATED:END -->

---

## Convenciones

- **IDs:** `ASG-<autor>-NNN` (ej. `ASG-b-052`), 3 dígitos, contador **por autor** — igual que
  spec/fix/hotfix (ver `specs/AUTHORS.md`). Cada autor numera independiente: si Benjamín va en
  `ASG-b-051`, la primera de Matías es `ASG-m-001`, **no** `ASG-b-052`. Nunca se reutiliza.
  > Antes era un contador global. Se migró el 2026-07-29 porque dos personas en ramas distintas
  > sacaban el mismo `ASG-052` y, al mergear, git auto-resolvía sin conflicto dejando dos
  > asignaciones con el mismo ID — el mismo fallo silencioso que los tracks ya habían resuelto
  > en julio con el código de autor. Las 51 asignaciones previas (todas de `b`) se renombraron
  > conservando su número: `ASG-001` → `ASG-b-001`.
- **`Asignado a`:** código de autor de `specs/AUTHORS.md` (`m` Matías, `b` Benjamín, `i` Ignacio), o `cualquiera` si es un pool abierto para quien la tome primero.
- **`Tipo sugerido`:** `spec` (feature nueva) / `fix` (bug con AC afectados) / `hotfix` (fix urgente simple) — quien reclama puede cambiarlo con `--as=` si al leer el contexto no coincide.
- **Reclamar:** solo se puede reclamar una asignación con `Asignado a: cualquiera`, o una asignada específicamente a tu propio código de autor. Una vez `Reclamada`, nadie más puede tomarla.
- **Cerrar:** marcar como `Completada` es **manual** — se mueve la fila cuando el track resultante (spec/fix/hotfix) llega a `done`/se cierra. No se sincroniza automáticamente con `/spec-verify` ni `/fix-close`.
- **Archivos involucrados:** cada `ASG-X-NNN-*.md` tiene una sección opcional "Archivos involucrados". Si se completa, `/assign-claim` la usa para avisar (no bloquear) si te solapás con otra asignación ya reclamada que declaró los mismos archivos — señal de alerta, no enforcement duro.

### Conflictos entre ramas

`/assign-claim` ya hace un `git fetch` + comparación contra `origin/main` en automático antes de reclamar
(best-effort: si falla por falta de red/remoto, no bloquea). Si dos personas igual reclaman la misma
asignación en paralelo (ej. por no pushear a tiempo), no hay resolución automática más allá de ese aviso
— es coordinación humana: quien se entera después, cede y reclama otra. Para minimizar el riesgo:

1. Si `/assign-claim` te avisa que tu copia está atrás, haz `git pull` antes de continuar.
2. Al reclamar, commitea y pushea **solo ese cambio** (este archivo + el track nuevo) de inmediato, separado del resto de tu trabajo de feature.
