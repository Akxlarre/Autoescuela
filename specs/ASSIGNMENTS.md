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
| ASG-001 | Fase 5 QA visual restante: skeletons en carga real, capturas claro/oscuro/mobile de páginas sin cobertura, regla 3-2-1 de marca | `b` | fix | Media | b | Iteraciones 19-21 de `indices/FLOWS-QA-AUDIT.md` (Fase 5) — bloqueadas por indisponibilidad temporal del clasificador de Playwright, requieren navegador |
| ASG-003 | Fix H-040: 7 facades con canal Realtime que nunca se limpia + polling prohibido (`setInterval`) en `dashboard.facade.ts` | `i` | fix | Media | b | Ver `indices/FLOWS-QA-AUDIT.md` H-040. Archivos: `dashboard`/`admin-alumnos`/`admin-alumno-detalle`/`flota`/`pagos`/`liquidaciones`/`cuadratura` facades + sus Smart Components |
| ASG-004 | Cobertura `data-llm-*` — lote 1: Admin Flota + Documentos + Certificados (9 archivos) | `m` | fix | Baja | b | Ver lista exacta en `indices/FLOWS-QA-AUDIT.md` Fase 5.9. No se superpone con ASG-005/006/007 |
| ASG-005 | Cobertura `data-llm-*` — lote 2: terminar `hero-tab` (19 elementos restantes) + Config Web resto + Admin varios + Auth + Dashboard + Instructor (7 archivos) | `i` | fix | Baja | b | Ver lista exacta en `indices/FLOWS-QA-AUDIT.md` Fase 5.9. No se superpone con ASG-004/006/007 |
| ASG-006 | Cobertura `data-llm-*` — lote 3: shared/components parte 1 (8 archivos) | `m` | fix | Baja | b | Ver lista exacta en `indices/FLOWS-QA-AUDIT.md` Fase 5.9. No se superpone con ASG-004/005/007 |
| ASG-007 | Cobertura `data-llm-*` — lote 4: shared/components parte 2 (9 archivos) | `i` | fix | Baja | b | Ver lista exacta en `indices/FLOWS-QA-AUDIT.md` Fase 5.9. No se superpone con ASG-004/005/006 |
| ASG-008 | Decisión de diseño: modificador componible `btn-sm` en el DS + aplicar a los 3 archivos deferidos de ARCH-16 | `m` | spec | Baja | b | ~120 instancias del anti-patrón en todo el repo. Ver `docs/BACKLOG-DEUDA-TECNICA.md` línea 86-88 y `indices/FLOWS-QA-AUDIT.md` iteración 17 |
| ASG-010 | Fix H-016 (Crítica): Portal Instructor corre sobre datos MOCK (`useMock=true` hardcodeado) + agregar tests para la rama real | `i` | fix | **Crítica** | b | Archivo: `instructor-clases.facade.ts:53`. La rama real ya existe pero tiene 0% cobertura de tests — agregarlos ANTES de activar el flag, no después |
| ASG-012 | Fix H-020 + H-019 + H-033 + H-034: matrícula pública — overlay bloquea click en foto carnet, landing sin sede con links muertos, retry tras pago rechazado destruye la matrícula, fotos huérfanas en Storage | `b` | fix | Alta | b | Mismo módulo (wizard público de matrícula), 4 hallazgos relacionados. Archivos: `public-enrollment-retorno.component.ts:372-374`, `public-enrollment.facade.ts` (`clearDraft()`), componente de subida de foto carnet |
| ASG-013 | Fix H-024: "Registrar Pago" con monto mayor al saldo pendiente falla en silencio, sin feedback al usuario | `m` | fix | Alta | b | No corrompe datos (no hay INSERT), pero no avisa el fallo. Archivo: drawer de registrar pago (`admin/pagos` o `admin-pagos.component.ts` y su drawer) |
| ASG-014 | Fix H-025 + H-012: Certificado Clase B se puede emitir sin validar 12 prácticas completadas (server-side) + falta indicador visual de que el criterio "elegible" difiere entre admin y secretaría | `i` | fix | Alta | b | Archivo principal: `supabase/functions/generate-certificate-b-pdf/index.ts` (agregar gate real) + UI de `admin/certificacion` |
| ASG-015 | Fix H-027: alertas de asistencia Profesional fallan con 500 real al filtrar por sede específica (`v_professional_attendance`) | `m` | fix | Alta | b | Migración SQL — la vista rompe con JOIN/cast al aplicar filtro de sede; funciona bien con `branchId=null` |
| ASG-016 | Fix H-029: precio del curso Profesional A2 muestra $180.000 en vez de $800.000 del seed | `i` | fix | Alta | b | Error de cobro real — 4.4× menos de lo que corresponde por matrícula. Investigar de dónde toma el precio el wizard de matrícula Profesional |
| ASG-017 | Fix H-035 + H-017: Portal Alumno nunca puede mostrar la nota del Examen Final — columna equivocada en la query (mismo bug, 2 hallazgos duplicados) | `b` | fix | Alta | b | Fix simple y acotado: `student-home.facade.ts:174` y `:265`, cambiar `.select('grade, created_at')` → `.select('score, created_at')` |
| ASG-018 | Fix H-001 + H-002 + H-008: Dashboard admin — KPI "Vehículos" siempre en 0 (status `operational` vs `available`), formato roto en KPI "Ingresos Mes", estados contradictorios en "Clases Actuales" | `b` | fix | Media | b | Archivos: `dashboard.facade.ts:281`, `flota.facade.ts` (`resolveStatus()`). ⚠️ **Coordinar con ASG-005** (mismo `dashboard.component.ts`, cobertura `data-llm-*`) para no pisarse |
| ASG-019 | Fix H-038: columna "Clases activas" de Instructores siempre muestra 0 — nunca se escribe | `m` | fix | Media | b | Archivo: `instructores.facade.ts:622`. Reemplazar por `COUNT` en vivo en vez de columna cacheada sin mantener |
| ASG-020 | Fix H-004 + H-005: Anticipos muestra enum crudo "both" sin traducir, KPIs financieros sin separador de miles + "Otros (Sede 0)" sin resolver nombre | `m` | fix | Media | b | Formato/pipes en `admin/contabilidad/anticipos`, `admin/contabilidad/reportes`, `admin/contabilidad/cursos` |
| ASG-021 | Fix H-006: Configuración Web usa voseo argentino en vez de español de Chile | `i` | fix | Media | b | Solo copy, sin lógica — buen candidato para alguien nuevo en el repo |
| ASG-022 | Fix H-007: páginas cargan en blanco varios segundos sin skeleton en Agenda y Libro de Clases | `b` | fix | Media | b | Viola `swr-pattern.md`. ⚠️ **Coordinar con ASG-001** (verificación de skeletons de Benja) para no duplicar trabajo |
| ASG-023 | Decisión de producto + fix H-021: límite de clases/día distinto entre wizard público (1) y wizard interno (3) para la misma operación | `m` | spec | Media | b | Requiere decidir si es intencional antes de tocar código — si no lo es, unificar la regla de negocio |
| ASG-024 | Fix H-031: la búsqueda global (Ctrl+K) no indexa alumnos ni instructores, solo navegación | `b` | fix | Media | b | Extender el índice del buscador a datos de negocio (alumnos por nombre/RUT, instructores) |
| ASG-025 | Fix H-037: botones y títulos se recortan a mitad de palabra (falta `min-width:0` en hijos flex con `truncate`) | `i` | fix | Media | b | Archivos: `admin-alumno-detalle.component.ts:331-347` (`SectionHeroAction`) + fila de título en Instructores |
| ASG-026 | Fix H-026: la sede activa no persiste tras F5 / recarga completa | `m` | fix | Media | b | `BranchFacade.selectedBranchId` vive solo en memoria — persistir en `localStorage` o query param |
| ASG-027 | Fix H-003: Ex-Alumnos B muestra "2 Egresados" en el hero vs "16" en el Balance Anual — dos fuentes sin conciliar | `i` | fix | Media | b | Investigar las 2 queries distintas que calculan lo mismo en `/app/admin/ex-alumnos` |
| ASG-028 | Fix H-010 + H-014 + H-018: Agenda muestra "Todos los instructores" pero carga uno específico, texto RBAC "solo visible para admin" se muestra a secretaria, chips "P" ambiguos en asistencia | `i` | fix | Baja | b | 3 fixes cosméticos pequeños y no relacionados entre sí — buen paquete para alguien con poco tiempo |
| ASG-029 | Fix H-022 + H-030: vista previa del contrato no coincide con el PDF real (fecha vacía) + mismo texto genérico para Clase B y Profesional | `i` | fix | Baja | b | Mismo módulo (generación de contrato). El PDF real ya está bien — el problema es el HTML de preview + falta de contenido específico para Profesional |
| ASG-030 | Fix H-023: Caja Diaria muestra la glosa cruda del origen del pago ("online"/"enrollment") en vez de un concepto legible | `b` | fix | Baja | b | Mapeo ya existe en la página Pagos — reutilizar el mismo mapeo en Caja Diaria |
| ASG-031 | Fix H-032: el formulario "Recuperar Contraseña" sigue mostrando el campo de Contraseña del login normal | `b` | fix | Baja | b | Solo ocultar/limpiar el campo al cambiar de modo — el envío del enlace ya funciona bien |
| ASG-032 | Fix H-036: flash de texto incorrecto ("matrícula profesional") en la página Pagos de un alumno de Clase B mientras carga | `b` | fix | Baja | b | Archivo: `alumno-pagos.component.ts:205-212` — cambiar el valor por defecto de `heroSubtitle` |
| ASG-033 | Portal alumno no muestra matrículas múltiples: con 2+ matrículas activas, Pagos y el KPI del Dashboard solo muestran una, ocultando la otra aunque esté pagada y activa | `b` | spec | Media | b | Hallado al verificar fix-058-b (H-039) en vivo. Admin ya resuelve esto con tabs por matrícula; portal alumno no. Ver `specs/fix-058-b-pago-multiples-matriculas/fix.md` |

---

## Reclamadas / En curso

| ID | Título | Reclamado por | Track resultante | Fecha |
|----|--------|----------------|-------------------|-------|
| ASG-011 | Fix H-028 (Crítica): RLS bloquea a la secretaria subir documentos en matrícula Profesional (403) | m | [fix-054-m-h028-rls-secretaria-documentos-profesional](fix-054-m-h028-rls-secretaria-documentos-profesional/fix.md) | 2026-07-23 |

---

## Completadas

| ID | Título | Track resultante | Cerrada |
|----|--------|-------------------|---------|
| ASG-009 | Fix H-013 (Crítica): Reportes Contables no cuenta pagos reales de la sede — descuadre financiero | [fix-056-b-reportes-contables-branch-id](fix-056-b-reportes-contables-branch-id/fix.md) | 2026-07-23 |
| ASG-002 | Fix H-039: alumno con 2+ matrículas no puede pagar su saldo real (`student-payment` trae siempre la matrícula más reciente) | [fix-058-b-pago-multiples-matriculas](fix-058-b-pago-multiples-matriculas/fix.md) | 2026-07-23 |

---

## Convenciones

- **IDs:** `ASG-NNN`, 3 dígitos, contador **global** (no por autor) — secuencial, nunca se reutiliza.
- **`Asignado a`:** código de autor de `specs/AUTHORS.md` (`m` Matías, `b` Benjamín, `i` Ignacio), o `cualquiera` si es un pool abierto para quien la tome primero.
- **`Tipo sugerido`:** `spec` (feature nueva) / `fix` (bug con AC afectados) / `hotfix` (fix urgente simple) — quien reclama puede cambiarlo con `--as=` si al leer el contexto no coincide.
- **Reclamar:** solo se puede reclamar una asignación con `Asignado a: cualquiera`, o una asignada específicamente a tu propio código de autor. Una vez `Reclamada`, nadie más puede tomarla.
- **Cerrar:** marcar como `Completada` es **manual** — se mueve la fila cuando el track resultante (spec/fix/hotfix) llega a `done`/se cierra. No se sincroniza automáticamente con `/spec-verify` ni `/fix-close`.
- **Archivos involucrados:** cada `ASG-NNN-*.md` tiene una sección opcional "Archivos involucrados". Si se completa, `/assign-claim` la usa para avisar (no bloquear) si te solapás con otra asignación ya reclamada que declaró los mismos archivos — señal de alerta, no enforcement duro.

### Conflictos entre ramas

`/assign-claim` ya hace un `git fetch` + comparación contra `origin/main` en automático antes de reclamar
(best-effort: si falla por falta de red/remoto, no bloquea). Si dos personas igual reclaman la misma
asignación en paralelo (ej. por no pushear a tiempo), no hay resolución automática más allá de ese aviso
— es coordinación humana: quien se entera después, cede y reclama otra. Para minimizar el riesgo:

1. Si `/assign-claim` te avisa que tu copia está atrás, hacé `git pull` antes de continuar.
2. Al reclamar, commiteá y pusheá **solo ese cambio** (este archivo + el track nuevo) de inmediato, separado del resto de tu trabajo de feature.
