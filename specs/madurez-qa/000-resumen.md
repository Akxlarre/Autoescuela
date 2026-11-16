# Madurez de QA — Resumen y roadmap

> **Estado:** borrador para revisar en equipo · **Creado:** 2026-11-15 por `b` (con Claude)
> **Asignaciones:** todavía no creadas. Cada archivo `0NN-*.md` está pensado para convertirse en
> una asignación (`/assign-new`) y entregarle el contexto a quien la reclame.
> **Molde:** el de `specs/testing-piloto/` (un resumen más un archivo por asignación). Cambia el
> contenido: allá son checklists de casos por módulo; acá es qué capacidad falta, por qué importa
> en este sistema y qué significa terminarla.

## Para qué existe esta carpeta

El proyecto tiene una base de tests mejor que la habitual para su tamaño: 344 archivos de test
unitario (unos 4.800 casos), 73 archivos e2e (unos 545 tests), 65 tests SQL y 32 tests de edge
functions. Lo que falta casi nunca es "más tests". Faltan tres cosas distintas:

1. **Que lo que ya existe corra solo.** Los e2e y los tests SQL dependen de que alguien se acuerde.
2. **Ver lo que pasa en producción.** Hoy un error que ocurre en el navegador de una secretaria no
   le llega a nadie del equipo.
3. **Cubrir clases de falla que ningún test actual busca:** concurrencia, fallas de terceros,
   datos que se corrompen en silencio, pérdida de la base.

Cada archivo explica un concepto de QA desde cero, con el vocabulario para buscarlo, y lo aterriza
en este sistema con evidencia. Sirve para estudiar el tema y para arrancar el trabajo.

## Cómo leer cada archivo

Todos tienen las mismas secciones:

| Sección                       | Qué responde                                                      |
| ----------------------------- | ----------------------------------------------------------------- |
| En una frase                  | Qué se gana cuando esto existe                                    |
| El concepto                   | La teoría, con los términos en inglés para buscar más             |
| Por qué importa acá           | Evidencia de este repo, con archivo y fecha                       |
| Qué hay hoy                   | Lo que ya existe y se puede reutilizar                            |
| Cómo se hace                  | Opciones, costo de cada una y la recomendada                      |
| Alcance propuesto / fuera     | Qué entra en la asignación y qué no                               |
| Cómo saber que está terminado | Criterios verificables; son candidatos a ACs del track            |
| Trampas conocidas             | Errores típicos al implementarlo                                  |
| Decisiones pendientes         | Lo que hay que resolver antes o durante, y de quién es            |
| Vocabulario                   | Glosario corto                                                    |

Lo teórico no envejece. Lo que sí envejece son las cifras y las rutas de archivo: llevan la fecha
en que se verificaron y conviene re-verificarlas al reclamar la asignación.

## Hallazgos que ordenan las prioridades

Verificados el 2026-11-15. Los cuatro primeros (0 a 3) no los cubre ningún test, por más que se
escriban. **El 0 es urgente y se resuelve con configuración, sin código** (pasos en `012`).

| #   | Hallazgo                                                                                                                              | Evidencia                                                                                                    | Detalle |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| 0   | El repositorio es **público** y la contraseña de las cuentas de prueba está versionada. `admin@test.com` existe en la única base, junto a 48 cuentas que no son de prueba, y ve todas las sedes. | Visibilidad del repositorio en GitHub; `docs/E2E-PLAYWRIGHT.md`, `e2e/support/accounts.ts` y otros 10 archivos; conteo en `auth.users` | `012`, `002` |
| 1   | El proyecto Supabase está en **plan gratuito**, que no incluye respaldos automáticos. No hay ninguna copia programada en el repo.     | Plan de la organización: `free`. Documentación de Supabase: respaldos diarios solo en Pro, Team y Enterprise | `001`   |
| 2   | Hay **un solo proyecto Supabase** para la autoescuela. Lo usan el desarrollo, los e2e, los tests SQL y la app publicada.             | `src/environments/environment.ts` (único), `angular.json` sin `fileReplacements`, `e2e/support/env-guard.ts` | `002`   |
| 3   | Los errores de producción **no salen del navegador del usuario**.                                                                     | `src/app/core/errors/global-error-handler.ts`: `console.error` y un toast                                    | `007`   |
| 4   | Los 73 e2e y los 65 tests SQL **no corren en ningún pipeline**.                                                                       | `.github/workflows/ci.yml` no invoca Playwright ni `supabase/tests/`                                         | `003`, `004` |
| 5   | Migraciones y edge functions **se publican a mano**; el rollback de la app no revierte la base.                                       | Ningún workflow ejecuta `db push` ni `functions deploy`                                                      | `009`   |
| 6   | **No hay medición de cobertura**: el script existe pero el proveedor no está instalado.                                               | `package.json` `test:coverage`; `@vitest/coverage-v8` ausente de `package-lock.json`                          | `005`   |
| 7   | **12 vulnerabilidades conocidas** en dependencias de producción (9 altas, 3 moderadas). Dependabot solo vigila GitHub Actions.        | `npm audit --omit=dev`; `.github/dependabot.yml`                                                             | `012`   |
| 8   | Las 10 tareas programadas reportan cero fallas en 30 días, pero **ese dato no prueba que funcionen**.                                | `cron.job_run_details`; caso `log_change()` en `indices/DATABASE.md:160`                                     | `007`   |
| 9   | **`main` no tiene protección de rama ni reglas**: el CI avisa, pero un PR en rojo se puede mergear y se puede subir directo.         | API de GitHub: rama sin protección, cero reglas                                                              | `005`   |

## Tablero de madurez

Niveles: **0** no existe · **1** existe, se corre a mano · **2** corre solo (en cada PR o
programado) · **3** corre solo y además bloquea o avisa.

| Archivo | Capacidad                                             | Fase | Hoy | Meta | Prioridad | Tipo | Depende de |
| ------- | ----------------------------------------------------- | ---- | --- | ---- | --------- | ---- | ---------- |
| `001`   | Respaldo y restauración ensayada                      | 0    | 0   | 3    | P0        | spec | —          |
| `002`   | Entorno de pruebas aislado                            | 0    | 0   | 2    | P0        | spec | —          |
| `003`   | Tests SQL en el CI                                    | 1    | 1   | 3    | P1        | spec | `002`      |
| `004`   | E2E de humo en el CI                                  | 1    | 1   | 3    | P1        | spec | `002`      |
| `005`   | Gate de merge y cobertura                             | 1    | 2   | 3    | P2        | fix  | —          |
| `006`   | Tests de componentes                                  | 1    | 1   | 2    | P2        | fix  | —          |
| `007`   | Monitoreo de errores y tareas programadas             | 2    | 0   | 3    | P1        | spec | —          |
| `008`   | Invariantes de datos (dinero, agenda, auditoría)      | 2    | 0   | 3    | P1        | spec | `007` para avisar |
| `009`   | Verificación post-despliegue y deriva de la base      | 2    | 0   | 3    | P2        | fix  | —          |
| `010`   | Edge functions críticas y fallas de terceros          | 3    | 1   | 2    | P1        | spec | `002` para la capa de integración |
| `011`   | Concurrencia                                          | 3    | 1   | 2    | P2        | spec | `003`      |
| `012`   | Seguridad automatizada (su punto 0 es urgente)        | 3    | 1   | 3    | P0 / P1   | fix  | `003` para la matriz de permisos |
| `013`   | Documentos de referencia (PDF y correos)              | 3    | 0   | 2    | P2        | fix  | —          |
| `014`   | Pruebas de mutación y por propiedades                 | 4    | 0   | 1    | P2        | spec | `005`      |
| `015`   | E2E estables                                          | 4    | 1   | 3    | P2        | fix  | `002`, `004` |
| `016`   | Rendimiento y accesibilidad estricta                  | 4    | 1   | 2    | Baja      | fix  | `003`, `004` |
| `017`   | Prácticas de proceso (no es asignación)               | —    | —   | —    | —         | —    | —          |

## Orden y dependencias

```text
Fase 0  001 Respaldo ─────────────────────────────── (independiente, urgente)
        002 Entorno aislado ──┬─► 003 Tests SQL ──┬─► 011 Concurrencia
                              │                   └─► 012 Matriz de permisos
                              ├─► 004 E2E de humo ──► 015 E2E estables
                              └─► 010 Integración de edge functions

Fase 2  007 Monitoreo ──► 008 Invariantes (usa su canal de avisos)
        009 Post-despliegue                          (independiente)

Sin dependencias: 005, 006, 013. Después de 005: 014.
```

- **Antes que todo, el punto 0 de `012`:** cambiar las contraseñas de las cuentas de prueba en la
  base real. No es una asignación, es una tarea de una hora coordinada entre los tres.
- **Este roadmap describe debilidades del sistema y el repositorio es público.** Conviene resolver
  el punto anterior antes de subir esta carpeta, y decidir si el repositorio sigue siendo público.
- **`001` va primero aunque no desbloquee nada.** Es el único riesgo de la lista que puede
  terminar el proyecto, y la solución mínima toma horas, no semanas.
- **`002` es la que más desbloquea.** Sin un entorno aislado, automatizar `003`, `004`, `010` y
  `011` significaría escribir en la base real desde un robot.
- **La fase 2 puede avanzar en paralelo desde el primer día.** No depende de `002`.

## Decisiones que no son técnicas

Varias asignaciones no pueden cerrarse sin una decisión del dueño del producto o de la escuela:

| Decisión                                                                                   | De quién                 | Bloquea        |
| ------------------------------------------------------------------------------------------ | ------------------------ | -------------- |
| ¿Cuántos datos se pueden perder y cuánto tiempo puede estar caído el sistema?               | Dueño de la escuela      | `001`          |
| ¿Se pasa al plan Pro de Supabase? (habilita respaldos diarios y ramas de base de datos)     | Dueño del producto       | `001`, `002`   |
| ¿Se puede enviar información de errores a un servicio externo fuera de Chile?               | Responsable de datos personales (Ley 21.719) | `007` |
| ¿Quién recibe los avisos y en qué horario?                                                 | Equipo                   | `007`, `008`   |
| ¿Quién aprueba un cambio en el texto de un contrato o certificado?                         | Dueño de la escuela      | `013`          |
| ¿El desarrollo diario sigue ocurriendo sobre la misma base que usan los clientes?          | Equipo                   | `002`          |
| ¿El repositorio sigue siendo público?                                                      | Dueño del producto       | `012`          |

## Qué no es una asignación

`017-practicas-de-proceso.md` reúne lo que es hábito y no tarea con fin: tabla de riesgos,
sesiones exploratorias, definición de terminado, clasificación de bugs. Se adopta, no se "cierra".

`018-mejoras-al-harness.md` documenta los cambios al harness de agentes que salieron de esta
revisión: siete reglas nuevas en `npm run lint:arch` (ARCH-31 a ARCH-37) ya aplicadas en la rama,
dos cambios en hooks protegidos que tiene que aplicar una persona, y cinco propuestas para que las
decisiones de patrones lleguen a las features futuras.

## Cómo convertir esto en asignaciones

1. Revisar este resumen en equipo y ajustar prioridades.
2. Por cada archivo aceptado: `/assign-new "<título>"`, y en "Contexto" apuntar al archivo de esta
   carpeta. La asignación queda corta; el detalle vive acá.
3. Agregar el bloque "Tanda madurez de QA" a `specs/ASSIGNMENTS.md` con el orden de arriba. El
   tablero no tiene campo de dependencias: van en la columna Notas.
4. Al reclamar, re-verificar las cifras y rutas del archivo, y actualizar la columna "Hoy" de este
   tablero cuando el track cierre.

## Cómo se obtuvo la evidencia

Todo salió de leer el repositorio, de consultas de solo lectura al proyecto Supabase (plan de la
organización, lista de proyectos, estado de `cron.job`, conteo de cuentas) y de la API de GitHub
(visibilidad del repositorio, protección de `main`). **No se ejecutó ninguna suite ni se inició
sesión con ninguna cuenta**: las cifras son conteos de archivos y de llamadas, no resultados de
corridas.

| Dato                                 | Cómo reproducirlo                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Archivos de test por capa            | `git ls-files 'src/**/*.spec.ts'`, `'e2e/*.spec.ts'`, `'supabase/tests/**'`    |
| Qué corre en cada PR                 | `.github/workflows/ci.yml`                                                     |
| Vulnerabilidades                     | `npm audit --omit=dev`                                                         |
| Tareas programadas y sus corridas    | `select * from cron.job` y `cron.job_run_details`                              |
| Esperas fijas y saltos en e2e        | `grep -rn "waitForTimeout" e2e` y `grep -rn "test.skip(" e2e`                  |
