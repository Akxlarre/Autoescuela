# Spec 0021-m — Exportar la lista de Ex-Alumnos B a Excel y PDF

> **Status:** done
> **Created:** 2026-10-02
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-i-024`, caso T14 de `specs/testing-piloto/024b-ficha-ex-alumnos.md`. Decisión del
owner del 2026-10-01 (registrada en `fix-264-m`): "Ex-Alumnos debe exportar la lista con las
mismas opciones que la Base de Alumnos (Excel y PDF). No hace falta descargar el certificado desde
la lista". El 2026-10-02 pidió implementarla.

**Persona afectada:** Secretaria y Admin.

**Problema que resuelve:**
La pantalla Ex-Alumnos B no tiene forma de sacar la lista de egresados fuera del sistema. Para
entregarla o archivarla hay que copiarla a mano.

---

## 2. User Stories

- **US1**: Como secretaria, quiero descargar la lista de egresados en Excel, para trabajarla o
  enviarla fuera del sistema.
- **US2**: Como secretaria, quiero descargar la misma lista en PDF, para imprimirla o archivarla.
- **US3**: Como secretaria, quiero que el archivo traiga exactamente lo que estoy viendo, para no
  tener que revisar si le sobran o le faltan filas.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given la pantalla Ex-Alumnos B, Then la barra de la tabla tiene un botón "Exportar" con
  dos opciones: "Exportar como Excel" y "Exportar como PDF" (igual que la Base de Alumnos).
- **AC2**: Given egresados en pantalla, When elijo "Exportar como Excel", Then se descarga
  `ex-alumnos-b_<fecha>.xlsx` con una fila por egresado y las columnas Alumno, RUT, Correo,
  Nº Expediente, Licencia, Fecha de egreso, Sede, Estado de cuenta y Saldo pendiente.
- **AC3**: Given egresados en pantalla, When elijo "Exportar como PDF", Then se descarga
  `ex-alumnos-b_<fecha>.pdf` con título, fecha de generación, total de egresados y una tabla con
  Alumno, RUT, Nº Exp., Licencia, Egreso, Sede y Estado de cuenta, paginada.
- **AC4**: Given un período o una búsqueda aplicados, Then el archivo trae **las mismas filas que
  la pantalla** (todas las páginas de la tabla, no solo la visible), en el mismo orden.
- **AC5**: Given la fecha de egreso, Then se exporta como `dd-mm-aaaa`.
- **AC6**: Given el estado de cuenta, Then dice "Al día" o "Debe" y el saldo va en su propia
  columna como número (Excel), o "Debe $X" (PDF).
- **AC7**: Given que la exportación está en curso, Then el botón muestra un indicador de carga y
  no se puede volver a pulsar.
- **AC8**: Given admin y secretaria, Then ambos pueden exportar; cada uno obtiene lo que su
  pantalla muestra (la secretaria, solo su sede).

### Edge cases obligatorios

- **AC-E1**: Given cero egresados en pantalla (filtro sin resultados), Then el botón "Exportar"
  está deshabilitado.
- **AC-E2**: Given un egresado sin Nº de expediente o sin fecha de egreso, Then la celda va con
  "—" y la exportación no falla.
- **AC-E3**: Given que la generación del archivo falla, Then se muestra un aviso de error y el
  botón vuelve a quedar disponible.

---

## 4. Out of scope

- ❌ Ex-Alumnos Profesional (`ASG-i-025`).
- ❌ Descargar el certificado desde la lista (el owner dijo que no hace falta).
- ❌ Corregir la exportación de la Base de Alumnos (bug B1 de `fix-264-m`, depende de `0009-i`).
- ❌ Migrar al componente compartido los otros 5 menús "Exportar" de la app (contabilidad y
  auditoría). La Base de Alumnos sí se migra (D2).

---

## 5. Dependencias

### Capacidades del proyecto que se asumen existentes
- `ExAlumnosContentComponent` (tabla, búsqueda, selector de período).
- `downloadExcel()` (`core/utils/excel.utils.ts`).

### Capacidades nuevas requeridas
- Edge Function `export-table-pdf` (ver D1).

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- RLS requerida: ninguna (se exporta lo que la pantalla ya cargó con la sesión del usuario).

---

## 7. UX y flujos (preliminar)

- Pantalla(s): `/app/admin/ex-alumnos` y `/app/secretaria/ex-alumnos`.
- Botón "Exportar" a la derecha de la barra de la tabla, con el mismo menú de la Base de Alumnos.

---

## 9. Notas / decisiones abiertas

### Por qué no se reutiliza la Edge Function `export-students`

El owner preguntó si se podía reutilizar la función de la Base de Alumnos. No sirve tal cual:

1. Lista **alumnos** (uno por alumno, con su matrícula más reciente), no **egresados** (una fila
   por matrícula completada). No conoce el período de egreso, ni las columnas de Ex-Alumnos
   (licencia, fecha de egreso, sede), y mezcla Clase B con Profesional.
2. Vuelve a consultar y a filtrar en el servidor con reglas propias, que ya no coinciden con las
   de la pantalla: es el bug B1 de `fix-264-m` (Excel con 72 filas contra 64 en pantalla).
   Repetir ese diseño aquí repetiría el bug.
3. Es el archivo que Ignacio está modificando en `0009-i`.

En su lugar se exportan **las filas que la pantalla ya tiene filtradas**. Así el archivo no puede
diferir de lo que se ve. Del frontend sí se reutiliza: `downloadExcel()` y el diseño del menú
"Exportar".

### D1 — Cómo se genera el PDF → Edge Function (decidido por el owner, 2026-10-02)

Se evaluó generarlo en el navegador con `pdf-lib`. El owner lo descartó: todos los PDF de la app
salen de Edge Functions y este no debía ser la excepción (además evita sumar una librería al
frontend).

Se crea `export-table-pdf`, una función genérica que **recibe la tabla ya armada** (cabeceras y
celdas de las filas en pantalla) y devuelve el PDF. No consulta la base de datos, así que no
puede traer filas distintas a las de la pantalla y sirve para cualquier otra lista.

El Excel no pasa por ninguna función: en la Base de Alumnos la función solo devuelve los datos y
el archivo lo arma el navegador con `downloadExcel()`; aquí los datos ya están en el navegador.

### D2 — Menú compartido (decidido por el owner, 2026-10-02)

El menú "Exportar" se extrae a `app-export-menu` y la Base de Alumnos también pasa a usarlo, para
que sea el mismo elemento en las dos pantallas.

### Pendiente fuera del código

- **Desplegar `export-table-pdf`** (lo hace el owner):
  hecho; probado contra la función real el 2026-10-02 (ver acceptance).

---

## Changelog

- 2026-10-02 — spec inicial. Excel implementable ya; PDF a la espera de D1.
- 2026-10-02 — D1 → Edge Function `export-table-pdf`; D2 → menú compartido también en la Base de
  Alumnos. Implementada.
- 2026-10-02 — función desplegada, PDF probado de punta a punta y visto bueno visual del owner →
  `done`.
