# Fix: Testing — Auditoría y Configuración web en el piloto
> id: fix-485-m-testing-auditoria-configuracion-web
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist:** `specs/testing-piloto/036-auditoria-configuracion-web.md` (casos A–V, sospechas
> S1–S22, decisiones §5). Los resultados se anotan acá, no en el checklist.

## Root Cause

[Heredado de ASG-i-036, a confirmar]: Dos módulos administrativos independientes. **Auditoría**
registra las acciones críticas (quién hizo qué y cuándo). **Configuración web** administra el
contenido de las landing pages de cada sede (cursos, precios, textos). Los dos son bastante
autocontenidos.

**Clasificación:** Funcional · dificultad Baja · rutas: `/app/admin/auditoria`,
`/app/{admin,secretaria}/configuracion-web`, `/politica-privacidad/:branchSlug` (pública).

### Alcance

1. **Funcional** — ACs de specs `0003-b` (landing pages y panel), `0004-b` (cursos con FK al
   catálogo), `ASG-i-020` (atributo disabled en el form), `ASG-b-069` / `ASG-b-072` (app-like).
2. **E2E manual** — acciones críticas en otros módulos aparecen en Auditoría con usuario, fecha,
   sede y detalle correctos; filtros; exportar; Configuración web (6 pestañas, subidas, reflejo en
   la landing `webs/`, aislamiento por sede); política de privacidad por sede.
3. **Seguridad** (solo contra dev) — casos H y R del checklist.

### Sospechas ya atendidas por tracks posteriores al checklist (2026-09-29)

Se verifican como regresión, no como bug nuevo:

| Sospecha | Track que la atendió |
|---|---|
| S1 exportar sin control de rol | `0009-i`, `fix-363-m` |
| S2 autoría falsificable · S3 log insertable | `fix-363-m` (ASG-i-047) |
| S4 tablas sin trigger (parcial) | `fix-206-b` |
| S5 solo se ven secretarias | `fix-069-i` |
| S10 filtro de fechas en UTC | `0024-m` |
| S14 XSS en la landing | `hotfix-008-i` |
| S15 bucket abierto | `fix-178-b` |

### Fuera de alcance

- Publicación de la landing en cPanel (spec `0005-b`, desactivada).
- Catálogo operacional de cursos por dentro (`/app/admin/configuracion-precios`).
- Widget "Actividad reciente" del dashboard (`ASG-i-030`).

## Progreso

- [x] Revisión en código: estado actual de S1–S22 contra el código vigente
- [x] Auditoría: acceso, tabla, filtros, drawer (A, B, E, F) — sesión 2026-11-07
- [x] Auditoría: seguridad e inmutabilidad (H)
- [x] Configuración web: carga, pestañas, guardar (I, J02, L, M, P)
- [x] Seguridad de configuración web (R)
- [x] Visual, app-like (T01–T03, T07)
- [x] Decisiones de negocio D1–D4 registradas
- [x] Fixes derivados 486–489, 491–495 y hotfixes 168–170 cerrados y commiteados
- [x] `fix-490-m`: migración `20261107120000` aplicada y verificada
- [x] Deploy de `generate-audit-report` v21 (2026-11-07) y exportación verificada: sin columna IP; "Instructores" trae solo Instructores (13); Excel sin filtros 10.000 de 78.503 con aviso en el archivo y toast "Reporte parcial"; PDF sin filtros 2.000 filas en 3 s con aviso; secretarias sede 2 por sede de la acción (249)
- [x] Auditoría: cobertura acción → registro (C01–C24), atribución D04–D06, exportar desde la UI (G)
- [x] Landing pública (Q), con `webs/` compilada y servida contra la BD de dev
- [x] Política de privacidad (V) y formatos de J/K/N
- [x] Decisiones de §5 resueltas (ver Decisiones)
- [x] Fixes derivados 496–502 y hotfixes 171–175 cerrados y commiteados; migración de fix-496-m aplicada y 4 funciones de fix-497-m desplegadas (verificadas)
- [x] `/fix-close`

## Resultados

### Revisión en código (2026-11-07)

| Sospecha | Estado | Evidencia |
|---|---|---|
| S1 exportar sin rol | ✅ cerrada | `requireStaff(req, ['admin'])` en `generate-audit-report`; API: secretaria e instructor → 403 |
| S2 header de autoría | ✅ cerrada | `log_change()` manda `auth.uid()`; header solo con service key (`fix-363-m`) |
| S3 log insertable | ✅ cerrada | `REVOKE ALL … GRANT SELECT` (`fix-363-m`) |
| S4 tablas sin trigger | ⚠️ parcial | 24 tablas con trigger (+`instructors`, `vehicle_assignments`, `branch_payroll_config`, `enrollment_payment_overrides`); siguen sin trigger `courses`, caja, gastos, descuentos, asistencia, pagos a instructores, contratos → decisión §5 |
| S5 solo secretarias | ✅ cerrada | filtro "Quién" (`fix-069-i`) |
| S6 autor = quien registró | ✅ cerrada | `registered_by` solo sin sesión (`fix-069-i`) |
| S7 sede del usuario | ⚠️ parcial | "Quién = Secretarias" sigue filtrando por `users.branch_id`; el resto por `audit_log.branch_id` |
| S8 filtros fantasma | ❌ abierta | filtros del facade singleton sobreviven; los controles del componente vuelven a vacío |
| S9 diff de config web | ❌ abierta | último UPDATE de `website_config`: detalle de 13.214 caracteres con el JSON entero |
| S10 fechas en UTC | ✅ cerrada | `chileDayRange()` (`0024-m`) |
| S11 módulos sin filtro | ❌ abierta | "Ciclos Teóricos" no está en el filtro (193 registros inalcanzables); `website_config`, `special_service_sales`, `standalone_course_enrollments`, `professional_pre_registrations` sin módulo |
| S12 IP siempre "—" | ❌ abierta | `audit_log.ip` siempre null → decisión |
| S13 5.000 filas / carrera | ❌ abierta | `.limit(5000)` sin aviso; `fetchLogs` sin `createRequestGuard` |
| S14 XSS landing | ✅ cerrada | `hotfix-008-i` |
| S15 bucket | ✅ cerrada | `fix-178-b`; API: otra sede, `seeds/` y anónimo → 403 RLS. Un SVG con `<script>` se acepta en la carpeta propia (bajo: se sirve desde supabase.co y la landing lo usa en `<img>`) |
| S16 "Por qué elegirnos" | ❌ abierta | cada guardado lo reemplaza por 6 textos fijos del código |
| S17 curso inactivo | ❌ abierta | `loadAvailableCourses` filtra `active = true` → rama "Curso no existe" |
| S18 precio promo | ❌ abierta | navegador: al marcar parte en 0 ("Gratis"), acepta −5.000 ("$-5.000"), al vaciar se desmarca |
| S19 cambio de sede | ❌ abierta | sin aviso de cambios sin guardar; `loadConfig` sin guard |
| S20 cards nuevas en landing | ⏳ | requiere `webs/` corriendo |
| S21 botón del hero | ❌ abierta | navegador: con un error, el del pie se deshabilita y el del hero no |
| S22 secretaria sin sede | ✅ cerrada | `branchAssignedGuard` (hotfix-099-b) la manda a `/sin-sede` antes de llegar |

### Hallazgos nuevos

| # | Hallazgo | Evidencia |
|---|---|---|
| N1 | ~~Tema visual cruzado entre sedes~~ **Descartado:** sede 1 = roja y sede 2 = azul es la decisión del 2026-06-15 (`5034e309`, `sede-theme.utils.ts`); los nombres `azul.json`/`roja.json` de `webs/` son claves de build heredadas y el checklist quedó con el mapeo viejo. Lo que sí estaba mal: los valores por defecto y el respaldo al guardar en Configuración web seguían con el mapeo viejo → `hotfix-169-m` | `website_config.config->brand`; `sede-theme.utils.ts`; `admin-configuracion-web.component.ts:619,711` |
| N2 | Auditoría a 1440 px: los filtros cortan su texto ("Todos los usu…"), "Exportar" queda solo en una segunda fila, la columna IP queda fuera y caben ~3 filas | captura `c485-01-auditoria.png` |
| N3 | Con el drawer abierto los filtros se reducen a una letra ("T", "E") | captura `c485-02-drawer.png` |
| N4 | Etiquetas de filtros mezcladas: fechas en `micro-label` y el resto en minúscula | `admin-auditoria.component.ts:103-148` |
| N5 | Fecha en tabla `2026-11-06 23:00:11` y en drawer `06/11/2026 23:00:11` | drawer |
| N6 | Montos del detalle sin separador de miles: "Clase B ($180000)" | `log_change()` |
| N7 | Pestañas de Configuración web a 1440 px: "Cursos & Precios" y "Contacto & Horas" en dos líneas con el ícono separado | captura `c485-03-configweb.png` |

### Navegador y API (2026-11-07)

| Caso | Res. | Nota |
|---|---|---|
| A01 / A04 admin | ✅ | consola sin errores |
| A02 / A06 secretaria | ✅ | vuelve a su dashboard; sin "Auditoría" en el menú |
| A05 / I06 secretaria | ✅ | "Sede: Autoescuela Chillán", config de su sede |
| B03 hora Chile | ✅ | `02:00:13Z` se muestra `23:00:13` |
| B05 / B12 IP | ❌ | siempre "—" (S12) |
| E13 filtros fantasma | ❌ | vuelve con 33.379 (filtrado) y los controles en "Todas las acciones" (S8) |
| F01 drawer | ✅ | con N5 |
| H01 exportar | ✅ | secretaria e instructor → 403 |
| H02 leer | ✅ | secretaria solo ve sus filas (user 8) |
| H03 / H04 / H06 | ✅ | insertar, editar y borrar → 403 (también el admin) |
| H05 header falso | ✅ | queda a nombre de la secretaria, no del id del header |
| I01 admin sin sede | ✅ | estado vacío (el hero muestra KPIs en 0 y "Publicar Cambios") |
| J02 / T07 consola | ✅ | sin warning de `disabled` |
| L06 / L08 / L09 override | ❌ | S18 |
| P02 error en otra pestaña | ❌ | solo "⚠️ Existen errores de validación", sin indicar la pestaña |
| P04 hero vs pie | ❌ | S21 |
| P09 emoji | ❌ | "⚠️" en el pie |
| R01 secretaria A → sede B | ✅ | 0 filas afectadas |
| R03 anónimo lee | ✅ | sin datos privados (brand, hero, cursos, contacto, faqs…) |
| R04 instructor | ✅ | 0 filas |
| R05 / R06 Storage | ✅ | 403 RLS |
| T01 / T02 / T03 | ✅ | sin scroll de documento ni horizontal a 375 / 768 / 1440 |


### Segunda sesión (2026-11-07, tarde)

| Caso | Res. | Nota |
|---|---|---|
| C01–C12, C20–C23 cobertura | ✅ | último registro de cada tabla revisado por API; detalles legibles salvo lo de `fix-496-m` |
| C06 tipo de documento | ❌→✅ | "autorizacion_notarial de …" sin traducir (`fix-496-m`) |
| C11 emitir certificado | ❌→✅ | quedaba como "Sistema" (`fix-497-m`) |
| C13–C16 precios, caja, gastos, descuentos | ✅ | acciones reales por API; columnas sin traducir y montos sin miles en el diff (`fix-496-m`) |
| C22 pre-inscripción web | ❌→✅ | "Clase  - Nombre" sin curso (`fix-496-m`) |
| C23 guardar sin cambios | ✅ | 0 registros |
| D02 Profesional por sede | ❌→✅ | 5.700 registros de Profesional sin sede (`fix-496-m`, migración aplicada, 0 sin sede) |
| D04 multi-sede actúa en la sede 2 | ✅ | caja de la sede 2 por la secretaria multi-sede → sede 2 |
| D05 admin edita un pago ajeno | ✅ | a nombre del admin |
| D06 secretaria desactivada | ✅ | sus registros conservan el nombre |
| G01 / G07 exportar desde la UI | ✅ | `Auditoria_20261107.xlsx`, botón deshabilitado sin cambiar de ancho, aviso de reporte parcial |
| G09 menú: clic afuera | ❌→✅ | no se cerraba con clic en el encabezado ni el sidebar (`hotfix-171-m`, 6 pantallas) |
| Q01 / L06 precio en la landing | ✅ | luego se quitó el precio promocional por decisión (`fix-501-m`) |
| Q02 card nueva sin recompilar | ❌→✅ | `fix-498-m` |
| Q02 curso de Refuerzo | ❌→✅ | el panel ofrecía cursos que la web no muestra (`fix-499-m`) |
| Q06 / Q07 tildes y HTML | ✅ | se muestran como texto, sin `alert` |
| Q estilo de "Qué incluye" | ❌→✅ | listas hidratadas sin estilo (`hotfix-173-m`) |
| R08 `javascript:` en el mapa | ❌→✅ | **se ejecutaba** en la landing; redes igual al clic (`fix-500-m`) |
| V01–V03, V05, V07, V10 | ✅ | |
| V04 slug con mayúsculas | ❌→✅ | `hotfix-172-m` |
| V08 país de alojamiento | ⚠️ | sigue "fuera de Chile" (bloqueante legal ya reportado por el código, fuera de este track) |
| V09 enlace desde la landing | ❌→✅ | `hotfix-174-m` |
| J03/J04/K10/N03/N04 formatos | ❌→✅ | `fix-500-m` |
| J08 / L15 | ❌→✅ | `hotfix-175-m` |

Datos: la web de la sede 2 no tiene cards de cursos desde agosto (su landing cae al contenido
estático). La landing de `webs/` en el puerto 4321 corría sin `PUBLIC_SUPABASE_*`; las pruebas se
hicieron con otra instancia (4322) y con el sitio compilado (`astro build` + `astro preview`).

### Decisiones

Matías, 2026-11-07:

- **D1 (C13–C19)** — Se auditan además **precios y descuentos** (`courses`, `discounts`,
  `discount_applications`) y **caja y gastos** (`cash_closings`, `cuadratura_adjustments`,
  `expenses`, `fixed_expenses`). Pagos a instructores, asistencia y contratos quedan fuera.
- **D2 (B05)** — Se **quita la columna IP** (tabla, drawer y exportación).
- **D3 (P08)** — "Por qué elegirnos" **conserva lo guardado**; publicar ya no lo pisa. Sin editor.
- **D4 (D04 / I08 / R02)** — El registro es de la **sede de la acción** (también con "Quién =
  Secretarias"), y la secretaria con acceso a ambas sedes **edita la web de las dos** siguiendo
  su selector de sede.

Resueltas sin consultar (opción obvia): avisar antes de perder cambios sin publicar al cambiar
de sede (I04); el precio promocional parte vacío y exige un número ≥ 0 (L09); la promo activa
exige título y descripción (M03).

Matías, segunda sesión: **Q04** el precio de la web sale siempre de la Configuración de precios (se
quita el precio promocional); **N07/V07** el contacto de la web se edita libre, con aviso si no
coincide con la política; **secretaria** edita toda la web de su sede, como hoy. Sin consultar:
V09 (enlazar la política desde la landing), formatos de URL/WhatsApp/coordenadas, confirmar al
eliminar una card (L15) y aclarar que una subida se ve al publicar (J08).

### Bugs derivados

| Hallazgo | Track | Estado |
|---|---|---|
| Auditoría: filtros fantasma, respuestas fuera de orden, skeleton al volver (S8, S13, B09) | `fix-486-m` | ✅ |
| Auditoría: módulos sin filtro, mapa de la exportación divergido, sede de la secretaria (S7, S11) | `fix-487-m` | ✅ (desplegado v21, verificado) |
| Exportar auditoría: 1.000 filas sin avisar (G06, S13) | `fix-488-m` | ✅ (desplegado v21, verificado) |
| Columna IP siempre vacía (S12, B05, D2) | `fix-489-m` | ✅ (desplegado v21, verificado) |
| Filtros de Auditoría por ancho de ventana, etiquetas mezcladas, fecha distinta en detalle (N2–N5) | `hotfix-168-m` | ✅ |
| Tema por defecto de la web con el mapeo viejo de sedes (N1) | `hotfix-169-m` | ✅ |
| Publicar pisa "Por qué elegirnos" (S16, D3) | `fix-491-m` | ✅ |
| Botón del hero sin reaccionar, error sin pestaña, emoji (S21, P02, P04, P09) | `fix-492-m` | ✅ |
| Precio promo sin validar y promo activa sin texto (S18, L08, L09, M03) | `fix-493-m` | ✅ |
| Curso inactivo se ve como "Curso no existe" (S17, L10) | `fix-494-m` | ✅ |
| Cambio de sede pierde lo editado y puede mezclar sedes; secretaria multi-sede fija (S19, I04, P10, D4) | `fix-495-m` | ✅ |
| Pestañas partidas en dos líneas en vez de abreviarse (N7) | `hotfix-170-m` | ✅ |
| Detalle de config web ilegible, montos sin miles, caja y precios sin auditar (S9, N6, D1) | `fix-490-m` | ✅ |
| Profesional sin sede, pre-inscripción sin curso, "id=7", tipos y columnas sin traducir (C06, C13–C16, C22, D02) | `fix-496-m` | ✅ (aplicada, verificada) |
| Certificados, libro de clases y licencias como "Sistema" (C11) | `fix-497-m` | ✅ (desplegadas, verificada) |
| Menú Exportar no se cierra con clic en encabezado/sidebar (G09) | `hotfix-171-m` | ✅ |
| Política de privacidad con mayúsculas en el enlace (V04) | `hotfix-172-m` | ✅ |
| Landing compilada no muestra cards nuevas (S20, Q02) | `fix-498-m` | ✅ |
| Listas hidratadas de la landing sin estilo | `hotfix-173-m` | ✅ |
| Panel ofrece Refuerzo/Convalidación, que la web no muestra | `fix-499-m` | ✅ |
| `javascript:` en mapa y redes se ejecuta en la landing; formatos sin validar (R08, J03, J04, K10, N03, N04) | `fix-500-m` | ✅ |
| Precio promocional de la web distinto del que cobra la matrícula (Q04) | `fix-501-m` | ✅ |
| Landing sin enlace a la política (V09) | `hotfix-174-m` | ✅ |
| Contacto de la web distinto de la política sin aviso (N07, V07) | `fix-502-m` | ✅ |
| Eliminar card sin confirmar; aviso de subida parece publicado (L15, J08) | `hotfix-175-m` | ✅ |

## ACs Afectados

- `0003-b` y `0004-b` (los que el testing encuentre rotos se listan en "Bugs derivados").

## Cambio

Ninguno dentro de este track (testing). Cada corrección va en su propio fix/hotfix.

## Test de Regresión

Los tests de regresión viven en cada fix derivado.
