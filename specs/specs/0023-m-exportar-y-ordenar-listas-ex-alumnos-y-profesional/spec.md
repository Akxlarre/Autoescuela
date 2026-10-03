# Spec 0023-m — Exportar y ordenar por columna en Ex-Alumnos B, Base de Alumnos Profesional y Ex-Alumnos Profesional

> **Status:** done (2026-10-02)
> **Created:** 2026-10-02
> **Owner:** Matías
> **Priority:** — (se hace de inmediato)

---

## 1. Contexto de negocio

**Origen:** `ASG-i-024` (pedido de Matías, 2026-10-02), a partir de lo ya hecho en la Base de
Alumnos B: orden por columna (spec `0020-m`) y menú "Exportar" Excel/PDF (spec `0021-m`,
`fix-281-m`).

**Persona afectada:** Secretaria y Admin.

**Problema que resuelve:**
Las cuatro listas de alumnos se comportan distinto: solo la Base de Alumnos B ordena por
columna, y Base de Alumnos Profesional y Ex-Alumnos Profesional no se pueden exportar. Quien
trabaja con la lista profesional no puede sacar un listado ni ordenarlo.

**Hipótesis de valor:**
Las cuatro listas ordenan y exportan igual, así que lo aprendido en una sirve en todas.

---

## 2. User Stories

- **US1**: Como secretaria o admin, quiero exportar la Base de Alumnos Profesional y los
  Ex-Alumnos Profesional a Excel y PDF, con lo que veo en pantalla.
- **US2**: Como secretaria o admin, quiero ordenar Ex-Alumnos B, Base de Alumnos Profesional y
  Ex-Alumnos Profesional apretando el título de una columna, igual que en la Base de Alumnos B.

---

## 3. Acceptance Criteria (Gherkin)

> "Las tres listas" = Ex-Alumnos B, Base de Alumnos Profesional y Ex-Alumnos Profesional.

- **AC1**: Given la Base de Alumnos Profesional o Ex-Alumnos Profesional, When el usuario
  abre "Exportar", Then ve el mismo menú que la Base de Alumnos B (`app-export-menu`) con
  "Exportar como Excel" y "Exportar como PDF".
- **AC2**: Given filtros, búsqueda y orden aplicados en esas dos listas (o la Papelera en
  la Base Profesional), When el usuario exporta, Then el archivo trae exactamente las filas de
  la pantalla, en el mismo orden, con los mismos valores que la tabla.
- **AC3**: Given una exportación, When se genera, Then el Excel se arma en el navegador y el
  PDF sale de la Edge Function `export-table-pdf`, igual que Base de Alumnos B y Ex-Alumnos B.
- **AC4**: Given una lista sin filas, When se mira el menú, Then el botón "Exportar" está
  deshabilitado (como en Ex-Alumnos B).
- **AC5**: Given cualquiera de las tres listas en vista de tabla, When el usuario aprieta el
  título de una columna con datos, Then la lista completa (todas las páginas) se ordena por esa
  columna ascendente; un segundo clic la ordena descendente y un tercero vuelve al orden por
  defecto. La columna activa muestra la flecha del sentido.
- **AC6**: Given una lista ordenada, When el usuario filtra o busca, Then el resultado sigue
  ordenado por la misma columna, y "Limpiar filtros" no quita el orden.
- **AC7**: Given la vista de tarjetas (pantalla angosta) de las tres listas, When el usuario
  usa el control "Ordenar por" y el botón de sentido, Then ordena igual que los títulos de la
  tabla (mismo comportamiento que la Base de Alumnos B, spec 0020-m AC11).
- **AC8**: Given un orden elegido, When el usuario exporta, Then el archivo respeta ese orden.

### Edge cases obligatorios

- **AC-E1**: Given filas sin dato en la columna ordenada (p. ej. sin Nº de matrícula o sin
  fecha de egreso), When se ordena en cualquier sentido, Then esas filas van al final.
- **AC-E2**: Given la Base de Alumnos B, When se usa después del cambio, Then ordena igual que
  antes (la lógica de orden pasa a ser compartida, sin cambiar su comportamiento).
- **AC-E3**: Given Ex-Alumnos Profesional, que sigue oculta por el piloto, When se entra por
  su URL, Then exportar y ordenar funcionan igual.

---

## 4. Out of scope

- ❌ Mostrar Ex-Alumnos Profesional en el menú (sigue oculta por el piloto).
- ❌ Conservar el orden al volver desde la ficha en las tres listas: hoy ninguna conserva sus
  filtros al volver (solo la Base de Alumnos B, hotfix-126-m); el orden sigue esa misma regla.
- ❌ Exportar o ordenar otras listas (Pre-inscritos, Flota, etc.).
- ❌ Columnas sin dato ordenable: "Acciones".

---

## 5. Dependencias

- Specs `0020-m` (orden por columna), `0021-m` (exportar Ex-Alumnos), `fix-281-m`, `0022-m`.
- Edge Function `export-table-pdf` desplegada.

---

## 6. Datos y modelo

- No toca la BD.

---

## 9. Decisiones

- [x] La vista de tarjetas también recibe "Ordenar por" (AC7), como la Base de Alumnos B: sin
  eso, en pantalla angosta no habría forma de ordenar.
- [x] Columnas combinadas: "Año / Sede" ordena por fecha de egreso; "Estado cuenta" y "Saldo"
  por saldo pendiente; "Módulos" por módulos aprobados; "Asistencia" por semáforo (crítico →
  en riesgo → al día).

---

## Changelog

- 2026-10-02 — draft inicial por Matías
