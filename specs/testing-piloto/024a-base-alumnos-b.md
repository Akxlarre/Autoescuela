# Testing — Base de Alumnos Clase B (lista)

> **Asignación:** `ASG-i-024` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/alumnos`, `/app/secretaria/alumnos`
> **Incluye:** la lista, Papelera, modal de archivar, drawer "Por vencer", exportar lista
> (Excel/PDF), exportar ficha PDF, apertura de "Nueva Matrícula".
> **No incluye:** la ficha del alumno por dentro y Ex-Alumnos (ver `024b-ficha-ex-alumnos.md`),
> el wizard de matrícula por dentro (ver `023-matricula-presencial.md`).
>
> **Código leído para armar esta lista:**
> `features/admin/alumnos/admin-alumnos.component.ts`,
> `features/secretaria/alumnos/secretaria-alumnos.component.ts`,
> `shared/components/alumnos-list-content/`, `shared/components/alumno-card/`,
> `shared/components/eliminar-alumno-modal/`, `shared/components/alumnos-por-vencer-drawer/`,
> `core/facades/admin-alumnos.facade.ts`, `core/utils/{branch-scope,search-filter,alumno-status}.utils.ts`,
> `supabase/functions/export-students/`, `supabase/functions/generate-enrollment-sheet/`.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-024`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S12)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Exportar lista filtra datos de otras sedes.** La edge function usa la clave de servicio (salta RLS) y filtra por el `branch_id` que manda el navegador; solo verifica que haya un usuario logueado, no su rol ni su sede. Una secretaria (o cualquier usuario logueado) podría pedir `branch_id: null` y obtener RUT/email/teléfono de todas las sedes. | `supabase/functions/export-students/index.ts:319,326-344` |
| S2 | 🔴 Alta | **Ficha PDF sin control de permisos.** No verifica rol ni sede: cualquier usuario con sesión podría pedir la ficha de cualquier matrícula cambiando `enrollment_id`. | `supabase/functions/generate-enrollment-sheet/index.ts:34-59` |
| S3 | 🟠 Media | **La exportación no coincide con la pantalla.** No excluye alumnos solo-Profesional, finalizados, solo-borrador/cancelados ni de curso singular; no conoce el estado "Docs Pendientes"; calcula el expediente con 4 documentos y el nombre viejo `foto_carnet` (un alumno nuevo nunca sale "Completo"); busca sin ignorar tildes ni tokenizar; y **desde la Papelera exporta los activos** (no recibe la vista). | `export-students/index.ts:74-144,339` vs `admin-alumnos.facade.ts:384-412` |
| S4 | 🟠 Media | **KPI "Por Vencer" siempre 0 y drawer siempre vacío.** Se calcula con `enrollments.expires_at`, que por constraint solo existe en matrículas `draft`, y la lista excluye los drafts. El drawer habla de "cuotas" (no es lo que mide) y su botón "Contactar" no tiene acción. | `admin-alumnos.facade.ts:112-114,384`; migración `20260301000002…:64-65`; `alumnos-por-vencer-drawer.component.ts:54-62` |
| S5 | 🟠 Media | **Tiempo real probablemente muerto.** El canal escucha `students` y `enrollments`; `enrollments` no aparece en ninguna migración que la agregue a `supabase_realtime`. Mismo patrón de `fix-227-m`: una tabla no publicada deja mudo todo el canal. | `admin-alumnos.facade.ts:119-134` |
| S6 | 🟡 Baja-Media | **Secretaria con grant multi-sede:** su pantalla no recarga al cambiar de sede (la de admin sí tiene el `effect`) y nunca muestra la columna Sede aunque elija "Todas". | `secretaria-alumnos.component.ts:62-65` vs `admin-alumnos.component.ts:33,69-72` |
| S7 | 🟡 Baja | **La Papelera "se pega":** la vista vive en el facade singleton y nunca se resetea al salir; al volver a la pantalla podrías seguir en la Papelera. | `admin-alumnos.facade.ts:91,200-205` |
| S8 | 🟡 Baja | **Un error de carga no se muestra:** el facade guarda el error, pero la pantalla no lo usa; se ve "No se encontraron alumnos · Limpiar filtros". | `admin-alumnos.facade.ts:175-176`; `alumnos-list-content` no lee `error` |
| S9 | 🟡 Baja | **Fecha de ingreso en UTC:** `created_at.slice(0,10)`; una matrícula hecha de noche en Chile aparece con la fecha del día siguiente. (La exportación tiene el mismo problema.) | `admin-alumnos.facade.ts:472`; `export-students/index.ts:118` |
| S10 | 🟡 Baja | **El modal de archivar se cierra con Escape/clic afuera aunque esté archivando.** Y un alumno matriculado normalmente siempre cae en "con historial" (tiene 12 sesiones agendadas). | `eliminar-alumno-modal.component.ts:74-75,234-237`; `admin-alumnos.facade.ts:301-326` |
| S11 | 🟡 Baja | **"Con deuda" y saldo solo miran la matrícula B más reciente.** Deuda en una matrícula B anterior no cuenta. | `admin-alumnos.facade.ts:448,475` |
| S12 | 🟡 Baja | **Filtro Curso con opciones fijas** ("Clase B", "Clase B SENCE"). Si el curso de refuerzo u otro curso B tiene otro nombre, no se puede filtrar. | `alumnos-list-content.component.ts:690-693` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente con el seed de spec `0008-i` + ajustes). Anotar acá el
nombre/RUT real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Alumno usado |
|---|---|---|---|
| D1 | Clase B activo, pagado, con CI y foto, con pagos y clases | Caso "todo OK", archivar con historial | |
| D2 | Activo con `payment_status = pending` / saldo > 0 | "Pendiente Pago", KPI Con deuda | |
| D3 | Activo con `docs_complete = false` | "Docs Pendientes" | |
| D4 | Matrícula `withdrawn` | "Retirado" | |
| D5 | Matrícula `completed` | NO debe aparecer | |
| D6 | Solo matrícula Profesional | NO debe aparecer | |
| D7 | Clase B + Profesional | Aparece solo con datos de B | |
| D8 | 2 matrículas B (regular + refuerzo), deuda en la más antigua | Varios Nº exp., S11 | |
| D9 | Solo `draft`, `cancelled` o `pending_payment` | NO debe aparecer | |
| D10 | Alumno sin matrículas (uno `active`, uno `inactive`), sin pagos ni clases | "Pre-inscrito"/"Inactivo", archivar sin historial | |
| D11 | Solo curso singular | NO debe aparecer | |
| D12 | Alumno archivado | Solo en Papelera | |
| D13 | 12/12 prácticas evaluadas + certificado enviado por email, aún activo | Etiqueta "Curso completo" | |
| D14 | Nombre con tilde y ñ, sin apellido materno, nombre muy largo | Búsqueda y diseño | |
| D15 | Alumnos en sede A y en sede B | Aislamiento entre sedes | |
| D16 | Solo CI / solo foto / foto legacy `foto_carnet` / ninguno | Expediente Parcial/Completo/Pendiente | |
| D17 | > 10 alumnos (idealmente > 100) | Paginación y rendimiento | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); secretaria sin sede asignada (para P07).

---

## 3. Casos

### A. Carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/alumnos` | Skeleton → tabla. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/alumnos` | Igual, solo alumnos de su sede | ✓ | |
| A03 | Secretaria escribe la URL `/app/admin/alumnos` | Acceso denegado | ✓ | |
| A04 | Salir de la pantalla y volver | Datos al instante, sin skeleton (refresco en segundo plano) | — | |
| A05 | Recargar con F5 | Carga normal | ✓ | |
| A06 | Menú lateral → Alumnos B | Llega a la pantalla correcta | ✓ | |
| A07 | Carga con red lenta (DevTools → Slow 3G) | El skeleton tiene la forma de la tabla final, sin saltos | — | |
| A08 | Carga con la red cortada **(§4)** | Mensaje de error claro (S8) | — | |

### B. Qué alumnos aparecen

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | D1, D2, D3, D4, D8, D10 | Aparecen | ✓ | |
| B02 | D5 (finalizado) | No aparece; está en Ex-Alumnos | ✓ | |
| B03 | D6 (solo Profesional) | No aparece | ✓ | |
| B04 | D7 (B + Profesional) | Aparece con curso, Nº y estado de B solamente | ✓ | |
| B05 | D9 (draft / cancelada / pago online pendiente) | No aparece | ✓ | |
| B06 | D11 (curso singular) | No aparece | ✓ | |
| B07 | D12 (archivado) | No aparece en la lista normal | ✓ | |
| B08 | Orden | Del alumno creado más recientemente al más antiguo | — | |
| B09 | Un alumno termina su curso y se marca como ex-alumno **(§4)** | Desaparece de la Base y aparece en Ex-Alumnos | — | |
| B10 | Matricular un alumno nuevo | Aparece primero en la lista | ✓ | |

### C. Datos de cada fila

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Avatar | Iniciales correctas (nombre + apellido) | — | |
| C02 | Columna Alumno | "Apellidos Nombres" + email debajo | ✓ | |
| C03 | Sin apellido materno (D14) | Sin espacios sobrantes ni "undefined" | — | |
| C04 | RUT | Con formato chileno | ✓ | |
| C05 | Nº Exp. con 2 matrículas (D8) | Muestra los 2 números | ✓ | |
| C06 | Nº Exp. sin número (D10) | "—" | — | |
| C07 | Curso | Badge con el nombre del curso B | ✓ | |
| C08 | Fecha de ingreso de una matrícula creada después de las 21:00 (hora Chile) | Fecha correcta de Chile (S9) | — | |
| C09 | Estado de D1, D2, D3, D4, D10 | Activo / Pendiente Pago / Docs Pendientes / Retirado / Pre-inscrito o Inactivo, cada uno con su color | ✓ | |
| C10 | D13 | Etiqueta extra "Curso completo" con tooltip | — | |
| C11 | Expediente de cada caso de D16 | Completo 2/2 · Parcial 1/2 · Pendiente 0/2. La foto legacy cuenta como foto | ✓ | |
| C12 | Tooltip del expediente | CI / Foto / Médico / SEMEP coinciden con los documentos reales | — | |
| C13 | Nombre muy largo (D14) | No rompe la fila | — | |

### D. Encabezado y KPIs

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Chip "N alumnos" | Igual al total de la lista | ✓ | |
| D02 | KPI Total | Igual al total | ✓ | |
| D03 | KPI Activos | Cuenta solo estado "Activo" (no Pendiente Pago ni Docs Pendientes) — confirmar que esa es la regla deseada | ✓ | |
| D04 | KPI Con deuda **(§4)** | Coincide con los alumnos con saldo pendiente (S11) | ✓ | |
| D05 | KPI Por Vencer | Hoy siempre 0 (S4). **Decisión pendiente:** qué debe medir | ✓ | |
| D06 | Clic en KPI Por Vencer | Abre el drawer (ver N) | — | |
| D07 | Aplicar filtros | Hoy los KPIs NO cambian (cuentan el total) — confirmar si es lo deseado | — | |
| D08 | KPIs dentro de la Papelera | Cuentan archivados — ¿tiene sentido? | — | |

### E. Búsqueda

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Por nombre | Encuentra | ✓ | |
| E02 | Por apellido paterno y por materno | Encuentra | ✓ | |
| E03 | "nombre apellido" y "apellido nombre" | Encuentra en ambos órdenes | ✓ | |
| E04 | Sin tilde ("jose" → José, "nunez" → Núñez) | Encuentra | ✓ | |
| E05 | En mayúsculas | Encuentra | ✓ | |
| E06 | RUT en 4 formatos **(§4)** | Encuentra en todos (probable falla sin puntos) | ✓ | |
| E07 | Nº de expediente | Encuentra | ✓ | |
| E08 | Email | El buscador no busca por email — confirmar que es aceptable | — | |
| E09 | Espacios al inicio/fin y dobles | Los ignora | ✓ | |
| E10 | Texto sin resultados | Estado vacío con "Limpiar filtros" | ✓ | |
| E11 | Buscar estando en la página 3 | Vuelve a la página 1, sin quedar en una página vacía | — | |

### F. Filtros

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Curso = Clase B | Solo esos | ✓ | |
| F02 | Curso = Clase B SENCE | Solo esos (¿existen datos SENCE?) | ✓ | |
| F03 | Alumno de refuerzo (D8) con filtro de curso | ¿Se puede filtrar? (S12) | — | |
| F04 | Cada una de las 6 opciones de Estado | Solo alumnos de ese estado | ✓ | |
| F05 | Estado = Pre-inscrito / Inactivo | Solo D10 | ✓ | |
| F06 | Expediente = Completo / Parcial / Pendiente | Coincide con la columna | ✓ | |
| F07 | Búsqueda + 3 filtros combinados **(§4)** | Intersección correcta | ✓ | |
| F08 | Volver un filtro a "Todos" | ¿Se puede sin recargar? (el select no tiene botón de limpiar) | — | |
| F09 | "Limpiar filtros" en el estado vacío | Resetea búsqueda y los 3 filtros | ✓ | |
| F10 | Salir y volver a la pantalla | ¿Se conservan o se resetean los filtros? — decisión | — | |
| F11 | Filtros activos → Papelera → volver | Comportamiento coherente | — | |

### G. Tabla y paginación

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | > 10 alumnos | 10 por página, "Mostrando 1 a 10 de N" correcto | ✓ | |
| G02 | Navegar páginas, incluida la última | Sin filas repetidas ni faltantes | ✓ | |
| G03 | Ordenar por columna | No existe — confirmar que es aceptable | — | |
| G04 | > 100 alumnos | Sin lentitud visible | — | |
| G05 | Desktop | La tabla scrollea por dentro; el documento no (app-like) | ✓ | |

### H. Vista de tarjetas (móvil / pantalla angosta)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | 375 px | Tarjetas en vez de tabla; sin scroll horizontal | ✓ | |
| H02 | Desktop con un drawer abierto (contenedor < 900 px) | Cambia a tarjetas | — | |
| H03 | Contenido de la tarjeta | Mismos datos que la fila | — | |
| H04 | "Cargar más" y filtros **(§4)** | Suma de a 6; al filtrar vuelve a 6 | ✓ | |
| H05 | Botones de la tarjeta (ver, PDF, archivar, restaurar) | Hacen lo mismo que en la tabla | ✓ | |
| H06 | Nombre/email largo | Truncado con tooltip | — | |
| H07 | Tamaño táctil | Botones cómodos para el dedo | — | |

### I. Ver ficha

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Ojo (admin) | Abre `/app/admin/alumnos/:id` del alumno correcto | ✓ | |
| I02 | Ojo (secretaria) | Abre `/app/secretaria/alumnos/:id` | ✓ | |
| I03 | Volver desde la ficha | Vuelve a la lista (¿conserva página y filtros?) | — | |

### J. Exportar ficha PDF

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Clic en el ícono de descarga | Spinner solo en esa fila → `Ficha_Matricula_<id>_<fecha>.pdf` | ✓ | |
| J02 | Contenido del PDF | Datos, pagos y progreso iguales a la ficha real | — | |
| J03 | D7 (B + Profesional) | Genera la ficha de la matrícula B | — | |
| J04 | D10 (sin matrícula) | Hoy el botón no hace nada ni avisa — ¿debería estar deshabilitado? | — | |
| J05 | Clic rápido en 2 filas | ¿Se descargan ambas? Spinner coherente | — | |
| J06 | La función falla | Toast de error; el botón vuelve a la normalidad | — | |
| J07 | **Seguridad (S2)** **(§4)** | Una secretaria no obtiene fichas de otra sede | ✓ | |

### K. Exportar lista (Excel / PDF)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Abrir el menú y cerrarlo con clic afuera | Se cierra | — | |
| K02 | Excel sin filtros | Descarga `alumnos_<fecha>.xlsx` | ✓ | |
| K03 | PDF sin filtros | Descarga PDF con páginas y total | ✓ | |
| K04 | Cantidad del archivo = cantidad en pantalla **(§4)** | Iguales (S3) | ✓ | |
| K05 | Exportar con cada filtro | El archivo respeta el filtro | ✓ | |
| K06 | Estado = Docs Pendientes | Hoy sale vacío (S3) | ✓ | |
| K07 | Expediente = Completo | Hoy vacío o distinto (S3) | ✓ | |
| K08 | Búsqueda con tilde o "nombre apellido" | Mismo resultado que la pantalla (S3) | ✓ | |
| K09 | Exportar desde la Papelera **(§4)** | Debe exportar los archivados (S3) | ✓ | |
| K10 | Admin "Todas" / admin una sede / secretaria | Solo la sede que corresponde | ✓ | |
| K11 | **Seguridad (S1)** **(§4)** | La secretaria no puede exportar otras sedes | ✓ | |
| K12 | Tildes y ñ en el PDF | Se ven bien (la fuente estándar del PDF podría no soportarlas) | — | |
| K13 | Nombres largos en el PDF | Se cortan prolijamente | — | |
| K14 | Botón mientras exporta | Deshabilitado con spinner, sin cambiar de ancho | — | |
| K15 | La función falla | Toast de error | — | |

### L. Archivar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Archivar D10 (sin historial) **(§4)** | Modal simple de confirmación | ✓ | |
| L02 | Archivar D1 (con historial) **(§4)** | Modal con advertencia contable y campo "borrarlo" | ✓ | |
| L03 | Escribir mal ("borrar", "borrarl") | Botón deshabilitado + mensaje de error | ✓ | |
| L04 | "BORRARLO" y "  borrarlo  " | Los acepta (así está programado) — confirmar | — | |
| L05 | Cancelar con botón, Escape y clic afuera | Se cierra sin archivar | ✓ | |
| L06 | Escape / clic afuera mientras dice "Archivando…" **(§4)** | No debería cerrarse (S10) | — | |
| L07 | Reabrir el modal después de haber escrito | Campo vacío | — | |
| L08 | Foco al abrir | El cursor queda en el campo de texto | — | |
| L09 | Archivar un alumno con clases futuras agendadas | ¿Qué pasa con esos cupos en la Agenda? — **decisión de negocio** | — | |
| L10 | Auditoría | Queda registro con usuario, fecha y alumno | — | |
| L11 | Reportes contables después de archivar | Los pagos históricos siguen contando | — | |
| L12 | Falla de red al archivar | Toast de error; el alumno sigue en la lista | — | |
| L13 | Doble clic rápido en el tacho | No se abren 2 modales ni se consulta 2 veces | — | |

### M. Papelera y restaurar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Ciclo completo archivar → Papelera → restaurar **(§4)** | El alumno vuelve con todos sus datos | ✓ | |
| M02 | Filas en la Papelera | Solo botón Restaurar | ✓ | |
| M03 | Volver con "← Alumnos" y con el botón Papelera | Vuelve a la lista activa | ✓ | |
| M04 | Papelera → otra pantalla → volver **(§4)** | Abre la lista activa (S7) | — | |
| M05 | Buscar y filtrar dentro de la Papelera | Funcionan | — | |
| M06 | Papelera vacía | Hoy dice "No se encontraron alumnos · Limpiar filtros" — texto confuso | — | |
| M07 | Papelera por sede | La secretaria solo ve archivados de su sede | ✓ | |
| M08 | Restaurar un alumno cuya matrícula ya terminó | ¿Vuelve a la Base o a Ex-Alumnos? | — | |
| M09 | Falla al restaurar | Toast de error | — | |

### N. Drawer "Por vencer"

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Clic en el KPI | Abre "Alumnos con Cuotas por Vencer" | — | |
| N02 | Contenido | Hoy siempre vacío (S4) — definir qué debe listar | — | |
| N03 | Botón "Contactar" | Hoy no hace nada (S4) | — | |
| N04 | Clic en el KPI mientras la lista carga | No se abre (así está programado) | — | |

### O. Nueva matrícula desde esta pantalla

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | "Nueva Matrícula" (admin y secretaria) | Wizard en drawer; la tabla pasa a modo compacto | ✓ | |
| O02 | Cerrar el drawer a mitad del wizard **(§4)** | ¿Avisa que se pierde lo avanzado? | — | |
| O03 | Completar la matrícula en el drawer **(§4)** | El alumno nuevo aparece en la lista sin recargar | ✓ | |
| O04 | Admin con "Todas las sedes" | ¿En qué sede queda la matrícula? | — | |
| O05 | Botón disponible dentro de la Papelera | ¿Tiene sentido ahí? | — | |

### P. Sedes y roles

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | Admin "Todas las sedes" | Columna Sede visible, alumnos de todas | ✓ | |
| P02 | Admin cambia de sede **(§4)** | Recarga sola, solo esa sede, sin columna Sede | ✓ | |
| P03 | Cambio rápido A→B→A **(§4)** | Termina en A sin mezclar datos | ✓ | |
| P04 | Total de "Todas" | Suma de las sedes | ✓ | |
| P05 | Secretaria sin grant | Solo su sede, sin columna ni selector | ✓ | |
| P06 | Secretaria con grant cambia de sede **(§4)** | Recarga y muestra columna Sede en "Todas" (S6) | — | |
| P07 | Secretaria sin sede asignada | Lista vacía, nunca todas las sedes | — | |
| P08 | **RLS** **(§4)** | La secretaria A no lee alumnos de la sede B desde la consola | ✓ | |

### Q. Tiempo real

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | 2 sesiones: matricular en A **(§4)** | Aparece en B sin recargar (S5) | ✓ | |
| Q02 | 2 sesiones: archivar/restaurar en A **(§4)** | Se actualiza en B | ✓ | |
| Q03 | Registrar un pago en A | ¿Cambian "Con deuda" y el estado en B? | — | |
| Q04 | Subir un documento en A | El expediente en B no escucha documentos: solo se actualiza al recargar — confirmar si es aceptable | — | |
| Q05 | Salir de la pantalla | Se cierra el canal (DevTools → WS, sin conexión colgada) | — | |
| Q06 | Admin y secretaria abiertos a la vez | Sin cruce de datos entre sedes | — | |

### R. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | Modo oscuro y claro | Todo legible, incluidos badges y modal | ✓ | |
| R02 | 375 / 768 / 1440 px | Sin scroll horizontal | ✓ | |
| R03 | Solo teclado (Tab) | Se llega a todos los botones; el foco se ve | — | |
| R04 | Tooltips | Presentes en todos los botones de solo ícono | — | |
| R05 | Animación de entrada | Sin parpadeos ni saltos | — | |

---

## 4. Casos con pasos numerados

### A08 — Error de carga visible

**Precondición:** sesión admin.
1. Abrir DevTools → Network → marcar "Offline".
2. Navegar a Alumnos B (o recargar si ya se está ahí).
3. Verificar qué se muestra cuando termina el skeleton.
4. Volver a "No throttling" y recargar.

**Esperado:** en el paso 3 un mensaje de error claro (no "No se encontraron alumnos · Limpiar
filtros"). En el paso 4 la lista carga normal. **Evidencia:** captura del paso 3.

### B09 — Egreso: el alumno pasa de la Base a Ex-Alumnos

**Precondición:** D13 (12/12 + certificado enviado), visible en la Base con "Curso completo".
1. En la Base, anotar el total del chip "N alumnos".
2. Abrir la ficha de D13 → "Marcar como Ex-Alumno" → confirmar.
3. Volver a la Base.
4. Verificar que D13 ya no aparece y que el total bajó en 1.
5. Abrir Ex-Alumnos y buscar D13.

**Esperado:** D13 aparece en Ex-Alumnos con sus datos correctos.

### D04 — KPI Con deuda con 2 matrículas

**Precondición:** D8 con la deuda en la matrícula B más antigua; la más reciente pagada.
1. Anotar el KPI "Con deuda".
2. Contar a mano, en Pagos o en las fichas, cuántos alumnos de la sede tienen saldo pendiente en
   cualquier matrícula B.
3. Comparar.

**Esperado:** ambos números iguales. Si D8 no se cuenta, se confirma S11.

### E06 — Buscar por RUT en distintos formatos

**Precondición:** alumno con RUT conocido, por ejemplo 12.345.678-9.
1. Buscar `12.345.678-9`.
2. Buscar `12345678-9`.
3. Buscar `123456789`.
4. Buscar `12345678`.
5. Buscar `12.345` (parcial).

**Esperado:** el alumno aparece en los 5. Anotar cuáles fallan.

### F07 — Búsqueda + filtros combinados

**Precondición:** datos D1–D4, D16.
1. Estado = Activo.
2. Expediente = Parcial.
3. Curso = Clase B.
4. Escribir en el buscador parte del apellido de un alumno que cumpla los 3 filtros.
5. Cambiar el Estado a Retirado.
6. Clic en "Limpiar filtros" en el estado vacío.

**Esperado:** en el paso 4 solo aparecen los alumnos que cumplen todo; en el paso 5 los que
cumplen la nueva combinación (o el estado vacío); en el paso 6 la lista completa y los 4 controles
vuelven a "Todos"/vacío.

### H04 — "Cargar más" en tarjetas

**Precondición:** D17 (> 20 alumnos), ventana de 375 px.
1. Verificar que se ven 6 tarjetas y el botón "Cargar más (N restantes)".
2. Clic en "Cargar más" → verificar 12 tarjetas y que N bajó en 6.
3. Repetir hasta que desaparezca el botón → verificar que la última tarjeta es el último alumno.
4. Escribir algo en el buscador.
5. Borrar la búsqueda.

**Esperado:** en los pasos 4 y 5 la vista vuelve a 6 tarjetas y el contador se recalcula sobre el
total filtrado.

### J07 — Seguridad: ficha PDF de otra sede (S2)

**Precondición:** sesión de secretaria de la sede A; conocer el `enrollment_id` de una matrícula de
la sede B (por ejemplo, desde la sesión de admin).
1. Con la sesión de la secretaria, abrir DevTools → Console.
2. Invocar la función con el id de la sede B. El cliente de Supabase no es global: la forma más
   simple es clicar "Exportar Ficha PDF" en un alumno propio, copiar esa petición desde Network
   ("Copy as fetch") y cambiar `enrollment_id` en el body.
3. Ejecutar la petición.

**Esperado:** respuesta 403 o error, **nunca** un PDF. Si devuelve el PDF, S2 confirmada →
reportar como P0 de inmediato.

### K04 — El archivo exportado coincide con la pantalla

**Precondición:** datos D1–D17 cargados; sesión admin con una sede elegida.
1. Sin filtros, anotar el total de la pantalla ("Mostrando … de N").
2. Exportar Excel.
3. Contar las filas del Excel.
4. Buscar en el Excel a D5, D6, D9 y D11.
5. Repetir con Estado = Docs Pendientes y con Expediente = Completo.

**Esperado:** mismos totales y ninguno de D5, D6, D9 ni D11 en el Excel. Anotar cada diferencia (S3).

### K09 — Exportar desde la Papelera

**Precondición:** al menos 1 alumno archivado (D12).
1. Entrar a la Papelera.
2. Exportar Excel.
3. Revisar el contenido.

**Esperado:** el Excel contiene solo archivados. Si contiene los activos, S3 confirmada.

### K11 — Seguridad: exportar otras sedes (S1)

**Precondición:** sesión de secretaria de la sede A.
1. En la Base, exportar Excel y copiar la petición `export-students` desde Network ("Copy as fetch").
2. En Console, pegarla cambiando `branch_id` a `null` y ejecutarla.
3. Repetir con el id de la sede B.

**Esperado:** error o 403, o como mínimo solo alumnos de la sede A. Si trae alumnos de otra sede,
S1 confirmada → **P0 inmediato** (expone RUT, email y teléfono).

### L01 — Archivar sin historial

**Precondición:** D10 (sin pagos ni clases).
1. Buscar D10 → clic en el tacho.
2. Verificar el modal "Archivar alumno" con la pregunta y el nombre correcto.
3. Clic en "Archivar".
4. Verificar toast de éxito, que D10 desapareció y que los KPIs se actualizaron.

**Esperado:** como arriba. Si no existe ningún alumno así en datos normales, anotarlo (S10: todo
matriculado cae en "con historial").

### L02 — Archivar con historial

**Precondición:** sesión de secretaria de la sede A; D1 (con pagos y clases).
1. Ir a Alumnos (menú lateral).
2. Buscar D1.
3. Clic en el tacho rojo de su fila.
4. Verificar el modal "Archivar con historial" con la advertencia de reportes contables.
5. Verificar que "Archivar" está deshabilitado.
6. Escribir `borrar` → verificar el mensaje "Escribe exactamente 'borrarlo'…" y el botón deshabilitado.
7. Borrar y escribir `borrarlo` → verificar que el botón se habilita.
8. Clic en "Archivar" → verificar "Archivando…" y luego el toast de éxito.
9. Verificar que D1 ya no está en la lista y que el KPI Total bajó en 1.
10. Abrir la Papelera → verificar que D1 está ahí.

**Evidencia:** captura del paso 9.

### L06 — Cerrar el modal mientras archiva

**Precondición:** D1; DevTools → Network → Slow 3G (para que "Archivando…" dure).
1. Abrir el modal de archivar de D1 y escribir `borrarlo`.
2. Clic en "Archivar".
3. Mientras dice "Archivando…", presionar Escape.
4. Esperar a que termine la petición.

**Esperado:** el modal no se cierra en el paso 3, o si se cierra, al final D1 queda archivado con
toast de éxito y la pantalla queda coherente. Anotar el comportamiento (S10).

### M01 — Ciclo archivar → Papelera → restaurar

**Precondición:** D1 activo, con datos anotados (saldo, Nº exp., estado, expediente).
1. Archivar D1 (como L02).
2. Clic en "Papelera" → buscar D1 → verificar que solo tiene el botón Restaurar.
3. Clic en Restaurar → verificar toast y que D1 desaparece de la Papelera.
4. Volver con "← Alumnos".
5. Buscar D1 y abrir su ficha.

**Esperado:** D1 vuelve con exactamente los mismos datos anotados (saldo, Nº, estado, expediente,
clases).

### M04 — La Papelera no debe "pegarse"

1. Entrar a la Papelera.
2. Ir por el menú a otra pantalla (por ejemplo, Agenda).
3. Volver a Alumnos por el menú.

**Esperado:** se abre la lista activa, no la Papelera (S7).

### O02 — Cerrar la nueva matrícula a medias

1. En la Base, clic en "Nueva Matrícula".
2. Completar el paso 1 (datos personales) y avanzar al 2.
3. Cerrar el drawer (X o clic afuera).
4. Volver a abrir "Nueva Matrícula".

**Esperado:** en el paso 3, aviso de que se perderá lo avanzado o se guarda el borrador; en el
paso 4, se ofrece retomar el borrador o el wizard está limpio de forma coherente. Revisar además
que no quedó un alumno "a medias" en la lista.

### O03 — Matrícula desde el drawer aparece en la lista

1. Anotar el total de la Base.
2. "Nueva Matrícula" → completar una matrícula Clase B completa.
3. Cerrar el drawer.

**Esperado:** el alumno nuevo aparece primero en la lista, sin recargar, y el total subió en 1.

### P02 — Admin cambia de sede

**Precondición:** sesión admin, alumnos en ambas sedes (D15).
1. Selector de sede → "Todas" → anotar el total y verificar la columna Sede.
2. Elegir la sede A → anotar el total y verificar que no hay columna Sede y que todos son de A.
3. Elegir la sede B → lo mismo.

**Esperado:** la lista recarga sola cada vez y el total de "Todas" es igual a A + B.

### P03 — Cambio rápido de sede

**Precondición:** DevTools → Slow 3G.
1. Elegir la sede A, inmediatamente la B e inmediatamente la A (sin esperar las cargas).
2. Esperar a que termine todo.

**Esperado:** la lista final corresponde a la sede A; ningún alumno de B.

### P06 — Secretaria con grant multi-sede

**Precondición:** secretaria con `can_access_both_branches = true`.
1. Entrar a Alumnos B.
2. En el selector de sede, cambiar a la otra sede.
3. Cambiar a "Todas".

**Esperado:** la lista recarga en los pasos 2 y 3 sin tener que salir de la pantalla; en "Todas"
se ve la columna Sede (S6).

### P08 — RLS por sede

**Precondición:** sesión de secretaria de la sede A; id de un alumno de la sede B.
1. En Alumnos B, copiar desde Network cualquier petición a `/rest/v1/students` ("Copy as fetch").
2. En Console, pegarla cambiando el filtro para pedir el alumno de la sede B (o quitar el filtro
   `users.branch_id`).
3. Ejecutarla.

**Esperado:** 0 filas de la sede B. Si aparecen, fuga de datos → **P0 inmediato**.

### Q01 — Tiempo real: alumno nuevo

**Precondición:** 2 navegadores o perfiles distintos (no 2 pestañas del mismo: comparten sesión),
ambos con Alumnos B abierta en la misma sede.
1. En el navegador A, matricular un alumno nuevo.
2. Sin tocar el navegador B, esperar 5 segundos.

**Esperado:** el alumno aparece en B sin recargar (S5). Si no aparece, recargar B para confirmar
que el dato existe (así se separa "no llegó el evento" de "no se guardó").

### Q02 — Tiempo real: archivar y restaurar

Misma precondición que Q01.
1. En A, archivar un alumno → mirar B.
2. En A, restaurarlo → mirar B.

**Esperado:** B refleja ambos cambios sin recargar.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| D03 | ¿"Activos" debe incluir Pendiente Pago y Docs Pendientes? |
| D05 / N02 | ¿Qué debe medir "Por Vencer"? (cuotas, documentos, clases…) |
| D07 | ¿Los KPIs deben seguir a los filtros? |
| E08 | ¿El buscador debe buscar por email? |
| F10 | ¿Los filtros se conservan al salir y volver? |
| G03 | ¿Hace falta ordenar por columna? |
| J04 | ¿El botón de ficha debe deshabilitarse si no hay matrícula? |
| L04 | ¿Se acepta "BORRARLO" en mayúsculas? |
| L09 | ¿Qué pasa con las clases futuras de un alumno archivado? |
| M08 | ¿A dónde vuelve un alumno restaurado cuya matrícula ya terminó? |
| O05 | ¿"Nueva Matrícula" debe estar dentro de la Papelera? |
