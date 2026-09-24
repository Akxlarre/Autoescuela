# Plan 0017-m — Libro de Clases PDF: réplica exacta

Todo el trabajo vive en un solo archivo: `supabase/functions/generate-class-book-pdf/index.ts`
(Deno Edge Function, sin librerías de PDF — arma el content stream a mano vía
`_shared/pdf-utils.ts`). No hay cambios de esquema ni de Facade/UI.

## Constantes verificadas contra `libroclases.pdf` (28 páginas)

- Tamaño de página: `MediaBox [0 0 1008 612]` (Legal horizontal, 14×8.5in) — medido con
  regex sobre el PDF real, no estimado.
- Estructura de páginas real: 1 portada, 4 reglamento, 1 antecedentes alumnos, N semanas de
  asistencia (7 días c/u, L-D), 1 recuperación de feriados, ~13 calendario de clases, 1
  evaluaciones, 1 resumen asistencia.

## Fases

### Fase 1 — Fundacional (tamaño + portada + antecedentes + asistencia 7 días)
1. Cambiar `W=842,H=595` → `W=1008,H=612` y reajustar constantes de columnas que dependan de
   `PW` (la mayoría ya son relativas a `PW`, revisar anchos fijos tipo `ML+430`).
2. Portada: verificar que la tabla de 8 filas ya implementada calce con las proporciones del
   real a la nueva geometría (labelW, rowH) — ajuste menor, ya existe casi todo.
3. Nueva página "ANTECEDENTES DE LOS ALUMNOS": tabla N°/Apellidos,Nombre/RUN/Nivel de
   Escolaridad/Teléfono/Firma, 25 filas fijas (rellenar con alumnos reales, vacías el resto).
   Columna "Nivel de Escolaridad" queda en blanco (no existe ese dato en `users`/`students` —
   confirmado, no se agrega columna solo para esto, ver nota abierta de spec.md).
4. Reescribir la sección de asistencia semanal: grilla de 7 columnas (Lun-Dom) en vez de 6,
   marcando "DOMINGO" en esa columna siempre, y "LIBRE" en días sin sesión (feriados). Usar
   fecha real de cada día de la semana según `theorySessions`.
5. Nueva página "CONTROL DE ASISTENCIA DE ALUMNOS (Recuperación de Feriados)": tabla con
   alumnos reales, columnas de fecha en blanco, columna Firma Conformidad Alumno, y las 3 notas
   al pie (texto transcrito verbatim de la página 13 del real).

### Fase 2 — Reglamento completo (30 artículos)
6. Reemplazar `getReglamentoText()` por el texto verbatim de las páginas 2-5 del PDF real
   (Título I a IX, Artículos 1 a 30) — ya transcrito en la conversación con el dueño, se copia
   tal cual, sin parafrasear.

### Fase 3 — Calendario curricular + Evaluaciones + Resumen
7. Reemplazar el calendario genérico (`Clase Teórica` por sesión) por la plantilla curricular
   real por bloque de materia — texto estático de asignatura/materia/horas/profesor tomado de
   las páginas 14-26 del PDF real (curso A-2, Transporte de Pasajeros). Nota abierta: confirmar
   con el dueño si A3/A4/A5 comparten la misma plantilla o necesitan la suya — mientras tanto se
   implementa solo A-2 y se deja un TODO explícito para las demás clases.
8. Evaluaciones: cambiar cabecera de "Mód. N" a nombre de asignatura + fecha (columnas: Ley del
   Tránsito, Prevención de Riesgos, Infraestructura y Ed. Vial, Mecánica, Transporte de
   Pasajeros, Conducción, Aspectos Psicológicos) igual al real.
9. Resumen de asistencia: renombrar columnas a "% Asistencia Clase Práctica" / "% Asistencia
   Clase Teórica" / "Firma Conformidad Alumno" (ya casi igual, ajuste de texto/orden).

## Verificación

- Generar el PDF para un curso de prueba (A-2) tras cada fase y comparar visualmente contra
  `libroclases.pdf` (abrir ambos lado a lado).
- No hay test automatizado de contenido visual de PDF en este proyecto — la verificación es
  manual/visual, documentada en `acceptance.md` con capturas o descripción página por página.
- `npm run lint:arch` no cubre `supabase/functions/` (Deno) — no aplica gate de arquitectura
  aquí, pero sí revisar que no queden `@ts-nocheck` nuevos innecesarios.

## Riesgos

- El contenido curricular de Fase 3 es específico del curso A-2 en el PDF real; otras clases de
  licencia (A3/A4/A5) no tienen referencia — implementar solo A-2 primero y marcar TODO.
- El texto del reglamento (Fase 2) es largo (~30 artículos); transcribirlo mal introduciría un
  documento legal incorrecto — se transcribe verbatim del PDF, sin resumir ni parafrasear.
