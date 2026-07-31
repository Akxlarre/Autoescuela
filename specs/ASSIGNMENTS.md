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
| ASG-b-001 | Fase 5 QA visual restante: skeletons en carga real, capturas claro/oscuro/mobile de páginas sin cobertura, regla 3-2-1 de marca | `b` | fix | Media | b | Iteraciones 19-21 de `indices/FLOWS-QA-AUDIT.md` (Fase 5) — bloqueadas por indisponibilidad temporal del clasificador de Playwright, requieren navegador |
| ASG-b-005 | Cobertura `data-llm-*` — lote 2: terminar `hero-tab` (19 elementos restantes) + Config Web resto + Admin varios + Auth + Dashboard + Instructor (7 archivos) | `i` | fix | Baja | b | Ver lista exacta en `indices/FLOWS-QA-AUDIT.md` Fase 5.9. No se superpone con ASG-b-004/006/007 |
| ASG-b-007 | Cobertura `data-llm-*` — lote 4: shared/components parte 2 (9 archivos) | `i` | fix | Baja | b | Ver lista exacta en `indices/FLOWS-QA-AUDIT.md` Fase 5.9. No se superpone con ASG-b-004/005/006 |
| ASG-b-014 | Fix H-025 + H-012: Certificado Clase B se puede emitir sin validar 12 prácticas completadas (server-side) + falta indicador visual de que el criterio "elegible" difiere entre admin y secretaría | `i` | fix | Alta | b | Archivo principal: `supabase/functions/generate-certificate-b-pdf/index.ts` (agregar gate real) + UI de `admin/certificacion` |
| ASG-b-016 | Fix H-029: precio del curso Profesional A2 muestra $180.000 en vez de $800.000 del seed | `i` | fix | Alta | b | Error de cobro real — 4.4× menos de lo que corresponde por matrícula. Investigar de dónde toma el precio el wizard de matrícula Profesional |
| ASG-b-022 | Fix H-007: páginas cargan en blanco varios segundos sin skeleton en Agenda y Libro de Clases | `b` | fix | Media | b | Viola `swr-pattern.md`. ⚠️ **Coordinar con ASG-b-001** (verificación de skeletons de Benja) para no duplicar trabajo |
| ASG-b-034 | Terminar migración de `color-mix()` pendiente: 11 archivos con drift post-mayo (mismo patrón que ya resolvía el script) + 56 archivos con gap de diseño (CSS embebido / bindings dinámicos que el script nunca cubrió) | `b` | fix | Baja | b | Ver `scripts/migrate-color-mix-t4.mjs` (corrió una sola vez el 28-may, commit `673c4bd`). Requiere decisión sobre si `color-mix(var(--token))` embebido es deuda o válido por diseño |
| ASG-b-024 | Fix H-031: la búsqueda global (Ctrl+K) no indexa alumnos ni instructores, solo navegación | `b` | fix | Media | b | Extender el índice del buscador a datos de negocio (alumnos por nombre/RUT, instructores) |
| ASG-b-028 | Fix H-010 + H-014 + H-018: Agenda muestra "Todos los instructores" pero carga uno específico, texto RBAC "solo visible para admin" se muestra a secretaria, chips "P" ambiguos en asistencia | `i` | fix | Baja | b | 3 fixes cosméticos pequeños y no relacionados entre sí — buen paquete para alguien con poco tiempo |
| ASG-b-029 | Fix H-022 + H-030: vista previa del contrato no coincide con el PDF real (fecha vacía) + mismo texto genérico para Clase B y Profesional | `i` | fix | Baja | b | Mismo módulo (generación de contrato). El PDF real ya está bien — el problema es el HTML de preview + falta de contenido específico para Profesional |

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
| ASG-b-036 | 🔴 Ciclo de vida de la clase: exclusión mutua, cierre automático y aviso | `i` | spec | **Alta** | b | **BLOQUEADA.** Hallazgo verificado: `startClass()` no valida nada y una clase `in_progress` **nunca se cierra sola** (el cron solo toca `scheduled`). Agrupa 4 anotaciones. ⚠️ Solapa con ASG-b-010 |
| ASG-b-037 | 🔴 Cuadratura editable + egresos de combustible por vehículo | `i` | spec | Media | b | **BLOQUEADA.** `cuadratura.facade.ts:289` clava los egresos a `today` y guarda snapshot. La cuadratura es un **arqueo físico**: sobrescribirla borra la evidencia del descuadre |
| ASG-b-038 | 🔴 Matrícula de refuerzo (6 clases) sin romper el modelo de Clase B | `cualquiera` | spec | Media | b | **BLOQUEADA.** Choca con `CHECK (class_number BETWEEN 1 AND 12)` y el gate del certificado. ⚠️ Coordinar con ASG-b-014 |
| ASG-b-043 | Drawers muestran datos de todas las sedes en vez de una | `m` | fix | Media | b | **La auditoría de cuáles drawers es parte de la tarea.** Reusar `resolveBranchScope()` de fix-027, no escribir uno nuevo. Ojo con la regresión inversa (fix-002-b) |
| ASG-b-040 | Razones de reagendamiento (enum + "otro") | `i` | fix | Media | b | Reagendar recicla la fila in-place → no hay dónde guardar la razón. Recomendado: tabla de historial. Falta la lista de razones (pregunta liviana, no bloquea) |
| ASG-b-044 | Alerta a secretaría cuando un instructor cierra una clase | `m` | fix | Baja | b | Extender `notify_class_b_completed()`, que ya notifica al alumno. ⚠️ Coordinar con ASG-b-036 (¿el cierre automático también alerta?) |
| ASG-b-045 | Imprimir lista de alumnos (réplica del libro de Registro de Alumnos) | `m` | fix | Baja | b | Pedir foto del libro físico antes de diseñar el formato — puede estar reglamentado. ⚠️ Solapa con ASG-b-049 |
| ASG-b-046 | Integración con Zoom API para clases teóricas Profesional | `cualquiera` | spec | Baja | b | **Ya se difirió una vez** en spec 0027 ("fork de `pg_net` sin precedente"). Leer ese cierre antes de rediseñar. Recomendado: Edge Function, no `pg_net` |
| ASG-b-048 | Secretaría no debe ver calificación ni aspectos a evaluar en Iniciar Clase | `cualquiera` | fix | Baja | b | ⚠️ Ocultar en UI **no** lo esconde de la API (la policy entrega la fila completa). Decidirlo a conciencia. Solapa con ASG-b-036 |
| ASG-b-049 | El número de matrícula debe ser más principal que el nombre del alumno | `cualquiera` | fix | Baja | b | Usar `.kpi-value`/`.kpi-label`, no tamaños ad-hoc. ⚠️ Solapa con ASG-b-024 (el buscador debe encontrar por número) y ASG-b-045 |
| ASG-b-050 | Poder borrar (¿o anular?) Servicios Especiales | `cualquiera` | fix | Baja | b | La policy DELETE **ya existe** — falta el botón. ⚠️ Pero es una **venta** con `paid`: recomendado anular si está pagada. Mismo criterio que ASG-b-037 |
| ASG-b-051 | Poder cambiar el código de autorización del libro de clases | `cualquiera` | fix | Baja | b | `class_book.sence_code` ya existe. **Confirmar que es ese el código** antes de estimar. ¿Se puede cambiar con el libro ya cerrado? |

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
| ASG-b-043 | Drawers muestran datos de todas las sedes en vez de una | [fix-090-m-drawers-scope-sede](fixes/fix-090-m-drawers-scope-sede/fix.md) | 2026-07-30 |
| ASG-b-003 | Fix H-040: Realtime sin limpiar + polling prohibido en Dashboard | [fix-004-i-realtime-sin-dispose-dashboard-polling](fixes/fix-004-i-realtime-sin-dispose-dashboard-polling/fix.md) | 2026-07-30 |
| ASG-b-021 | Fix H-006: Configuración Web usa voseo argentino | [fix-002-i-voseo-configuracion-web](fixes/fix-002-i-voseo-configuracion-web/fix.md) | 2026-07-30 |
| ASG-b-025 | Fix H-037: botones y títulos recortados a mitad de palabra | [fix-003-i-textos-recortados-flex-truncate](fixes/fix-003-i-textos-recortados-flex-truncate/fix.md) | 2026-07-30 |
| ASG-b-027 | Fix H-003: Ex-Alumnos B — conteo de egresados discrepante (2 vs 16) | [fix-005-i-exalumnos-egresados-discrepancia](fixes/fix-005-i-exalumnos-egresados-discrepancia/fix.md) | 2026-07-30 |
| ASG-b-039 | Botón "Registrar egreso" accesible + atajo para carga de combustible | [fix-006-i-registrar-egreso-dashboard-boton](fixes/fix-006-i-registrar-egreso-dashboard-boton/fix.md) | 2026-07-30 |
| ASG-b-040 | Razones de reagendamiento (enum + "otro") | [fix-008-i-razones-reagendamiento](fixes/fix-008-i-razones-reagendamiento/fix.md) | 2026-07-31 |
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
