# Fix: La lista de certificados de la secretaria usa un criterio de elegibilidad distinto al botón y al servidor
> id: fix-459-m-certificados-secretaria-criterio-unico
> refs: fix-447-m-testing-documentos-certificacion (S14, casos L*) · fix-262-m · spec 0006-m
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`CertificacionClaseBFacade.fetchAlumnos()` le muestra a la secretaria solo las matrículas con
`certificate_enabled = true`. Ese flag lo prende `trg_enable_certificate_b` cuando se completa la
clase **número 12**, sin contar las demás: una #12 completada con otras pendientes la habilita, y
un curso con otra cantidad de clases (spec 0006-m) queda mal. El botón "Generar" y
`generate-certificate-b-pdf` usan otro criterio: cantidad de clases `completed` ≥ las del curso
(`practical_hours`, fix-262-m). Resultado: la secretaria puede ver alumnos que el servidor rechaza
y dejar de ver alumnos que sí cumplen.

## ACs Afectados

- fix-262-m — el certificado se condiciona a las clases completadas, no a la nota ni a una clase
  puntual.
- AC propio — la secretaria ve las matrículas con todas las clases del curso completadas (mismo
  conteo que el botón y la edge function) **y** las que ya tienen certificado (para verlo o
  reenviarlo). El admin sigue viendo todas.

## Cambio

- `certificacion-clase-b.facade.ts` — la query ya no filtra `certificate_enabled`; para la
  secretaria, las filas se filtran por `clasesCompletadas >= clasesTotales` o certificado
  existente, después de contar las clases.

## Test de regresión

- `certificacion-clase-b.facade.spec.ts` — secretaria: alumno con 12/12 sin flag aparece; 11/12
  con flag no; con certificado ya generado aparece; admin ve todos.

### Resultado (2026-10-18)

- ✅ `certificacion-clase-b.facade.spec.ts`: el caso de la secretaria falló antes del cambio; 117/117
  con `certificacion-clase-b-content`, `features/admin/certificacion` y `features/secretaria`.
  `tsc --noEmit` limpio.
- ✅ Datos de dev (criterio viejo vs nuevo): por sede, el flag mostraba **70** matrículas y 62 de
  ellas tenían entre 1/12 y 9/12 clases; el criterio nuevo muestra las **8** con 12/12. Ninguna
  que cumpla quedó fuera.
- ✅ Navegador, secretaria sede 1 → Certificados: 8 alumnos, todos 12/12, "Generar Pendientes (8)".
- El flag `certificate_enabled` sigue mal para sus otros lectores (alerta del dashboard "listos
  para certificar", portal del alumno) → `fix-460-m` corrige el trigger y lo recalcula.
