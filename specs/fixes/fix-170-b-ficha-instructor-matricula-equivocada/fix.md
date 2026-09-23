# Fix: La Ficha Técnica del instructor muestra la matrícula equivocada

> **id:** fix-170-b-ficha-instructor-matricula-equivocada
> **refs:** ASG-b-100 (hallazgo), fix-169-b (se encontró cerrando su AC1b)
> **status:** done
> **owner:** b
> **created:** 2026-09-23
> **closed:** 2026-09-23

## Root Cause

`InstructorAlumnosFacade.fetchStudentDetail()` resuelve la matrícula del alumno así:

```ts
.from('enrollments')
.eq('student_id', studentId)
.order('id', { ascending: false })
.limit(1)
```

Toma **la matrícula de id más alto, sin filtrar por tipo de curso**. Después usa ese
`enrollment.id` para traer las `class_b_sessions` y armar la grilla "Ficha Técnica — Clases
Prácticas" de las 12 clases de Clase B.

Si el alumno tiene una matrícula de Clase B **y** una de Profesional —camino de negocio normal:
termina Clase B y después toma Profesional, la app incluso tiene "Re-matricular"— agarra la de id
mayor. Cuando esa es la de Profesional, la ficha queda apuntando a una matrícula que no tiene
clases prácticas B, y muestra las 12 en blanco.

**Por qué el instructor sí debe filtrar y el admin no:** en `AdminAlumnoDetalleFacade` la
matrícula más reciente (`lastEnrollment`) gobierna **toda** la ficha del alumno —pagos, contratos,
certificados— y ahí es correcto que sea la vigente, sea del tipo que sea. El facade del
instructor, en cambio, existe solo para las clases prácticas de Clase B: su pregunta no es "cuál
es la matrícula vigente" sino "cuál es la matrícula de Clase B". Por eso el fix va acá y no se
toca el camino compartido de admin.

## Reproducción observada

Alumno 84, con dos matrículas activas: la 90 (Clase B, con 12 sesiones sembradas para la prueba) y
la 160 (Profesional A2, sin ninguna). Entrando al portal del instructor:

| Pantalla | Qué decía |
|---|---|
| Tarjeta en "Mis Alumnos" | Progreso Práctico **3/12** |
| Ficha Técnica del mismo alumno | **0 % práctico**, las 12 clases en "Pendiente" |
| Encabezado de la ficha | CURSO: **Profesional A2** |

Los datos estaban bien; la pantalla mostraba la matrícula que no era. Es el único alumno de la
base de desarrollo con ambas matrículas, por eso no había salido antes.

## ACs Afectados

- **`fix-169-b` AC1b** — el tema por clase se renderiza bien, pero sobre la matrícula equivocada,
  así que la ficha del instructor no es confiable hasta corregir esto.
- No afecta ningún AC de la vista admin: ese camino queda intacto a propósito.

## Cambio

- **Archivo:** `src/app/core/facades/instructor-alumnos.facade.ts`
- **Qué cambia:** al resolver la matrícula para la Ficha Técnica se filtra por
  `courses.type = 'class_b'`. Entre varias matrículas de Clase B se mantiene el criterio actual
  —la más reciente— para no inventar una regla de negocio nueva.

## Test de Regresión

- `instructor-alumnos.facade.spec.ts > loadStudentDetail — matrícula de la Ficha Técnica
  (fix-170-b) > pide la matrícula filtrando por curso de tipo class_b` ✓
- `instructor-alumnos.facade.spec.ts > … > sigue acotando al alumno pedido` ✓

Escritos primero: fallaban antes del cambio (`expected false to be true`) y pasan después. Se
afirman sobre **los filtros que se le piden a PostgREST**, no sobre las filas devueltas — el bug
estaba en la consulta, no en el mapeo, así que un test sobre el resultado del mock no lo habría
detectado.

## Verificación en pantalla

Con el guard de fase piloto levantado en local y las 12 sesiones sembradas de nuevo en la
matrícula 90 (todo revertido después), la misma ficha del alumno 84:

| | Antes | Después |
|---|---|---|
| Encabezado | 0 % práctico | **25 % práctico** |
| Clases 1-3 | "Pendiente" | **"Completada"**, con fecha e instructor |
| Coincide con la tarjeta del listado (3/12) | no | **sí** |

Limpieza verificada: 0 sesiones sembradas, `pilot-phase.config.ts` idéntico a `HEAD`.

**Semáforos:** 2619 tests exit 0, `lint:arch` exit 0, `ng build` exit 0.

## Severidad

Media-alta. No pierde ni corrompe datos, pero un instructor mirando esa ficha concluye que el
alumno no hizo ninguna clase. Conviene que esté resuelto antes de exponer el portal (`ASG-b-100`).
