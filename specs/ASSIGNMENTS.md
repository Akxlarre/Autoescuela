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
> quedar desactualizado entre ramas. Commitea y pushea los cambios acá **de inmediato**
> (antes de armar tu rama de feature) para que el resto del equipo vea la reclamación
> a tiempo. Ver sección "Conflictos entre ramas" al final.

---

## Pendientes

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|
| ASG-b-100 | QA visual del portal del Instructor cuando se levante la fase piloto | `cualquiera` | fix | P2 | b | Bloqueada hasta que se levante la fase. `ASG-i-012` dejó este portal fuera de alcance. Incluye cerrar AC1b de `fix-169-b`. ⚠️ `instructor@test.com` tiene 0 alumnos — hay que sembrar datos antes |

### Tanda testing profundo del piloto por módulo — 2026-09-29

> Testing de la primera entrega (piloto Admin/Secretaria: todo salvo portales Instructor y
> Alumno, matrícula pública online y 7 módulos de Clase Profesional — ver
> `src/app/core/config/pilot-phase.config.ts`). **Una asignación por módulo**, cada una con
> 3 capas: **(1) Funcional** — verificar los ACs de las specs/fixes que ya documentan el módulo;
> **(2) E2E manual** — checklist de casos, incluidos los que cruzan a otros módulos;
> **(3) Playwright** — casos a automatizar en la suite nueva.
>
> **Tipo:** *Funcional* = el módulo se prueba casi solo, contra sus propios ACs. *Integración* =
> sus datos dependen de otros módulos o los alimentan. *E2E* = flujo de negocio de punta a punta
> que cruza varios módulos y roles.
>
> **Orden:** `021` (montar Playwright) es prerequisito **solo de la capa 3**; las pasadas manuales
> arrancan ya, en paralelo. `029` (Contabilidad) y `030` (Dashboards) conviene correrlas al final,
> sobre los datos que generaron las demás. Cada bug encontrado va a **su propio** fix/hotfix.
>
> **Reparto (2026-09-30, por Matías).** Por esfuerzo estimado (casos de cada archivo de
> `specs/testing-piloto/` × dificultad + hallazgos 🔴 a confirmar), no por cantidad de
> asignaciones, agrupando cadenas de módulos para que las dependencias queden en una persona:
>
> | Quién | Bloque | Asignaciones | Esfuerzo aprox. |
> |---|---|---|---|
> | `i` Ignacio | Dinero: matrícula → pagos → contabilidad | 023, 028, 031, 029, 030, 036 | ~1.620 |
> | `m` Matías | Ciclo académico del alumno (038 primero: bloquea casos de 024 y 033) | 038, 027, 024, 033, 025 | ~1.540 |
> | `b` Benjamín | Plataforma y seguridad (037 concentra 25 de los 🔴 → Fase 0) | 037, 022, 034, 026, 032, 035 | ~1.650 |
>
> **Datos de prueba — dos cuidados:**
> 1. Nadie tiene que esperar a otro para tener datos: el seed de `0008-i` ya trae alumnos,
>    matrículas, agenda, pagos y asistencia. Los datos **especiales** que el seed no trae (fechas
>    pasadas, documentos vencidos, alumnos con 2 matrículas, 12/12 prácticas) conviene sembrarlos
>    **una sola vez para todos**, no cada uno por su lado.
> 2. La BD es compartida: para acciones que cambian estado (anular, cancelar, egresar, pagar,
>    marcar inasistencia) usa un alumno de prueba propio o uno del seed acordado con el resto,
>    para no romperle el caso a otro. Mirar datos existentes no tiene problema.
>
> | ASG | Módulo | Tipo | Dificultad | Prioridad |
> |---|---|---|---|---|
> | 021 | Infra: suite Playwright E2E | Infraestructura | Alta | P0 |
> | 022 | Autenticación, sesión, roles y fase piloto | Integración/E2E | Media | P0 |
> | 023 | Matrícula presencial (B, refuerzo, Profesional) | E2E | Alta | P0 |
> | 024 | Base de Alumnos B, ficha y ex-alumnos | Integración | Alta | P0 |
> | 025 | Clase Profesional piloto (Alumnos, Promociones, Libro) | Integración | Alta | P1 |
> | 026 | Agenda y Triple Match | E2E | Alta | P0 |
> | 027 | Asistencia B, inasistencias y penalización | Integración | Alta | P1 |
> | 028 | Pagos y descuentos | E2E | Alta | P0 |
> | 029 | Contabilidad (cuadratura, reportes, liquidaciones…) | Integración | Alta | P0 |
> | 030 | Dashboards (admin, ejecutivo, secretaria) | Integración | Media | P1 |
> | 031 | Servicios especiales | Funcional | Baja | P2 |
> | 032 | Flota y mantenimientos | Funcional | Media | P1 |
> | 033 | Documentos (DMS) y certificación B | Funcional | Media | P1 |
> | 034 | Instructores, secretarias y usuarios | Integración | Media | P1 |
> | 035 | Tareas, notificaciones y comunicados | Integración | Media | P1 |
> | 036 | Auditoría y Configuración web | Funcional | Baja | P2 |
> | 037 | Transversal: multi-sede (RLS), responsive, temas, app-like | E2E | Alta | P0 |

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|
| ASG-i-022 | Testing: Autenticación, sesión, roles y fase piloto | `b` | fix | P0 | i | Integración/E2E · Media |
| ASG-i-023 | Testing: Matrícula presencial (B, refuerzo, Profesional) | `i` | fix | P0 | i | E2E · Alta · coordinar con 026 y 028 |
| ASG-i-024 | Testing: Base de Alumnos B, ficha y ex-alumnos | `m` | fix | P0 | i | Integración · Alta |
| ASG-i-025 | Testing: Clase Profesional en el piloto | `m` | fix | P1 | i | Integración · Alta |
| ASG-i-026 | Testing: Agenda Clase B y Triple Match | `b` | fix | P0 | i | E2E · Alta · ⚠️ confirmar quién cierra clases sin portal Instructor |
| ASG-i-027 | Testing: Asistencia B, inasistencias y penalización | `m` | fix | P1 | i | Integración · Alta |
| ASG-i-028 | Testing: Pagos, abonos y descuentos | `i` | fix | P0 | i | E2E · Alta |
| ASG-i-029 | Testing: Contabilidad | `i` | fix | P0 | i | Integración · Alta · correr después de 028/031 |
| ASG-i-030 | Testing: Dashboards | `i` | fix | P1 | i | Integración · Media · correr al final |
| ASG-i-031 | Testing: Servicios especiales | `i` | fix | P2 | i | Funcional · Baja |
| ASG-i-032 | Testing: Flota y mantenimientos | `b` | fix | P1 | i | Funcional · Media |
| ASG-i-033 | Testing: Documentos (DMS) y certificación B | `m` | fix | P1 | i | Funcional · Media |
| ASG-i-034 | Testing: Instructores, secretarias y usuarios | `b` | fix | P1 | i | Integración · Media |
| ASG-i-035 | Testing: Tareas, notificaciones y comunicados | `b` | fix | P1 | i | Integración · Media |
| ASG-i-036 | Testing: Auditoría y Configuración web | `i` | fix | P2 | i | Funcional · Baja |
| ASG-i-037 | Testing transversal: multi-sede, responsive, temas, app-like | `b` | fix | P0 | i | E2E · Alta · fuga entre sedes = bloqueante |

### Tanda fixes del testing del piloto — 2026-09-30

> Salen de las sospechas 🔴 de los checklists de `specs/testing-piloto/` (resumen en
> `specs/testing-piloto/000-resumen.md`). El 2026-09-30 se hizo una **confirmación en vivo de solo
> lectura** contra la BD del piloto; el resultado está al inicio de cada asignación.
> **Las marcadas ⏳ NO están confirmadas**: su paso 1 es confirmarlas (con datos de prueba creados
> para eso, nunca sobre datos que usen otros). Si no se reproducen, se cierran como "no aplica".
> Agrupadas por causa, no por bug suelto.
>
> **Orden sugerido:** `039` y `040` ya (hotfix de minutos) → `041`–`047` seguridad, antes de
> entregar → `048`–`053` dinero y clases → `054`–`057` patrones transversales, en paralelo con el
> testing. `052` depende en parte de `ASG-i-038`.
>
> **Solapes a coordinar:** `041`+`042` (mismo helper de autorización en edge functions) ·
> `043`+`044`+`045` (RLS de `users`/sede) · `048`+`049`+`051` (`cuadratura.facade.ts`, saldo).
>
> **Dato de diseño:** la llave pública (anon key) pasa `verify_jwt`; exigir "JWT válido" no basta,
> hay que verificar un usuario real y su rol (`041`, `042`).
>
> **Reparto (2026-10-01).** Se repartió por esfuerzo estimado (en puntos, 1 = minutos y 10 = spec
> de alto riesgo), sin separar los grupos de solapes de arriba:
> - **i (Ignacio):** `041`, `048`, `049`, `050`, `051`. Edge functions sin sesión, junto con su
>   `042` en curso, más dinero (cuadratura, pagos, matrícula, servicios especiales). ≈18 pts,
>   ≈23 con `042`.
> - **b (Benjamín):** `043`, `044`, `045`, `046`. Control de acceso: cuentas, RLS por sede y
>   Storage por sede, con un mismo criterio de sede para tablas y archivos. Sigue lo que probó en
>   `022`, `034` y `037`. ≈27 pts.
> - **m (Matías):** `047`, `052`, `053`, `054`, `055`, `056`, `057`. RPC y auditoría, clases
>   (acciones masivas, trigger de deserción), fechas UTC, errores tragados, Realtime y
>   comunicados. ≈25 pts.
>
> `055` no incluye los casos de `cuadratura.facade.ts`, que van en `048` (i). `052` ya no espera
> a `ASG-i-038`, resuelta en `fix-262-m`: la nota no condiciona el certificado.

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|
| ASG-i-041 | Edge functions que responden sin sesión (5) | `i` | fix | P0 | i | 🟡 1/5 confirmada en vivo, 4 ⏳. Coordinar con 042 |
| ASG-i-043 | Secretaria puede editar a cualquier usuario (incl. admin) | `b` | fix | P0 | i | ⏳ Toma de cuenta; requiere migración |
| ASG-i-044 | Usuarios desactivados siguen entrando + recuperar contraseña | `b` | fix | P0 | i | ⏳ Puede partirse en 2 |
| ASG-i-045 | RLS que filtra por rol pero no por sede | `b` | spec | P0 | i | 🟡 Lectura de clases y ventas confirmada; `students`/`payments` SELECT sí filtra; escritura ⏳ |
| ASG-i-046 | Storage: leer/sobrescribir archivos de otra sede, subida anónima | `b` | fix | P0 | i | 🟡 Listar otras sedes confirmado; resto ⏳ |
| ASG-i-047 | RPC `SECURITY DEFINER` y auditoría abiertas a cualquier logueado | `m` | fix | P0 | i | ⏳ Paso 1: consulta de permisos |
| ASG-i-048 | Cuadratura: operaciones que fallan en silencio y corrompen saldos | `i` | fix | P0 | i | ⏳ |
| ASG-i-049 | Pagos duplicados (doble Enter) y sobrepago concurrente | `i` | fix | P0 | i | ⏳ |
| ASG-i-050 | Matrícula activa aunque dice "no se confirmó" | `i` | fix | P0 | i | ⏳ Consentimiento Ley 21.719 |
| ASG-i-051 | Servicios especiales fuera de Reportes/Dashboard; efectivo como tarjeta | `i` | fix | P0 | i | ⏳ |
| ASG-i-052 | "Borrar horarios" y "Reactivar" en masa sin confirmación | `m` | fix | P0 | i | ⏳ Relacionada con 038; probar solo con alumno de prueba |
| ASG-i-053 | Verificar si el trigger viejo de deserción sigue activo | `m` | hotfix | P0 | i | ⏳ Una consulta SQL decide |
| ASG-i-054 | Fechas de negocio en UTC (~19 lugares) | `m` | spec | P1 | i | ⏳ Inventario en `037` §1 |
| ASG-i-055 | Escrituras sin revisar error con toast de éxito (~13) | `m` | fix | P1 | i | ⏳ Inventario en `037` §1 |
| ASG-i-056 | Canales Realtime que escuchan tablas no publicadas (6) | `m` | fix | P1 | i | ⏳ Una migración |
| ASG-i-057 | Comunicados a >200 alumnos nunca terminan | `m` | fix | P1 | i | ⏳ |

### Tanda hallazgos de QA visual del piloto — 2026-09-22

> Salió de `ASG-i-012` (QA visual pre-lanzamiento, cerrada). Los 7 tracks ya están redactados
> en `draft` con diagnóstico completo (Root Cause/Cambio/Test de Regresión) — quien reclame no
> necesita generarlos desde cero, solo activarlos e implementarlos. Ver
> `specs/fixes/fix-037-i-qa-visual-piloto/fix.md` para el contexto completo del QA que las
> originó.
>
> **`ASG-i-017` es la única P0** (gap de guard de seguridad/scope, no solo UX) — priorizarla
> sobre el resto si alguien tiene que elegir una sola.

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|

### Tanda alcance de lanzamiento piloto — 2026-09-15

> Decisión de alcance de equipo (estudio previo + reunión, ver documento "Piloto
> Secretaría-Admin"): la primera entrega es **todo el proyecto salvo Instructor y Alumno**
> (no interactúan con el sistema todavía — queda para una fase posterior). Dentro de Clase
> Profesional, además, solo queda visible **Matricular a Clase Profesional** y la **Base de
> Alumnos Profesional** — el resto de sus módulos (pre-inscritos, relatores, promociones,
> asistencia, certificados, evaluaciones, archivo, ex-alumnos-profesional) queda oculto en
> esta fase. Clase B se entrega completa, sin recortes. "Ocultar" = fuera de menú y bloqueado
> por guard — el código de los 4 portales sigue existiendo tal cual, no se borra nada.
>
> **Orden sugerido:** `008` y `009` comparten archivos (`app.routes.ts`,
> `menu-config.service.ts`) y el mismo mecanismo de "fase" — conviene resolverlas juntas o
> coordinarse si las toman personas distintas. `010` depende del guard que salga de `008`.
> `011` va al final (documentación, necesita los tracks resultantes para linkear). `012` es
> el cierre — QA visual real antes de dar la entrega por lista, corre última.
>
> **`013` agregada 2026-09-18** (mismo alcance, motivo distinto): al definir `ASG-m-002`
> (reordenar Pago/Firma en el wizard) se identificó que la matrícula pública online
> (`/inscripcion`) es el único flujo donde un pago real por pasarela podría quedar
> "huérfano" sin nadie presente para cancelarlo — a diferencia del flujo presencial
> (Admin/Secretaria), donde el mismo caso se resuelve cancelando en el momento. Se decidió
> acotar `ASG-m-002` a presencial y bloquear `/inscripcion` en vez de resolver ese caso
> ahora. Reutiliza el guard de `008`/mecanismo de fase, no es una tanda aparte.

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
| ASG-b-045 | Imprimir lista de alumnos (réplica del libro de Registro de Alumnos) | `m` | fix | Baja | b | Pedir foto del libro físico antes de diseñar el formato — puede estar reglamentado. ⚠️ Solapa con ASG-b-049 |
| ASG-b-046 | Integración con Zoom API para clases teóricas Profesional | `b` | spec | Baja | b | **Ya se difirió una vez** en spec 0027 ("fork de `pg_net` sin precedente"). Leer ese cierre antes de rediseñar. Recomendado: Edge Function, no `pg_net` |
| ASG-b-049 | El número de matrícula debe ser más principal que el nombre del alumno | `b` | fix | Baja | b | Usar `.kpi-value`/`.kpi-label`, no tamaños ad-hoc. ⚠️ Solapa con ASG-b-024 (el buscador debe encontrar por número) y ASG-b-045 |

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

### Tanda auditoría fresca del DS — 2026-08-03

> Auditoría completa del Design System más allá de `lint:arch` (`indices/DS-AUDIT-2026-08-03.md`,
> hallazgos H1-H10). H3/H5/H10 ya se corrigieron directo (fix-110-b/111-b/112-b). Quedan estos 2
> como ASG por su tamaño — el resto de los hallazgos (H4/H6/H7/H8/H9) sigue solo documentado en
> el informe, sin ASG todavía.
>
> ⚠️ **Numeración:** la rama `claude/exciting-curie-2bdfdd` ya pusheó `ASG-b-087`/`ASG-b-088`
> (investigación de listas grandes/virtual scroll) — no reutilizar esos números. Estas 2 arrancan
> en `ASG-b-089`.
>
> ✅ **H1 resuelto (2026-08-15) vía `fix-146-b`** — y resultó ser en su mayoría un falso positivo:
> de los 7 componentes marcados, 6 eran organismos legítimos (inyectan el Facade de su propio
> dominio y se abren dinámicamente, sin padre en ningún template desde donde pasarles `input()`).
> Solo `logo` era violación real. Se arregló `logo` y se corrigió la regla de
> `architecture.md`, que equiparaba carpeta con rol. **Lección para futuras auditorías del DS:
> un grep de `inject(*Facade)` sobre `shared/` no distingue rol — verificar cómo se instancia
> el componente antes de contarlo como violación.**

> ✅ **ASG-b-092 reclamada (2026-09-07) por `b`** → `fix-156-b-guardrail-rol-dumb-organismo`, con
> el enfoque de guardrail (sin mover carpetas). Esta tanda queda sin pendientes.


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
| ASG-i-012 | QA visual pre-lanzamiento del alcance piloto | `i` | [fix-037-i-qa-visual-piloto](fixes/fix-037-i-qa-visual-piloto/fix.md) | 2026-09-22 |
| ASG-i-042 | Edge functions con sesión pero sin validar rol ni sede | `i` | [0009-i-edge-functions-exigir-usuario-staff](specs/0009-i-edge-functions-exigir-usuario-staff/spec.md) | 2026-10-01 |
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
| ASG-b-035 | Promociones automáticas: cadencia, convalidaciones y matrícula tardía | [0002-m-promociones-cadencia-automatica](specs/0002-m-promociones-cadencia-automatica/spec.md) | 2026-07-28 |
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
| ASG-b-037 | Cuadratura editable + egresos de combustible por vehículo | [0002-i-cuadratura-editable-ajustes](specs/0002-i-cuadratura-editable-ajustes/spec.md) | 2026-08-05 |
| ASG-b-048 | Secretaría no debe ver calificación ni aspectos a evaluar en Iniciar Clase | [fix-115-m-ocultar-evaluacion-secretaria-admin](fixes/fix-115-m-ocultar-evaluacion-secretaria-admin/fix.md) | 2026-08-05 |
| ASG-b-063 | Race condition "lost update" en `pending_balance` al registrar pagos | [fix-114-m-race-condition-pending-balance-pagos](fixes/fix-114-m-race-condition-pending-balance-pagos/fix.md) | 2026-08-05 |
| ASG-b-064 | Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede | [0005-m-facades-respuestas-stale](specs/0005-m-facades-respuestas-stale/spec.md) | 2026-08-05 |
| ASG-b-068 | App-like: `/admin/secretarias` | [fix-017-i-app-like-admin-secretarias](fixes/fix-017-i-app-like-admin-secretarias/fix.md) | 2026-08-05 |
| ASG-b-069 | App-like: `/admin/auditoria` | [fix-122-m-app-like-admin-auditoria](fixes/fix-122-m-app-like-admin-auditoria/fix.md) | 2026-08-06 |
| ASG-b-072 | App-like: `/admin/configuracion-web` + `/secretaria/configuracion-web` | [fix-124-m-app-like-configuracion-web](fixes/fix-124-m-app-like-configuracion-web/fix.md) | 2026-08-06 |
| ASG-b-076 | App-like: familia "pagos" (`admin` + `secretaria`) | [fix-132-m-app-like-familia-pagos](fixes/fix-132-m-app-like-familia-pagos/fix.md) | 2026-08-06 |
| ASG-b-065 | App-like: `/secretaria/dashboard` (portar `--fill-screen-2` desde admin) | [fix-123-b-app-like-secretaria-dashboard](fixes/fix-123-b-app-like-secretaria-dashboard/fix.md) | 2026-08-08 |
| ASG-b-066 | App-like: familia "instructores" (`admin` + `secretaria`) | [fix-125-b-app-like-familia-instructores](fixes/fix-125-b-app-like-familia-instructores/fix.md) | 2026-08-08 |
| ASG-b-074 | App-like: `/admin/contabilidad/liquidaciones` + `/secretaria/...` | [fix-019-i-app-like-liquidaciones](fixes/fix-019-i-app-like-liquidaciones/fix.md) | 2026-08-08 |
| ASG-b-075 | App-like: `/admin/contabilidad/historial-cuadraturas` + `/secretaria/...` | [fix-020-i-app-like-historial-cuadraturas](fixes/fix-020-i-app-like-historial-cuadraturas/fix.md) | 2026-08-08 |
| ASG-b-083 | App-like: `/alumno/dashboard` | [0035-b-app-like-alumno-dashboard](specs/0035-b-app-like-alumno-dashboard/spec.md) | 2026-08-08 |
| ASG-b-038 | Matrícula de refuerzo (6 clases) sin romper el modelo de Clase B | [0006-m-matricula-refuerzo-clase-b](specs/0006-m-matricula-refuerzo-clase-b/spec.md) | 2026-08-09 |
| ASG-b-067 | App-like: `/admin/flota` (`flota-list-content`) | [fix-126-b-app-like-admin-flota](fixes/fix-126-b-app-like-admin-flota/fix.md) | 2026-08-09 |
| ASG-b-070 | App-like: familia "horario" (`instructor` + `alumno`) | [fix-127-b-app-like-familia-horario](fixes/fix-127-b-app-like-familia-horario/fix.md) | 2026-08-09 |
| ASG-b-071 | App-like: familia "documentos" (`admin` + `secretaria`) | [fix-129-b-app-like-familia-documentos](fixes/fix-129-b-app-like-familia-documentos/fix.md) | 2026-08-10 |
| ASG-b-073 | App-like: familia "servicios especiales" (`admin` + `secretaria`) | [fix-021-i-app-like-servicios-especiales](fixes/fix-021-i-app-like-servicios-especiales/fix.md) | 2026-08-10 |
| ASG-b-080 | App-like: matriz de notas (`admin/clase-profesional/evaluaciones` + `secretaria/profesional/notas`) | [0008-m-app-like-matriz-notas-evaluaciones](specs/0008-m-app-like-matriz-notas-evaluaciones/spec.md) | 2026-08-10 |
| ASG-b-091 | Alumno con matrícula solo `completed` ve horario histórico sin aviso | [fix-128-b-alumno-matricula-completada-sin-aviso](fixes/fix-128-b-alumno-matricula-completada-sin-aviso/fix.md) | 2026-08-10 |
| ASG-b-077 | App-like: piezas sueltas (`flota/mantenimientos`, `contabilidad/cursos`, `contabilidad/anticipos`) | [fix-133-b-app-like-piezas-sueltas](fixes/fix-133-b-app-like-piezas-sueltas/fix.md) | 2026-08-11 |
| ASG-b-078 | App-like: portal instructor (resto — `dashboard`, `alumnos`, `liquidacion`, `ensayos-teoricos`, `notificaciones`) | [fix-139-b-app-like-portal-instructor-resto](fixes/fix-139-b-app-like-portal-instructor-resto/fix.md) | 2026-08-11 |
| ASG-b-081 | App-like: `/admin/clase-profesional/archivo` + `/secretaria/profesional/archivo` | [fix-150-m-app-like-profesional-archivo](fixes/fix-150-m-app-like-profesional-archivo/fix.md) | 2026-08-11 |
| ASG-b-090 | Consolidar paletas de color duplicadas/hardcodeadas en fuentes únicas | [fix-155-m-consolidar-paletas-color-duplicadas](fixes/fix-155-m-consolidar-paletas-color-duplicadas/fix.md) | 2026-08-12 |
| ASG-b-050 | Poder borrar (¿o anular?) Servicios Especiales | [fix-022-i-borrar-servicio-especial](fixes/fix-022-i-borrar-servicio-especial/fix.md) | 2026-08-13 |
| ASG-b-089 | Facade inyectado directamente en Dumb Components (`shared/components/**`) | [fix-146-b-facade-en-dumb-components](fixes/fix-146-b-facade-en-dumb-components/fix.md) | 2026-08-15 |
| ASG-b-084 | App-like: `/instructor/alumnos/:id/ficha` (piloto del patrón de tabs) | [fix-027-i-app-like-instructor-ficha-tabs](fixes/fix-027-i-app-like-instructor-ficha-tabs/fix.md) | 2026-08-17 |
| ASG-b-079 | App-like: portal alumno (`clases`, `pagos`, `pruebas-online`, `pagar`) | [fix-147-b-app-like-portal-alumno](fixes/fix-147-b-app-like-portal-alumno/fix.md) | 2026-08-22 |
| ASG-b-087 | Listas sin techo: filtro de período por defecto + búsqueda/export deben ignorarlo + límite en Deudores | [0038-b-filtro-periodo-listas-sin-techo](specs/0038-b-filtro-periodo-listas-sin-techo/spec.md) | 2026-08-22 |
| ASG-b-094 | Override de `force-compact` muerto en `section-hero` (modo slim) | [hotfix-052-b-force-compact-selector-muerto-section-hero](hotfixes/hotfix-052-b-force-compact-selector-muerto-section-hero/hotfix.md) | 2026-08-22 |
| ASG-b-097 | Aplicar 2 parches de harness sobre archivos protegidos | [hotfix-053-b-parches-harness-bash-guard-y-ac-verifier](hotfixes/hotfix-053-b-parches-harness-bash-guard-y-ac-verifier/hotfix.md) | 2026-08-22 |
| ASG-b-095 | QA visual pendiente de la cadena `0002-i` → `fix-018-i` (ajustes de cuadratura) | [fix-148-b-qa-ajustes-cuadratura-completada](fixes/fix-148-b-qa-ajustes-cuadratura-completada/fix.md) | 2026-08-23 |
| ASG-i-002 | Migrar funciones de negocio del cliente a Edge Functions | [0011-m-print-flows-edge-functions](specs/0011-m-print-flows-edge-functions/spec.md) | 2026-08-23 |
| ASG-b-082 | App-like: familia "reportes contables" + "cuadratura" (`admin` + `secretaria`) | [0003-i-app-like-reportes-contables](specs/0003-i-app-like-reportes-contables/spec.md) | 2026-08-24 |
| ASG-b-098 | El parche del Bash Guard arregló 1 de 4 patrones | [hotfix-054-b-bash-guard-patrones-1-2-4](hotfixes/hotfix-054-b-bash-guard-patrones-1-2-4/hotfix.md) | 2026-08-24 |
| ASG-b-093 | Áreas táctiles bajo 44×44 en componentes compartidos (`app-tabs`, `app-section-hero`) | [fix-150-b-areas-tactiles-compartidos](fixes/fix-150-b-areas-tactiles-compartidos/fix.md) | 2026-08-25 |
| ASG-i-001 | Revisar ortografía y voseo argentino | [fix-215-m-ortografia-voseo-app](fixes/fix-215-m-ortografia-voseo-app/fix.md) | 2026-08-25 |
| ASG-b-086 | App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases` | [0005-i-app-like-libro-de-clases](specs/0005-i-app-like-libro-de-clases/spec.md) | 2026-08-26 |
| ASG-b-085 | App-like: `/admin/alumnos/:id` + `/secretaria/alumnos/:id` (⚠️ la más grande y riesgosa del rollout) | [0006-i-app-like-alumno-detalle](specs/0006-i-app-like-alumno-detalle/spec.md) | 2026-08-30 |
| ASG-b-096 | Consolidar las 2 páginas duplicadas de ex-alumnos Clase B en un `*-content` compartido | [0007-i-ex-alumnos-content-unificado](specs/0007-i-ex-alumnos-content-unificado/spec.md) | 2026-08-31 |
| ASG-b-088 | Investigación empírica: simular datos y validar el umbral de virtual scroll | [0039-b-benchmark-umbral-virtual-scroll](specs/0039-b-benchmark-umbral-virtual-scroll/spec.md) | 2026-09-01 |
| ASG-b-099 | Listado de Flota no destaca vehículos con documentos vencidos | [fix-153-b-flota-listado-alerta-documento-vencido](fixes/fix-153-b-flota-listado-alerta-documento-vencido/fix.md) | 2026-09-01 |
| ASG-i-003 | "Evaluar clase" debe abrir en Drawer, no navegar a otra página | [fix-236-m-evaluacion-clase-en-drawer](fixes/fix-236-m-evaluacion-clase-en-drawer/fix.md) | 2026-09-02 |
| ASG-i-004 | El filtro "Aplicar" (mes) no afecta la pestaña Rentabilidad | [fix-237-m-conectar-filtro-mes-rentabilidad-cursos](fixes/fix-237-m-conectar-filtro-mes-rentabilidad-cursos/fix.md) | 2026-09-02 |
| ASG-i-005 | Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo | [0013-m-eliminar-notificaciones-drawer-historial](specs/0013-m-eliminar-notificaciones-drawer-historial/spec.md) | 2026-09-04 |
| ASG-b-092 | Mudar los Organismos a una carpeta que refleje su rol | [fix-156-b-guardrail-rol-dumb-organismo](fixes/fix-156-b-guardrail-rol-dumb-organismo/fix.md) | 2026-09-07 |
| ASG-i-006 | Resetear y repoblar la BD de prueba con datos masivos realistas | [0008-i-reset-y-poblar-datos-prueba](specs/0008-i-reset-y-poblar-datos-prueba/spec.md) | 2026-09-07 |
| ASG-m-005 | Filtros en la tabla principal de la vista Pagos | [fix-248-m-filtros-tabla-pagos](fixes/fix-248-m-filtros-tabla-pagos/fix.md) | 2026-09-15 |
| ASG-m-006 | Fix visual en la vista Secretarias de admin (espacio vacío) | [fix-247-m-secretarias-layout-espacio-vacio](fixes/fix-247-m-secretarias-layout-espacio-vacio/fix.md) | 2026-09-15 |
| ASG-m-009 | Libro de Clases debe ser una plantilla imprimible, no un reflejo de datos digitales | [fix-250-m-libro-clases-plantilla-imprimible](fixes/fix-250-m-libro-clases-plantilla-imprimible/fix.md) | 2026-09-15 |
| ASG-m-004 | Editor de plantillas para contratos y certificados generados por Edge Function | [0016-m-editor-plantillas-documentos](specs/0016-m-editor-plantillas-documentos/spec.md) | 2026-09-16 |
| ASG-i-007 | Performance crítica en `v_class_b_schedule_availability` (Horario/Agenda) | [fix-032-i-agenda-clase-b-vista-disponibilidad-lenta](fixes/fix-032-i-agenda-clase-b-vista-disponibilidad-lenta/fix.md) | 2026-09-17 |
| ASG-m-001 | Validación de años de licencia previa en matrícula profesional | [fix-033-i-validacion-anos-licencia-clase-profesional](fixes/fix-033-i-validacion-anos-licencia-clase-profesional/fix.md) | 2026-09-17 |
| ASG-m-002 | Mover el paso de Pago antes de la Firma de contrato en matrícula | [fix-034-i-orden-pago-firma-y-pasos-por-nombre](fixes/fix-034-i-orden-pago-firma-y-pasos-por-nombre/fix.md) | 2026-09-18 |
| ASG-i-008 | Ocultar portales Instructor y Alumno para el lanzamiento piloto | [fix-255-m-piloto-guard-fase-portales-inscripcion](fixes/fix-255-m-piloto-guard-fase-portales-inscripcion/fix.md) | 2026-09-19 |
| ASG-i-010 | Pantalla de aviso "módulo no habilitado todavía" (piloto) | [fix-255-m-piloto-guard-fase-portales-inscripcion](fixes/fix-255-m-piloto-guard-fase-portales-inscripcion/fix.md) | 2026-09-19 |
| ASG-i-013 | Bloquear matrícula pública online (/inscripcion) para el piloto | [fix-255-m-piloto-guard-fase-portales-inscripcion](fixes/fix-255-m-piloto-guard-fase-portales-inscripcion/fix.md) | 2026-09-19 |
| ASG-m-003 | Campo de número de boleta al registrar un pago | [fix-036-i-boleta-pago-matricula-nueva](fixes/fix-036-i-boleta-pago-matricula-nueva/fix.md) | 2026-09-19 |
| ASG-i-009 | Recortar Clase Profesional a solo Matrícula + Base de Alumnos | [fix-256-m-recorte-clase-profesional-matricula-base-alumnos](fixes/fix-256-m-recorte-clase-profesional-matricula-base-alumnos/fix.md) | 2026-09-21 |
| ASG-i-011 | Documentar el alcance "oculto en esta fase" en los índices | [hotfix-109-m-documentar-rutas-ocultas-fase-piloto](hotfixes/hotfix-109-m-documentar-rutas-ocultas-fase-piloto/hotfix.md) | 2026-09-21 |
| ASG-i-017 | 4 rutas del recorte de Clase Profesional accesibles sin guard (🔴 alta) | [fix-041-i-guard-recorte-clase-profesional-faltante](fixes/fix-041-i-guard-recorte-clase-profesional-faltante/fix.md) | 2026-09-22 |
| ASG-m-007 | Tema fijo por número de clase en Ficha Técnica (Clase B) + edición en Ajustes | [fix-169-b-temas-fijos-ficha-tecnica](fixes/fix-169-b-temas-fijos-ficha-tecnica/fix.md) | 2026-09-22 |
| ASG-i-016 | "Re-matricular" desde Ex-Alumnos no precarga datos (race condition) | [fix-040-i-rematricular-prefill-race-condition](fixes/fix-040-i-rematricular-prefill-race-condition/fix.md) | 2026-09-23 |
| ASG-i-014 | DateInputComponent: colisión de ID rompe formularios con 2+ fechas | [fix-038-i-date-input-id-colision](fixes/fix-038-i-date-input-id-colision/fix.md) | 2026-09-24 |
| ASG-i-015 | Buscador de listados no tokeniza "nombre + apellido" | [fix-039-i-buscador-alumnos-no-tokeniza](fixes/fix-039-i-buscador-alumnos-no-tokeniza/fix.md) | 2026-09-24 |
| ASG-i-018 | Botón "Papelera" de listados de alumnos sin label visible | [hotfix-004-i-papelera-alumnos-sin-label-visible](hotfixes/hotfix-004-i-papelera-alumnos-sin-label-visible/hotfix.md) | 2026-09-24 |
| ASG-i-019 | Skeleton de Flota dispara NG0955 por track key duplicado | [hotfix-005-i-skeleton-flota-track-duplicado](hotfixes/hotfix-005-i-skeleton-flota-track-duplicado/hotfix.md) | 2026-09-24 |
| ASG-i-020 | `[disabled]="true"` en control reactivo dispara warning de Angular | [hotfix-006-i-disabled-attribute-reactive-form-configuracion-web](hotfixes/hotfix-006-i-disabled-attribute-reactive-form-configuracion-web/hotfix.md) | 2026-09-24 |
| ASG-m-008 | Rediseño del Dashboard de admin como KPIs/reportes de empresa | [0044-b-dashboard-ejecutivo-admin](specs/0044-b-dashboard-ejecutivo-admin/spec.md) | 2026-09-27 |
| ASG-i-021 | Montar la suite Playwright E2E automatizada (base de la tanda de testing) | [0019-m-suite-playwright-e2e](specs/0019-m-suite-playwright-e2e/spec.md) | 2026-09-30 |
| ASG-i-039 | Sacar las credenciales de prueba de la pantalla de login | [hotfix-007-i-credenciales-prueba-login-solo-dev](hotfixes/hotfix-007-i-credenciales-prueba-login-solo-dev/hotfix.md) | 2026-09-30 |
| ASG-i-038 | Decisión de producto: ¿quién pone la nota de evaluación de las clases B durante el piloto? | [fix-262-m-certificacion-b-sin-requisito-nota](fixes/fix-262-m-certificacion-b-sin-requisito-nota/fix.md) | 2026-10-01 |
| ASG-i-040 | XSS almacenado en la landing pública (innerHTML con texto editable) | [hotfix-008-i-xss-landing-publica-innerhtml](hotfixes/hotfix-008-i-xss-landing-publica-innerhtml/hotfix.md) | 2026-10-01 |
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
  > **El `ASG-i-004` original (Edge Functions) fue eliminado el 2026-08-25** — no era una
  > asignación nueva: era el contenido de `ASG-i-002` de **antes** de su corrección de
  > alcance del 21-08 (auditoría amplia de "toda lógica de negocio sensible" en vez de los
  > 3 flujos de impresión que terminó cubriendo `ASG-i-002`, ya completada como
  > `0011-m-print-flows-edge-functions`). Apareció el 24-08 con una nota de "renumerada por
  > choque de ID", pero el choque real fue un `git pull`/merge sobre una rama que todavía
  > tenía la versión pre-corrección de `ASG-i-002`, resuelto (por un Claude, sin el contexto
  > de que la corrección de alcance YA era la resolución legítima) preservando ambas
  > versiones como asignaciones distintas en vez de descartar la copia vieja. Ver
  > `ASG-i-002` para el trabajo real y su historial completo. **El número `ASG-i-004` fue
  > reasignado el mismo día** a la asignación del filtro de Rentabilidad (antes
  > `ASG-i-005`) por decisión explícita del dueño — excepción puntual a "nunca se
  > reutiliza" porque el `ASG-i-004` original nunca fue trabajo real, así que no hay
  > historial que perder. No es precedente para reutilizar IDs en otros casos: solo aplica
  > cuando el ID liberado corresponde a una entrada fantasma como esta, no a trabajo
  > completado o descartado legítimamente.
- **`Asignado a`:** código de autor de `specs/AUTHORS.md` (`m` Matías, `b` Benjamín, `i` Ignacio), o `cualquiera` si es un pool abierto para quien la tome primero.
- **`Tipo sugerido`:** `spec` (feature nueva) / `fix` (bug con AC afectados) / `hotfix` (fix urgente simple) — quien reclama puede cambiarlo con `--as=` si al leer el contexto no coincide.
- **Reclamar:** solo se puede reclamar una asignación con `Asignado a: cualquiera`, o una asignada específicamente a tu propio código de autor. Una vez `Reclamada`, nadie más puede tomarla.
- **Cerrar:** marcar como `Completada` es **manual** — se mueve la fila cuando el track resultante (spec/fix/hotfix) llega a `done`/se cierra. No se sincroniza automáticamente con `/spec-verify` ni `/fix-close`.
- **Archivos involucrados:** cada `ASG-X-NNN-*.md` tiene una sección opcional "Archivos involucrados". Si se completa, `/assign-claim` la usa para avisar (no bloquear) si te solapas con otra asignación ya reclamada que declaró los mismos archivos — señal de alerta, no enforcement duro.

### Conflictos entre ramas

`/assign-claim` ya hace un `git fetch` + comparación contra `origin/main` en automático antes de reclamar
(best-effort: si falla por falta de red/remoto, no bloquea). Si dos personas igual reclaman la misma
asignación en paralelo (ej. por no pushear a tiempo), no hay resolución automática más allá de ese aviso
— es coordinación humana: quien se entera después, cede y reclama otra. Para minimizar el riesgo:

1. Si `/assign-claim` te avisa que tu copia está atrás, haz `git pull` antes de continuar.
2. Al reclamar, commitea y pushea **solo ese cambio** (este archivo + el track nuevo) de inmediato, separado del resto de tu trabajo de feature.
