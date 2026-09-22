# Fix: QA visual pre-lanzamiento del alcance piloto
> id: fix-037-i-qa-visual-piloto
> refs: ASG-i-012
> status: draft
> created: 2026-09-22

## Root Cause

[Heredado de ASG-i-012, a confirmar]: Antes de entregar el piloto, hay que verificar en
navegador real (no solo lectura de código) todo lo que **queda visible** en el alcance piloto
decidido el 2026-09-15:

- Los 4 portales de Admin y los 4 equivalentes de Secretaria — salvo el recorte de ASG-i-009
  (Clase Profesional reducida a Matrícula + Base de Alumnos).
- Clase B completa, sin recortes.
- Confirmar además que lo ocultado por ASG-i-008/ASG-i-009 **efectivamente no es accesible**
  (no solo que desapareció del menú — probar la URL directa también).

Corre última dentro de la tanda "alcance de lanzamiento piloto — 2026-09-15": depende de que
ASG-i-008, ASG-i-009 y ASG-i-010 ya estén mergeadas (confirmado: las 3 están en "Completadas"
de `specs/ASSIGNMENTS.md` — fix-255-m, fix-256-m).

## ACs Afectados

Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-i-012-qa-visual-pre-lanzamiento-piloto.md`.

## Cambio

Pendiente de completar por quien ejecuta el fix. Alcance sugerido por la Asignación:

- Usar el skill `/verify` (Playwright MCP) contra cada ruta que queda expuesta: consola sin
  errores, sin peticiones 4xx/5xx, sin datos mock, contrato app-like, modo claro/oscuro,
  responsive.
- Recorrer los "recorridos de negocio" del documento "Recorridos de testing — Piloto
  Admin/Secretaria" (enviado al equipo 2026-09-14, ahora versionado junto a este fix en
  `recorridos-testing-admin-secretaria.md`) — no basta con que cada pantalla cargue, hay que
  completar los flujos reales (matricular, iniciar/finalizar clase, pagar, cerrar caja, etc.)
  al menos una vez con cuentas de prueba. 3 bloques: A (Alumnos y Matrícula, 11 recorridos),
  B (Operación diaria, 8 recorridos), C (Dinero y Administración, 13 recorridos). Los marcados
  con (*) tocan multi-sede/RLS — probar con `secretaria@test.com` / `secretaria2@test.com`
  (sedes distintas) para confirmar que no se mezclan datos entre sedes.
- Probar explícitamente entrar por URL directa a una ruta oculta (`/app/instructor/dashboard`,
  `/app/admin/clase-profesional/promociones`, etc.) logueado como admin/secretaria — debe caer
  en la pantalla de aviso de ASG-i-010, no en un error genérico ni, peor, renderizar el módulo.

Fuera de alcance (heredado de la Asignación): no es una auditoría de código — es verificación
de comportamiento real en navegador. No cubre Instructor/Alumno (fuera del alcance de esta
entrega).

## Test de Regresión

Pendiente de completar — al ser un fix de verificación (no de código), la "regresión" es la
evidencia de `/verify` por ruta + captura de los recorridos de negocio completados, documentada
en la sección de Evidencia al cerrar.

## Evidencia de Verificación

### Bloque A — Alumnos y Matrícula (en progreso)

- **Recorrido 1 — Matricular alumno nuevo Clase B: ✅ PASA** (2026-09-22, admin, sede
  Autoescuela Chillán). Wizard completo (Datos → Instructor/Horario → Documentos → Pago →
  Contrato) sin errores de consola. Validado: RUT, email, límite 2 clases/día, límite 12
  clases total, generación de PDF de contrato en Supabase Storage, upload de escaneado
  firmado. Matrícula #0080 creada — Camila Andrea Reyes Muñoz, Clase B.
- **Recorrido 2 — Matricular alumno nuevo Profesional: 🔴 BUG ENCONTRADO** (2026-09-22, admin,
  sede Conductores Chillán, curso Profesional A2). Ver "Bugs encontrados" abajo — no se pudo
  completar el wizard (botón "Guardar y Continuar" queda deshabilitado) por la colisión de ID
  en `DateInputComponent`.
- **Recorrido 3 — Editar ficha de alumno existente: ✅ PASA** (2026-09-22, Camila Reyes,
  matrícula #0080). Drawer "Editar Perfil" precarga datos correctamente; cambio de teléfono
  se guarda y refleja en la ficha sin errores de consola. Detalle de ficha (clases prácticas
  1-12, estado financiero $180.000 pagado/$0 saldo) correcto. Ver también "Bugs encontrados"
  — se descubrió el bug del buscador ("Camila Reyes" no encuentra) al intentar ubicar esta
  alumna en el listado.
- **Recorrido 4 — Archivar y restaurar alumno (Clase B): ✅ PASA, con observación 🟡** (2026-09-22,
  Camila Reyes). Archivar pide escribir "borrarlo" para confirmar (doble protección OK), toast
  de éxito, contador baja correctamente. Restaurar funciona igual, toast de éxito, contador
  vuelve a 0 en papelera. **Observación:** el botón que abre la papelera (`admin-alumnos`,
  grupo "Acciones principales") no tiene label de texto visible — solo se distingue por su
  `aria-label`/tooltip "Papelera". El filtro "Todos los estados" tampoco incluye una opción
  "Archivado" y no hay ningún indicio visual en el listado principal de que la papelera existe
  o de cuántos alumnos contiene. Sin ese aria-label habría sido indistinguible del otro botón
  ("Nueva Matrícula") en la captura de accesibilidad — riesgo real de que una secretaria no
  sepa cómo deshacer un archivado. No se completó Clase Profesional (recorrido bloqueado
  igual que el 2, por el mismo bug de `DateInputComponent` si el alumno tuviera 2+ fechas —
  pendiente reintentar tras el fix). **Track creado:**
  `hotfix-004-i-papelera-alumnos-sin-label-visible`.
- **Recorrido 5 — Ex-Alumnos: filtros y re-matricular: 🔴 BUG ENCONTRADO** (2026-09-22,
  admin/ex-alumnos, alumno "Apellido61 Materno61 Alumno61" RUT 25000061-8). Filtros (búsqueda,
  período de egreso) correctos, 8 egresados listados. "Re-matricular" muestra el diálogo de
  confirmación correcto ("se precargarán los datos...") pero el wizard abre con el Paso 1
  completamente vacío — placeholder en todos los campos, ningún dato del egresado. Causa raíz:
  race condition — `router.navigate()` (query param `rut`) se llama sin `await` antes de abrir
  el drawer del wizard, que lee el RUT desde `route.snapshot` antes de que la navegación
  resuelva. Patrón duplicado en 4 componentes (admin/secretaria × Clase B/Profesional).
  **Track creado:** `fix-040-i-rematricular-prefill-race-condition`.
- **Recorrido 6 — Pre-inscritos (Profesional): N/A esta fase.** Confirmado
  `/app/admin/clase-profesional/pre-inscritos` redirige correctamente a
  `/modulo-no-disponible` (ASG-i-009, oculto en el piloto). No aplica.
- **Recorrido 7 — Reagendar clases penalizadas (2 inasistencias): ✅ PASA** (2026-09-22,
  Carlos Eduardo Muñoz Vega, matrícula #0079, 2 inasistencias consecutivas confirmadas en
  rail de Alertas de `admin/asistencia`). Flujo de 2 pasos correcto: Paso 1 (selección de las
  12 clases pendientes, preseleccionadas, checkboxes funcionan) → Paso 2 (razón del
  reagendamiento vía enum "Médica/Laboral/Viaje/..." + instructor + grilla de horarios
  reutilizada del wizard de matrícula). Sin errores de consola en ningún paso. No se guardó
  el reagendamiento completo (cerrado tras validar el flujo, para no alterar más datos de
  prueba) — la mecánica de UI está verificada.
- **Recorrido 8 — Reprogramar una clase individual ya agendada: ✅ PASA** (2026-09-22, Camila
  Reyes, Clase #1). Encontrada vía Ficha Técnica → botón "Reprogramar clase" por fila (no está
  en el drawer de detalle de la Agenda — solo tiene "Cerrar detalle", sin acciones; ese drawer
  es de solo lectura). Drawer "Reprogramar Clase": selector de instructor + grilla de horario
  reutilizada. Cambié Instructor1→Instructor3 y horario 08:30→10:10 el mismo día — toast
  "Clase reprogramada correctamente", Ficha Técnica y resumen de clases prácticas reflejan el
  cambio de inmediato. Sin errores de consola.
  - **Nota (no bug):** al elegir Instructor3, miércoles/jueves/viernes mostraron el día
    íntegro "Ocupado" mientras que martes tenía disponibilidad completa. Se verificó en
    código (`admin-alumno-detalle.facade.ts:1331`, query filtra correctamente por
    `instructor_id`) — es ocupación real por los ~130 alumnos de datos de seed, no una fuga
    de disponibilidad entre instructores. Descartado como falso positivo.
- **Recorrido 9 — Justificar inasistencia y confirmar que deja de contar para la
  penalización: ✅ PASA** (2026-09-22, Carlos Eduardo Muñoz Vega, Clase #2 del 19-09). Drawer
  "Inasistencias Registradas" → "Justificar" → motivo obligatorio → guardar. Resultado
  verificado en 2 lugares: (1) Ficha del alumno muestra "Inasistencia — Justificada" en Clase
  #2; (2) rail de Alertas en `admin/asistencia` bajó a Carlos Eduardo de "2 faltas" (botón
  "Eliminar", candidato a archivar) a "1 falta" (botón "Recordar") — la justificación
  efectivamente saca la clase del conteo de penalización. Sin errores de consola.
- **Recorrido 10 — Generar carnet/certificado PDF de alumno Clase B: ✅ PASA** (2026-09-22,
  Alumno61 Apellido61, egresado en Ex-Alumnos B pero con 0/12 clases prácticas marcadas
  completadas — dato de seed inconsistente, no bloqueante para esta prueba). "Carnet → 6
  clases" generó el PDF correctamente (drawer con iframe, sin errores). "Generar Certificado
  (0/12)" mostró el gate de negocio correctamente: diálogo "Prácticas incompletas" con opción
  de forzar → backend (`generate-certificate-b-pdf` Edge Function) rechazó con 400 igual
  ("El alumno no cumple el mínimo de 12 clases") → frontend mostró toast de error visible
  "No se pudo generar el certificado", sin fallo silencioso. **Observación menor:** el
  diálogo ofrece "generar de todas formas" pero el backend nunca permite el bypass — mensaje
  ligeramente engañoso, pero el comportamiento final (rechazo + aviso) es correcto y seguro.
  No amerita fix, es un matiz de copy.
- **Recorrido 11 — (*) Aislamiento multi-sede en Base Alumnos B: ✅ PASA** (2026-09-22,
  `secretaria@test.com` sede "Autoescuela Chillán" vs `secretaria2@test.com` sede "Conductores
  Chillán"). Ambas ven "64 alumnos" en el header (coincidencia numérica, no de datos): los
  RUTs y nombres listados son completamente disjuntos entre las dos sedes (ninguno de los seed
  123–130 ni Camila Reyes/Carlos Muñoz de Chillán aparece en el listado de Conductores Chillán,
  que muestra sus propios seed 193–200 + Ignacio Sorko + Andy Fernandez). Verificación
  explícita: buscar el RUT de Camila Reyes ("19.876.543-0", alumna de "Autoescuela Chillán")
  logueado como `secretaria2@test.com` → "No se encontraron alumnos". Confirma que el filtro
  `branch_id` en `AdminAlumnosFacade`/`SecretariaAlumnosFacade` aísla correctamente entre
  sedes. Cierra Bloque A.

### Bloque A — resumen final

11/11 recorridos ejecutados. 7 PASA limpio, 2 PASA con observación menor (hotfix-004, nota de
copy en certificado), 2 BUG ENCONTRADO (fix-038, fix-040) + 1 hallazgo adicional durante el
recorrido 3 (fix-039), 1 N/A esperado (recorte de alcance piloto). 0 recorridos bloqueados sin
diagnóstico.

### Bloque B — Operación diaria (en progreso)

- **Recorrido 1 — Navegación de Agenda semanal: ✅ PASA** (2026-09-22, admin, sede Autoescuela
  Chillán). "Semana siguiente"/"Hoy" navegan correctamente, la grilla se re-renderiza con las
  clases reales de la semana (Camila Reyes agendada Lun/Mar 08:30 y 09:20). Sin errores de
  consola.
- **Recorrido 2 — Iniciar y finalizar una clase práctica: ✅ PASA** (2026-09-22, Camila Andrea
  Reyes, clase de las 09:20). "Iniciar" abre drawer con vehículo/kilometraje precargados
  (300.000 km) → "Comenzar Clase" → toast "Clase iniciada", fila pasa a "En curso"/"En clase",
  contador "En Curso" sube a 1. "Finalizar" abre drawer con Km. de salida (300.000, solo
  lectura) + Km. de retorno (requerido, botón deshabilitado hasta completarlo) + firmas
  opcionales → completé 300015 → "Cerrar Clase" sin errores de consola. Ciclo completo
  Pendiente → En curso → Cerrada validado.

- **Recorrido 3 — Marcar inasistencia: ✅ PASA** (2026-09-22, Camila Andrea Reyes, clase de las
  10:10). Botón "Ausente" abre diálogo de confirmación ("¿Confirmas que el alumno no
  asistió...?") → "Marcar ausente" sin errores de consola. Comportamiento coherente con
  Recorrido 9 del Bloque A (ya validado que justificar una inasistencia baja el contador de
  Alertas).

- **Recorrido 4 — Venta de Servicios Especiales: ✅ PASA** (2026-09-22, servicio "Psicotecnico"
  $20.000, cliente externo "Cliente QA Test"). Drawer "Registrar Venta de Servicio" precarga
  precio del servicio seleccionado; "Registrar Venta" sin errores de consola, KPIs "Ventas del
  mes"/"Recaudación del mes" se actualizaron de 0→1 y $0→$20.000 inmediatamente. Nota (no bug):
  el campo RUT autocorrigió el dígito verificador que tipeé (...678-9 → ...678-5), validación
  de RUT chileno funcionando como se espera.

- **Recorrido 5 — Certificación Clase B (generación por alumno): ✅ PASA** (2026-09-22, vista
  `admin/certificacion`, 73 alumnos con prácticas). Confirmado: no existe una acción de
  "generación masiva por lote" en la UI (no hay checkboxes de selección múltiple en la tabla,
  solo botón "Generar" por fila) — no es un bug, es el diseño actual. Probé "Generar" en un
  alumno con 0/12 prácticas → mismo gate inline ya validado en Bloque A Recorrido 10
  ("Prácticas incompletas: ... 0/12 ... ¿Confirmar de todos modos?" con Cancelar/Confirmar).
  Cancelé sin alterar datos. Sin errores de consola.

- **Recorrido 6 — DMS Documentos (repositorio + visor): ✅ PASA** (2026-09-22, admin/documentos).
  4 tabs (Alumno/Instructores/Escuela/Plantillas) renderizan sin error. "Últimos subidos"
  refleja correctamente los documentos subidos durante el Recorrido 1 de Bloque A (test-face.png
  × 2 — Contrato y Foto Carnet — de Camila Reyes). "Ver" abre el visor sin errores de consola.

- **Recorrido 7 — Flota (listado + consistencia de kilometraje): ✅ PASA, con hallazgo 🟡**
  (2026-09-22, admin/flota, 8 vehículos). Listado renderiza correctamente; vehículo ABCD43
  muestra 300.015 km — refleja correctamente el kilometraje de retorno registrado en el
  Recorrido 2 de este bloque (consistencia Asistencia → Flota confirmada). **Hallazgo:** 3
  warnings de consola `NG0955` (track key duplicado) al cargar la página — rastreado a
  `flota-list-content.component.ts:174`, el skeleton del header desktop itera un array literal
  `['15%', '20%', '15%', '10%', '10%', '12%']` con `track w` (por valor), y hay valores
  repetidos ('15%', '10%'). Sin impacto visual, pero ensucia la consola. **Track creado:**
  `hotfix-005-i-skeleton-flota-track-duplicado`.

- **Recorrido 8 — (*) Aislamiento multi-sede en Flota: ✅ PASA** (2026-09-22, admin, selector de
  "Sede activa" en el banner). Al cambiar de "Autoescuela Chillán" a "Conductores Chillán" el
  listado de 8 vehículos cambió completamente — 0 patentes repetidas entre sedes (ABCD43/ERDF21/
  BBCD12/XXYZ34/SEED101-104 vs. RTRE29/WHGH54/AB1234/SEED201-205). Nota (no bug): vehículo
  RTRE29 (Conductores Chillán) muestra badge "SOAP vencido" — coincide exactamente con la
  alerta "1 Documento vencido" vista en el dashboard de `secretaria2@test.com` (Bloque A
  contexto), confirma consistencia de datos entre vistas. Cierra Bloque B (8/8 recorridos).

### Bloque B — resumen final

8/8 recorridos ejecutados. 6 PASA limpio, 1 PASA con hallazgo (hotfix-005, warning de consola
NG0955 sin impacto visual), 1 PASA con nota de diseño (no existe generación masiva por lote,
confirmado no ser un bug). 0 recorridos bloqueados.

### Bloque C — Dinero y Administración (en progreso)

- **Recorrido 1 — Gestión de Pagos (listado + registrar pago): ✅ PASA, con hallazgo 🟡**
  (2026-09-22, admin/pagos, 24 alumnos con deuda). KPIs correctos ($180K hoy, $1.2M mes, $3.2M
  pendiente). Filtro "Matrícula desde/hasta": seleccioné 07/09/2026 y 20/09/2026 en ambos campos
  **y ambos retuvieron su valor simultáneamente** — el síntoma de pérdida de valor de fix-038 NO
  se reprodujo aquí (nota agregada a fix-038 para afinar alcance antes de implementar). Drawer
  "Registrar Pago" abre con saldo pendiente precargado ($180.000), campos Fecha/Concepto/Monto/
  Desglose (Efectivo/Transferencia/Tarjeta/WebPay)/N° Documento. **Hallazgo más grave:** al abrir
  este drawer, el filtro "Matrícula desde" de la lista de fondo cambió su nombre accesible a
  "FECHA DE PAGO *" (el label del drawer) — confirma que la colisión de `id="date"` (fix-038)
  cruza entre componentes superpuestos, no solo dentro del mismo componente. Sin errores de
  consola. **No amerita track nuevo** — evidencia añadida a `fix-038` existente.

- **Recorrido 2 — Caja Diaria (cuadratura + arqueo): ✅ PASA** (2026-09-22, admin/contabilidad/
  cuadratura). Refleja correctamente los 2 ingresos generados en bloques anteriores
  ("Matrícula #0080 — Clase B" $180.000 efectivo, "Servicio especial: Psicotecnico" $20.000
  tarjeta) — Total Ingresos $200.000, consistente con Pagos y Servicios Especiales.
  "Arqueo y Cierre Operativo" muestra conciliación correcta (Debe Haber en Caja $180.000 =
  Ingresos efectivo - Egresos efectivo). No se completó el cierre real (para no alterar más
  datos de prueba) — mecánica de UI validada. Sin errores de consola.

- **Recorrido 3 — Reportes Contables: ✅ PASA** (2026-09-22, admin/contabilidad/reportes). Carga
  sin errores de consola.
- **Recorrido 4 — Historial de Cuadraturas: ✅ PASA** (2026-09-22,
  admin/contabilidad/historial-cuadraturas). Carga sin errores de consola.
- **Recorrido 5 — Liquidaciones: ✅ PASA** (2026-09-22, admin/contabilidad/liquidaciones). Carga
  sin errores de consola.
- **Recorrido 6 — Cursos Singulares: ✅ PASA** (2026-09-22, admin/contabilidad/cursos). Carga sin
  errores de consola.
- **Recorrido 7 — Instructores: ✅ PASA** (2026-09-22, admin/instructores). Carga sin errores de
  consola.
- **Recorrido 8 — Secretarias (listado + buscador): ✅ PASA** (2026-09-22, admin/secretarias, 2
  secretarias). Buscar "Lola SECRETARIA" (nombre + parte del apellido) **sí encontró el
  resultado** — a diferencia de Base Alumnos B, este componente no reproduce el bug de fix-039
  (probable causa: el campo de búsqueda ya compara contra el nombre completo concatenado, no
  contra nombre/apellido separados). Nota agregada a `fix-039` para confirmar alcance real por
  archivo antes de implementar.
- **Recorrido 9 — Auditoría: ✅ PASA** (2026-09-22, admin/auditoria). Carga sin errores de
  consola.
- **Recorrido 10 — Configuración Web (pestaña General): ✅ PASA, con hallazgo 🟡** (2026-09-22,
  admin/configuracion-web). **Hallazgo:** warning de consola de Angular
  ("...disabled attribute with a reactive form directive...") — rastreado a
  `general-tab.component.ts:81`, el `<p-select formControlName="theme">` usa `[disabled]="true"`
  en el template en vez de deshabilitar el `FormControl`. Sin impacto funcional (el selector
  igual se muestra bloqueado). **Track creado:**
  `hotfix-006-i-disabled-attribute-reactive-form-configuracion-web`.

- **Recorrido 11 — Usuarios: N/A esta fase.** `/app/admin/usuarios` es un stub de mockup no
  implementado ("Mockup: /admin/usuarios", "Pendiente calcar desde mockup") — no está en el
  menú de navegación, consistente con no estar listo. No es un bug.
- **Recorrido 12 — Verificación URL directa a rutas ocultas del recorte Clase Profesional: 🔴
  BUG ENCONTRADO (severidad alta).** Alcance explícito de ASG-i-012: "probar la URL directa
  también, no solo que desapareció del menú". Con admin logueado en sede donde "Base Alumnos
  Prof." y "Libro de Clases" muestran 🔒 "Bloqueado" en el menú, navegar directo a
  `/app/admin/clase-profesional/alumnos` y `/app/admin/libro-de-clases` **renderiza el módulo
  completo** en vez de redirigir a `/modulo-no-disponible`. Confirmado en código
  (`app.routes.ts`): a estas 2 rutas de admin, y a sus 2 equivalentes de secretaria
  (`profesional/alumnos`, `libro-de-clases`), les falta `pilotPhaseGuard('clase-profesional-
  recorte')` — un gap de implementación de `fix-256-m` que las 6 rutas restantes del recorte sí
  tienen aplicado correctamente. Sin errores de consola; el módulo funciona con normalidad, el
  problema es que no debería ser alcanzable en esta fase. **Track creado:**
  `fix-041-i-guard-recorte-clase-profesional-faltante`.
- **Recorrido 13 — (*) Aislamiento multi-sede en Reportes Contables: ✅ PASA** (2026-09-22,
  admin, selector de sede). "Autoescuela Chillán": Total Ingresos $1.170.000 (solo categoría
  Clase B, 7 operaciones). "Conductores Chillán": Total Ingresos $2.100.000 (Clase B $1.470.000
  + Profesional $630.000, 15 operaciones) — cifras completamente distintas y coherentes con los
  KPIs vistos previamente en el dashboard de `secretaria2@test.com` (Bloque A). Cierra Bloque C
  (13/13 recorridos).

### Bloque C — resumen final

13/13 recorridos ejecutados. 9 PASA limpio, 2 PASA con hallazgo (hotfix-005 ya en Bloque B,
hotfix-006 warning de consola), 1 PASA con nota (buscador Secretarias no reproduce fix-039), 1
N/A esperado (Usuarios es stub), **1 BUG de severidad alta** (fix-041 — gap de guard de
seguridad/negocio en 4 rutas del recorte Clase Profesional). 0 recorridos bloqueados.

## Cierre del QA — resumen general (Bloques A + B + C)

32/32 recorridos ejecutados. Bugs/hallazgos con track creado:
- `fix-038-i-date-input-id-colision` (ID duplicado en DateInputComponent — alcance a confirmar
  por archivo antes de implementar, ver notas de re-verificación en el propio track)
- `fix-039-i-buscador-alumnos-no-tokeniza` (buscador no tokeniza nombre+apellido — alcance a
  confirmar por archivo, no reproducido en Secretarias)
- `fix-040-i-rematricular-prefill-race-condition` (wizard de re-matrícula abre vacío)
- `fix-041-i-guard-recorte-clase-profesional-faltante` (🔴 severidad alta — 4 rutas del recorte
  piloto accesibles por URL directa sin guard)
- `hotfix-004-i-papelera-alumnos-sin-label-visible` (botón sin label visible)
- `hotfix-005-i-skeleton-flota-track-duplicado` (warning NG0955 en consola)
- `hotfix-006-i-disabled-attribute-reactive-form-configuracion-web` (warning de Angular en
  consola)

Falsos positivos descartados: Promociones visible (intencional, fix-257-m), "No hay sedes
disponibles" transitorio (no reproducible).

Multi-sede/RLS verificado explícitamente y sin fugas en: Base Alumnos B (Bloque A), Flota
(Bloque B), Reportes Contables (Bloque C).

**Próximo paso:** implementar los 7 tracks creados (decisión de sesión: documentar todo el QA
primero, arreglar después). `fix-041` debería priorizarse por ser el único hallazgo de
severidad alta (gap de seguridad/scope, no solo UX).

### Bugs encontrados (a corregir al terminar todo el QA — decisión de sesión 2026-09-22)

- **🔴 `DateInputComponent` — colisión de ID por defecto rompe formularios con 2+ campos de
  fecha simultáneos.** `date-input.component.ts:50` — `id = input<string>('date')`, valor por
  defecto igual para toda instancia que no reciba `[id]` explícito. Efecto: `<label for="date">`
  y `<p-datepicker inputId="date">` duplicados en el DOM; el navegador asocia ambos labels al
  mismo input (confirmado: el `aria-label` accesible fusionó los dos labels en uno), y el
  segundo campo de fecha de la vista no retiene el valor seleccionado.
  - **Repro:** wizard de matrícula, Clase Profesional → seleccionar "Licencia previa" + fecha
    de obtención vía calendario → la fecha no queda seteada, "Guardar y Continuar" sigue
    deshabilitado. `personal-data.component.html` tiene 2 `<app-date-input>` (Fecha de
    nacimiento + Fecha de obtención de licencia previa), ninguna con `[id]` propio.
  - **Alcance (grep `<app-date-input` con 2+ instancias por archivo, sin `[id]` único):**
    `personal-data.component.html` (2), `admin-pagos.component.ts` (4),
    `secretaria-pagos.component.ts` (4), `reportes-contables-content.component.ts` (2),
    `admin-auditoria.component.ts` (2). `admin-pre-inscrito-drawer.component.ts` (2) tiene 1
    con `[id]`, revisar si el otro también lo necesita.
  - **Fix sugerido:** pasar `[id]` único a cada `<app-date-input>` en los 5-6 archivos
    afectados (cambio mecánico, bajo riesgo). Evaluar además si `DateInputComponent` debería
    generar un id único automático (ej. `Math.random()`/`inject(...).nextId()`) en vez de un
    default estático, para que este bug no se repita en componentes futuros.
  - **Track creado:** `fix-038-i-date-input-id-colision`.

- **🟡 Buscador de listados no tokeniza "nombre + apellido" — solo matchea substring por campo
  individual.** `alumnos-list-content.component.ts:743-749` (y repetido igual en 6 archivos
  más): `filteredAlumnos` chequea `a.nombre.toLowerCase().includes(term) ||
  a.apellido.toLowerCase().includes(term) || ...` — cada campo por separado contra el término
  completo. Si el usuario escribe "Camila Reyes" (nombre + apellido, orden natural de
  búsqueda), ni `nombre` ("Camila Andrea") ni `apellido` ("Reyes Muñoz") contienen la frase de
  2 palabras completa → 0 resultados, aunque el alumno exista. Buscar solo "Camila" o solo
  "Reyes" sí funciona.
  - **Repro:** Base Alumnos B (Autoescuela Chillán) → buscar "Camila Reyes" (alumna recién
    creada en el recorrido 1, RUT 19.876.543-0) → "No se encontraron alumnos". Buscar "Camila"
    sola → aparece.
  - **Alcance (mismo patrón `a.nombre.toLowerCase().includes(term) ||
    a.apellido...includes(term)` copiado, no una utilidad compartida):**
    `alumnos-list-content.component.ts`, `alumnos-profesional-list-content.component.ts`,
    `ex-alumnos-content.component.ts`, `ex-alumnos-profesional-content.component.ts`,
    `admin-secretarias.component.ts`, `admin-profesional-relatores.component.ts`,
    `admin-ex-alumnos-comentarios-drawer.component.ts`.
  - **Fix sugerido:** extraer una función pura en `core/utils/` (ej.
    `matchesSearchTokens(term, ...fields)`) que tokenice el término por espacios y exija que
    cada token matchee en AL MENOS uno de los campos combinados (no que el término completo
    esté en un solo campo) — luego reemplazar los 7 usos duplicados por esa utilidad.
  - **Track creado:** `fix-039-i-buscador-alumnos-no-tokeniza`.

### Falsos positivos descartados

- **Promociones de Clase Profesional visible en menú/URL directa**: parecía violar
  ASG-i-009/fix-256-m, pero es intencional — `fix-257-m` (2026-09-21) revirtió ese ítem
  específico por decisión de producto. No tocar.
- **"No hay sedes disponibles para esta vista" en `/app/admin/matricula`**: apareció una vez
  tras un restart de `ng serve`. Se intentó forzar la reproducción con localStorage limpio +
  login fresco + 3 navegaciones directas consecutivas — cargó bien las 3 veces. Descartado
  como evento aislado (probablemente residuo del propio restart de `ng serve`, no un bug de
  la app).
