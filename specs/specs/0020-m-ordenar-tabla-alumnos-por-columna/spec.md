# Spec 0020-m — Ordenar la tabla de la Base de Alumnos B por columna

> **Status:** done
> **Created:** 2026-10-02
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-i-024` (testing de la Base de Alumnos B), caso G03 del checklist
`specs/testing-piloto/024a-base-alumnos-b.md`. Decisión del owner del 2026-10-01, registrada en
`fix-264-m`: "agregar ordenamiento por columna en la tabla de alumnos".

**Persona afectada:** Secretaria y Admin.

**Problema que resuelve:**
La Base de Alumnos B muestra siempre el mismo orden (el alumno creado más recientemente primero)
y no se puede cambiar. Para encontrar, por ejemplo, a los alumnos más antiguos, o agruparlos por
estado o por curso, hoy solo existen el buscador y los filtros: no hay forma de recorrer la lista
en otro orden.

**Hipótesis de valor:**
Poder ordenar por cualquier columna reduce el uso de filtros combinados para tareas de revisión
("¿quiénes ingresaron primero?", "¿quiénes tienen el expediente pendiente?").

---

## 2. User Stories

> Redactadas por Claude a partir de la decisión del owner; él pidió implementar sin revisarlas
> una a una (2026-10-02). Se confirman con su visto bueno visual.

- **US1**: Como secretaria, quiero ordenar la lista de alumnos haciendo clic en el título de una
  columna, para recorrerla en el orden que me sirve en ese momento.
- **US2**: Como secretaria, quiero ver en qué columna y en qué sentido está ordenada la lista,
  para no confundir el orden actual con el de siempre.
- **US3**: Como secretaria, quiero que el orden elegido siga puesto al abrir la ficha de un alumno
  y volver, para no tener que ordenar de nuevo cada vez.

---

## 3. Acceptance Criteria (Gherkin)

> Misma condición que las User Stories: se confirman con el visto bueno visual del owner.

- **AC1**: Given la tabla de la Base de Alumnos B, When hago clic en el título de una columna
  ordenable, Then la lista queda ordenada por esa columna de menor a mayor, y un segundo clic la
  invierte.
- **AC2**: Given la tabla, Then son ordenables Alumno, RUT, Nº Exp., Curso, Sede (cuando se
  muestra), Fecha Ingreso, Estado y Expediente; "Acciones" no.
- **AC3**: Given una columna ordenada, Then su título muestra un indicador del sentido
  (ascendente o descendente) y las demás columnas no.
- **AC4**: Given la lista ordenada, When cambio de página, Then el orden se mantiene a través de
  todas las páginas (se ordena la lista completa, no solo la página visible).
- **AC5**: Given la lista ordenada, When aplico o cambio un filtro o la búsqueda, Then el
  resultado filtrado sigue ordenado por la misma columna.
- **AC6**: Given "Fecha Ingreso" como columna de orden, Then se ordena por la fecha real, no por
  el texto `dd-mm-aaaa` (el 05-01-2026 va después del 20-12-2025).
- **AC7**: Given "Alumno" como columna de orden, Then se ordena por apellido y luego nombre,
  ignorando tildes y mayúsculas ("Álvarez" queda junto a "Alvarez", no al final).
- **AC8**: Given que no elegí ningún orden, Then la lista se muestra como hoy: el alumno más
  reciente primero.
- **AC9**: Given un orden elegido, When abro la ficha de un alumno y vuelvo a la lista, Then el
  orden sigue puesto; When entro a la lista por cualquier otro camino, Then vuelve al orden por
  defecto (misma regla que los filtros, `hotfix-126-m`).

- **AC10**: Given un tercer clic sobre la misma columna, Then la lista vuelve al orden por
  defecto y el indicador desaparece (decisión D2).
- **AC11**: Given la lista mostrada como tarjetas (contenedor de 900 px o menos), Then la barra de
  filtros muestra un control "Ordenar por" con las mismas columnas y un botón para invertir el
  sentido, y las tarjetas siguen ese orden; con la tabla visible ese control no aparece
  (decisión D1).

### Edge cases obligatorios

- **AC-E1**: Given alumnos sin dato en la columna de orden (sin Nº de expediente, sin curso),
  Then quedan juntos al final en cualquiera de los dos sentidos, y la tabla no falla.
- **AC-E2**: Given un alumno con varias matrículas (varios Nº de expediente o cursos), Then se
  ordena por el primero que muestra la fila.
- **AC-E3**: Given la vista Papelera, Then el ordenamiento funciona igual.

---

## 4. Out of scope

- ❌ Base de Alumnos Profesional y Ex-Alumnos (`ASG-i-025`; Ex-Alumnos tiene su propia tabla).
- ❌ Ordenar por más de una columna a la vez.
- ❌ Ordenar en el servidor: la lista ya se carga completa y se filtra en el navegador.
- ❌ Que la exportación a Excel/PDF respete el orden de pantalla (la genera `export-students`,
  bug B1 de `fix-264-m`).

---

## 5. Dependencias

### Specs previas
- `0016-b` (Base de Alumnos B) — done.

### Capacidades del proyecto que se asumen existentes
- `AlumnosListContentComponent` con `p-table` paginada y filtros en el navegador.
- `AdminAlumnosFacade.listFilters` (`fix-275-m`) y la regla "solo al volver de la ficha"
  (`hotfix-126-m`).

### Capacidades nuevas requeridas
- Fecha de ingreso en formato ordenable dentro de `AlumnoTableRow` (hoy solo va el texto
  `dd-mm-aaaa`).

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI: `AlumnoTableRow` suma la fecha de ingreso en ISO; el estado de orden (columna y
  sentido) se guarda junto a los filtros de la lista.
- RLS requerida: ninguna.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/app/admin/alumnos` y `/app/secretaria/alumnos` (lista y Papelera).
- Flujo principal: clic en el título de la columna → orden ascendente; segundo clic → descendente.
- Estados especiales: el skeleton y el estado vacío no cambian.

---

## 8. Métricas de éxito post-launch

- No aplica (mejora interna de usabilidad).

---

## 9. Notas / decisiones abiertas

- **D1 — Vista de tarjetas → se incluye (AC11).** La tabla solo se ve cuando su contenedor mide
  más de 900 px; en un portátil de 1280 px con el menú abierto la lista ya se muestra como
  tarjetas, que no tienen títulos de columna. Sin un control propio, la función sería invisible
  justo en una de las pantallas más comunes.
- **D2 — Tercer clic → vuelve al orden por defecto (AC10).** Sin eso no habría forma de volver a
  "más recientes primero" sin salir de la pantalla.
- D1 y D2 las resolvió Claude con la opción recomendada, porque el owner pidió avanzar con la
  implementación (2026-10-02) sin haberlas respondido. **Confirmadas con el visto bueno visual
  del owner** del 2026-10-02.

---

## Changelog

- 2026-10-02 — draft inicial (propuesta de Claude a partir de la decisión G03 del owner)
- 2026-10-02 — D1 y D2 resueltas con la opción recomendada (AC10, AC11); implementada y
  verificada (ver `acceptance.md`).
- 2026-10-02 — visto bueno visual del owner → `done`.
