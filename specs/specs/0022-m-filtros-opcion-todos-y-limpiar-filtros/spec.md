# Spec 0022-m — Opción "Todos" en los filtros y botón compartido "Limpiar filtros" en todas las listas

> **Status:** done
> **Created:** 2026-10-02
> **Owner:** Matías
> **Priority:** — (se hace de inmediato)

---

## 1. Contexto de negocio

**Origen:** `ASG-i-024`, al revisar la Base de Alumnos B (2026-10-02). Matías notó que, después
de elegir una opción en un filtro, no hay forma de volver a "Todos".

**Persona afectada:** Secretaria y Admin (también Instructor en las listas que tienen filtros).

**Problema que resuelve:**
Los selectores de filtro muestran "Todos los cursos", "Todos los estados", etc. solo como texto
de relleno (`placeholder`): esa opción no existe en la lista. Si el usuario elige un valor, el
filtro queda aplicado y la única salida es recargar la página o navegar fuera. En la mayoría de
las listas tampoco hay un botón para limpiar todos los filtros de una vez; solo aparece
"Limpiar filtros" dentro del estado vacío, cuando el filtro ya no devuelve resultados.

**Hipótesis de valor:**
Que cualquier filtro se pueda deshacer desde el mismo selector y que todas las listas tengan
la misma forma de volver a la vista completa.

---

## 2. User Stories

- **US1**: Como secretaria o admin, quiero volver a "Todos" desde el mismo selector de un filtro
  para deshacer ese filtro sin recargar la página.
- **US2**: Como secretaria o admin, quiero un botón "Limpiar filtros" que deje la lista completa de
  una vez, para no tener que deshacer cada filtro por separado.
- **US3**: Como secretaria o admin, quiero que todas las listas se comporten igual, para no tener
  que aprender una forma distinta en cada pantalla.

---

## 3. Acceptance Criteria (Gherkin)

> "Pantallas con filtros" = las 16 listas del relevamiento de §9 (las 15 pendientes, más
> Promociones e Historial de ventas, menos Comunicados) y las 2 de Pagos, que ya cumplen y se
> migran al componente compartido.

- **AC1**: Given cualquier selector de filtro de una pantalla con filtros, When el usuario lo
  abre, Then la primera opción es la de "todos" ("Todos los cursos", "Todos los estados",
  "Todas las clases", etc.) y elegirla quita ese filtro: la lista vuelve a mostrar las filas que
  ese filtro ocultaba.
- **AC2**: Given un filtro sin tocar o vuelto a "todos", When se mira el selector, Then muestra
  el texto de la opción "todos" (no queda vacío ni muestra otra opción).
- **AC3**: Given una pantalla con filtros sin ningún filtro aplicado y el buscador vacío, When se
  mira la barra de filtros, Then no aparece el botón "Limpiar filtros".
- **AC4**: Given una pantalla con filtros, When el usuario elige un valor en cualquier selector
  o escribe en el buscador, Then aparece el botón "Limpiar filtros" en la barra de filtros.
- **AC5**: Given filtros aplicados y texto en el buscador, When el usuario aprieta "Limpiar
  filtros", Then todos los selectores vuelven a "todos", el buscador queda vacío, la lista
  muestra todas las filas, vuelve a la primera página y el botón desaparece.
- **AC6**: Given la Base de Alumnos B con un orden elegido (spec `0020-m`), When el usuario
  aprieta "Limpiar filtros", Then el orden se conserva.
- **AC7**: Given Promociones o Historial de ventas, When se mira un selector de filtro, Then ya
  no tiene la "x" de PrimeNG: se limpia con la opción "todos" y el botón, igual que el resto.
- **AC8**: Given el formulario de Nuevo comunicado, When el usuario abre "Sede", "Tipo de curso"
  o "Estado", Then la primera opción es "Todas las sedes", "Todos" o "Cualquiera"
  respectivamente, elegirla devuelve el segmento a ese valor, y el formulario NO tiene botón
  "Limpiar filtros".
- **AC9**: Given las pantallas con filtros, When se busca el botón "Limpiar filtros" en el
  código, Then todas usan el mismo componente compartido, incluidas Pagos y Auditoría.

### Edge cases obligatorios

- **AC-E1**: Given la Base de Alumnos B con filtros aplicados, When el usuario entra a una ficha
  y vuelve, Then los filtros se conservan como hoy (`hotfix-126-m`), y si después aprieta
  "Limpiar filtros", al entrar y volver de nuevo la lista sigue limpia.
- **AC-E2**: Given un filtro que hoy usa un valor por defecto distinto de `null` (por ejemplo
  `''`), When el usuario elige "todos", Then el filtro queda en ese mismo valor por defecto y no
  aparece el botón "Limpiar filtros" por ese filtro.
- **AC-E3**: Given una pantalla cuyo estado vacío ya tiene el enlace "Limpiar filtros", When
  ningún resultado coincide, Then ese enlace sigue funcionando y hace lo mismo que el botón.

---

## 4. Out of scope

- ❌ Selectores de formularios donde elegir es obligatorio ("Seleccione sede", "Selecciona un
  instructor", razón de reprogramación, etc.).
- ❌ Selectores que no son filtros: promoción/ciclo/curso de Libro de clases, Asistencia
  Profesional, Archivo y Certificación Profesional; período, rango de fechas, pestañas.
- ❌ Plantillas de documentos (Sede / Tipo de documento en DMS): eligen qué plantilla editar.
- ❌ Cambiar qué filtros existen o cómo filtran.

---

## 5. Dependencias

### Specs previas
- Ninguna. Toca la Base de Alumnos B, que ya tiene `0020-m` (orden) y `0021-m` (exportar) cerradas.

### Capacidades del proyecto que se asumen existentes
- `p-select` de PrimeNG en las barras de filtro.
- Patrón ya resuelto en Pagos (admin y secretaria): opción `{ label: 'Todos los cursos', value: null }`
  y botón "Limpiar filtros" visible solo con filtros activos (`hayFiltrosActivos()`).

### Capacidades nuevas requeridas
- Componente compartido para limpiar filtros (nombre y forma a definir en el plan).

---

## 6. Datos y modelo (preliminar)

- No toca la base de datos.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): ver el relevamiento en §9.
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

- {{métrica 1}}

---

## 9. Notas / decisiones abiertas

### Relevamiento (2026-10-02)

Selectores de **filtro** (no campos de formulario) sin opción para volver al valor por defecto:

| Pantalla | Archivo | Filtros |
|---|---|---|
| Base de Alumnos B | `shared/components/alumnos-list-content` | Curso, Estado, Expediente |
| Alumnos Profesional | `shared/components/alumnos-profesional-list-content` | Clase, Estado |
| Ex-Alumnos Profesional | `shared/components/ex-alumnos-profesional-content` | Clase |
| Pre-inscritos | `shared/components/pre-inscritos-content` | Estado, Clase |
| Flota | `shared/components/flota-list-content` | Tipo, Estado |
| Secretarias | `features/admin/secretarias/admin-secretarias` | Sede, Estado |
| Relatores | `features/admin/profesional-relatores` | Especialidad, Estado |
| Contabilidad de cursos | `features/admin/contabilidad-cursos` | Tipo, Estado |
| Auditoría | `features/admin/auditoria` | Usuario, Acción, Módulo (ya tiene "Limpiar Filtros") |
| Pagos recientes (drawer) | `features/admin/pagos/pagos-recientes-drawer` | Estado, Método |
| Agenda semanal | `shared/components/agenda-semanal` | Instructor |
| Asistencia Clase B | `shared/components/asistencia-clase-b-content` | Instructor |
| Certificación Clase B | `shared/components/certificacion-clase-b-content` | Estado |
| Certificación Profesional | `shared/components/certificacion-profesional-content` | Estado |
| Comunicados (destinatarios) | `features/comunicados/announcement-composer-drawer` | Sede, Curso, Estado de matrícula |
| Ex-Alumnos B | `shared/components/ex-alumnos-content` | Buscador y período (sin selector de filtro; agregada al implementar porque tampoco tenía botón) |

Al implementar se tomó como filtro también el selector de **período** (Ex-Alumnos B y
Profesional, Historial de ventas) y los botones de estado de Asistencia Clase B: "Limpiar
filtros" los devuelve a su valor inicial (período: últimos 12 meses, como ya hacía Ex-Alumnos B).

Ya resueltos: Pagos admin y secretaria (opción "Todos" + botón). Con la "x" de PrimeNG
(`showClear`), sin opción "Todos": Promociones e Historial de ventas.

No son filtros (campos obligatorios de formularios, selectores de promoción/ciclo/período):
quedan fuera.

### Decisiones abiertas

- [x] Prioridad: no aplica, se hace de inmediato (Matías, 2026-10-02).
- [x] Promociones e Historial de ventas dejan la "x" (`showClear`) y pasan al mismo patrón que el
  resto: opción "Todos" + botón "Limpiar filtros" (Matías, 2026-10-02). El patrón de Pagos es el
  modelo para todas las vistas.
- [x] "Limpiar filtros" también borra el buscador, como en Pagos (Matías, 2026-10-02).
- [x] Nuevo comunicado: sus selectores "Sede / Tipo de curso / Estado" reciben la opción
  "Todas/Todos/Cualquiera", pero sin botón "Limpiar filtros" (Matías, 2026-10-02).

---

## Changelog

- 2026-10-02 — draft inicial por Matías
