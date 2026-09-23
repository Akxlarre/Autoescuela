# Asignación ASG-b-100 — QA visual del portal del Instructor cuando se levante la fase piloto

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-23
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El portal del Instructor está bloqueado por `pilotPhaseGuard('instructor')` desde `fix-255-m`, así
que **ninguna de sus pantallas se verificó en navegador durante el piloto**: `ASG-i-012` (el QA
visual pre-lanzamiento) lo dejó explícitamente fuera de alcance. Mientras tanto se le siguió
mergeando código —`fix-169-b` le agregó el tema por clase a su Ficha Técnica— que nadie vio
renderizado.

Cuando se levante la fase piloto de ese portal hay que correrle el QA visual completo, **antes**
de exponerlo a instructores reales. Es la misma clase de deuda que `ASG-i-012` encontró en los
portales de Admin/Secretaría: 7 hallazgos que ninguna lectura de código había detectado.

## Alcance sugerido

- Correr el skill `/verify` contra cada ruta de `/app/instructor/**` que quede expuesta: consola
  sin errores, sin 4xx/5xx, sin datos mock, contrato app-like, claro/oscuro, responsive.
- ~~Cerrar AC1b de `fix-169-b`~~ — **ya cerrado el 2026-09-23**. Se levantó el guard en local, se
  sembraron datos temporales para `instructor@test.com` y se vio en pantalla: la Ficha Técnica del
  instructor muestra la columna "N° / Tema" con los 12 temas. Todo revertido después (datos
  borrados, guard restaurado). Queda como antecedente de que **el portal es verificable** con ese
  procedimiento.
- Completar al menos una vez los recorridos reales del instructor (ver su clase del día,
  iniciar/finalizar una clase, evaluar), no solo que cada pantalla cargue.

## Fuera de alcance

- El portal del Alumno, que está bloqueado por el mismo mecanismo y merece su propia asignación.
- Decidir **cuándo** se levanta la fase piloto: es decisión de negocio, no de esta asignación.

## Referencias

- `ASG-i-012` / `fix-037-i-qa-visual-piloto` — el QA equivalente de Admin/Secretaría, que excluyó
  este portal. Su tanda de hallazgos (`ASG-i-014` a `ASG-i-020`) da una idea de qué tipo de cosas
  aparecen.
- `specs/fixes/fix-169-b-temas-fijos-ficha-tecnica/fix.md` — sección "Alcance de AC1b", con el
  detalle de qué se verificó sin la UI y qué quedó pendiente.
- `src/app/core/config/pilot-phase.config.ts` — sacar `'instructor'` de `BLOCKED_MODULES` es lo
  que levanta la fase.
- `.claude/skills/verify/SKILL.md`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/instructor/**` (verificación, no necesariamente modificación)
- `src/app/core/facades/instructor-alumnos.facade.ts`
- `src/app/core/config/pilot-phase.config.ts`

## Hallazgo ya encontrado (2026-09-23) — la Ficha Técnica elige la matrícula equivocada

Al levantar el guard en local para cerrar AC1b apareció, en la primera pantalla mirada, un bug
**pre-existente** del portal. `InstructorAlumnosFacade` resuelve la matrícula del alumno así:

```ts
.from('enrollments')
.eq('student_id', studentId)
.order('id', { ascending: false })
.limit(1)
```

Toma **la matrícula de id más alto, sin filtrar por tipo de curso**. Si el alumno tiene una de
Clase B y una de Profesional —situación normal, no sembrada—, agarra la de id mayor y después
renderiza contra ella la grilla "Ficha Técnica — Clases Prácticas" de las 12 clases de Clase B.

Observado con el alumno 84 (matrícula 90 Clase B con 12 sesiones, matrícula 160 Profesional A2
con 0): la tarjeta del listado decía **3/12** y la ficha, para el mismo alumno, **0 % práctico con
las 12 clases en "Pendiente"**, encabezada por "CURSO: Profesional A2". Los datos estaban bien; la
pantalla mostraba la matrícula que no era.

Severidad: media-alta. No pierde datos, pero un instructor mirando esa ficha concluye que el
alumno no hizo ninguna clase. Conviene resolverlo **antes** de exponer el portal.

Sugerencia: filtrar por `courses.type = 'class_b'` al resolver la matrícula de la Ficha Técnica, y
decidir qué mostrar cuando el alumno tenga más de una (¿selector? ¿la activa?) — esa decisión es
de negocio y no está tomada.

## Notas para quien la reclame

- **Bloqueada hasta que se levante la fase piloto del portal instructor.** No tiene sentido
  correrla antes: la ruta redirige a `/modulo-no-disponible`.
- ⚠️ **Los datos de prueba no alcanzan para verificar este portal, y eso hay que resolverlo
  primero.** `instructor@test.com` —la única cuenta de instructor con contraseña publicada en el
  pie del `/login`— tiene **0 sesiones y 0 alumnos asignados**, y la lista de alumnos del portal
  se arma desde `class_b_sessions`, así que entra a un portal vacío y no hay ninguna ficha que
  abrir. Los instructores que sí tienen alumnos (`instructor.seed*@test-data.local`, hasta 135
  sesiones) no tienen contraseña conocida. Verificado el 2026-09-22 al intentar cerrar AC1b.
- Por eso conviene que el primer paso sea **sembrar datos de prueba para `instructor@test.com`**
  (asignarle sesiones de alguna matrícula de Clase B) en vez de reasignar las de un instructor
  seed, que es data compartida de la que dependen otros QA.
- Prioridad P2 por estar bloqueada, no por ser menor: cuando el portal se exponga, pasa a ser
  bloqueante de esa entrega.
