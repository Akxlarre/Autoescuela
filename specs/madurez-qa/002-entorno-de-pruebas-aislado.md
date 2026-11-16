# 002 — Entorno de pruebas aislado

> **Fase:** 0 · **Prioridad sugerida:** P0 · **Tipo sugerido:** spec
> **Depende de:** nada · **Desbloquea:** `003`, `004`, `010`, `011`, `015`
> **Nivel hoy:** 0 (no existe) · **Meta:** 2 (se levanta solo en el CI con un comando)

## En una frase

Un robot puede crear, borrar y romper datos todas las veces que quiera sin tocar la base que usan
las personas.

## El concepto

Un **entorno** (_environment_) es un conjunto completo de app, base y servicios. Los nombres
habituales:

| Entorno | Para qué | Datos |
| ------- | -------- | ----- |
| Local / desarrollo | Escribir código | De mentira, se pueden romper |
| Pruebas / CI | Que corran los tests automáticos | Sembrados, se recrean en cada corrida |
| Preproducción (_staging_) | Ensayar una versión antes de publicarla | Parecidos a los reales, sin ser los reales |
| Producción | Los usuarios | Los reales |

Tres ideas sostienen el tema:

- **Aislamiento** (_isolation_): lo que pasa en un entorno no afecta a otro.
- **Paridad** (_parity_): cuanto más se parece el entorno de pruebas a producción, más vale lo que
  se prueba en él. Aislamiento y paridad tiran en sentidos opuestos, y cada opción elige un punto.
- **Entorno efímero** (_ephemeral environment_): se crea para una corrida y se destruye. No
  acumula basura ni se desvía con el tiempo.

Y el problema que siempre viene con los entornos, los **datos de prueba** (_test data
management_):

- **Semilla** (_seed_): el conjunto mínimo de datos con que nace el entorno.
- **Fábricas** (_factories_, _builders_): funciones que crean lo que un test necesita.
  `createE2eAlumno()` y `seedClase()` ya son fábricas.
- **Reproducible desde cero:** la base se puede construir solo con lo que hay en el repo.

## Por qué importa acá

Verificado el 2026-11-15:

- **Hay un solo proyecto Supabase** para la autoescuela. `src/environments/environment.ts` es el
  único archivo de entorno y `angular.json` no tiene `fileReplacements`, así que el build que se
  publica apunta a la misma base que `ng serve`.
- **Los e2e escriben ahí.** `e2e/support/env-guard.ts` permite un único proyecto, el mismo. El
  guard evita apuntar a otro lado por error, pero no hay otro lado.
- **Los tests SQL también.** Su encabezado indica correrlos con
  `npx supabase db query --linked -f …`, dentro de una transacción que termina en `RAISE` para
  deshacer los cambios.
- **`docs/DEPLOY.md` lo dice:** "Por ahora no hay ambiente QA".
- **Ya estaba previsto.** `ASG-i-021` dejó escrito que si un test no se podía escribir con las
  reglas de convivencia se evaluaría un proyecto separado para e2e.

Lo que cuesta compartir la base, hoy:

| Costo | Dónde se ve |
| ----- | ----------- |
| No se pueden afirmar totales exactos | Regla "sin conteos absolutos" de `docs/E2E-PLAYWRIGHT.md` |
| Tests que se saltan según los datos del día | 31 `test.skip` condicionales en `e2e/` |
| Datos `E2E-` que quedan si un test se corta | Sección de limpieza manual de la misma guía |
| Un error en un helper puede modificar filas reales | `limpiarAsistencia` borra asistencias y devuelve el kilometraje de vehículos |
| Cuentas de prueba con contraseña conocida junto a datos reales | `docs/E2E-PLAYWRIGHT.md` documenta la contraseña de `admin@test.com`, que ve todas las sedes |
| Automatizar es peligroso | Por eso `003` y `004` siguen manuales |

Sobre las cuentas de prueba: el build de producción no muestra la contraseña en el login
(`login.component.ts:36` la deja vacía fuera de modo desarrollo), pero la cuenta existe en la base
y su contraseña está en el repositorio, que es **público**. La mitigación inmediata está en el
punto 0 de `012`; la corrección de fondo es este trabajo: que esas cuentas existan solo en un
entorno de pruebas.

## Qué hay hoy

- `supabase/config.toml` y 298 migraciones: la base para levantar Supabase local.
- Evidencia de que alguien ya lo usa: `auto-create-next-promotions/index.test.ts` se conecta a un
  Postgres local, y varias correcciones de `log_change()` se verificaron "con Supabase local + Docker".
- Semillas parciales en `supabase/scripts/` (`seed_dev_alumnos_clase_b.sql`,
  `seed_d6_volumen.sql`), pero no un `supabase/seed.sql`.
- Fábricas de datos en `e2e/support/`.
- Una vista previa de Vercel por cada PR, que apunta a la misma base.

## Cómo se hace

| Opción | Aislamiento | Paridad | Costo | Límites |
| ------ | ----------- | ------- | ----- | ------- |
| **A. Supabase local** (Docker) en el CI y en cada equipo | Total, y efímero | Media: misma base, Auth, Storage y funciones; sin la red ni los límites reales | Gratis; minutos de CI | Exige que las migraciones levanten desde cero y una semilla; no prueba el correo real |
| **B. Segundo proyecto en la nube** | Total, persistente | Alta | Otro proyecto; el plan gratuito limita cuántos se pueden tener activos y la organización ya tiene dos | Se desvía si nadie le aplica las migraciones; hay que limpiarlo |
| **C. Ramas de Supabase** (_branching_) | Total, una por PR | Alta | Requiere plan Pro; se paga el cómputo de cada rama por hora | La rama nace con el esquema, sin datos: igual necesita semilla |
| **D. Seguir compartiendo** | Ninguno | Total | Cero | El estado actual |

**Recomendación: A como base.** Es gratis, es lo que la documentación de Supabase propone para CI,
y obliga a tener migraciones reproducibles, que es una capacidad que `001` también necesita. Si el
producto pasa a Pro, **C** se suma para probar cada PR contra un entorno en la nube.

La decisión más grande no es de herramienta: **¿el desarrollo diario sigue sobre la base que usan
los clientes?** Mientras sea así, cualquier migración a medio hacer o dato de prueba convive con
datos reales. Separarlo es un cambio de forma de trabajo para tres personas y merece conversarse
aparte.

### Qué hay que construir para A

1. **Migraciones que levanten desde cero.** `supabase db reset` aplica las 298 en orden. Es
   probable que algo falle la primera vez (DG-013 registra tres casos ya corregidos). Cada falla se
   corrige con una migración nueva o un ajuste que no cambie producción.
2. **Una semilla determinista** en `supabase/seed.sql`: roles, las dos sedes, las cuatro cuentas de
   prueba, cursos, un instructor y un vehículo por sede. Las cuentas se crean con la API de
   administración de Auth, no insertando en `auth.users` a mano.
3. **Que la app pueda apuntar al entorno local** sin editar código: un segundo archivo de entorno o
   configuración en tiempo de ejecución, y `env-guard.ts` aceptando la dirección local.
4. **Edge functions servidas localmente** con secretos de mentira; el correo local se captura en
   Mailpit, que viene con la CLI.
5. **Un job de CI** que haga todo lo anterior y falle si las migraciones no levantan.

## Alcance propuesto

- Los cinco puntos de arriba.
- Un comando documentado que deja el entorno listo en un equipo recién clonado.
- El job de "migraciones reproducibles" corriendo en cada PR que toque `supabase/`.

## Fuera de alcance

- Portar los tests: los SQL son `003`, los e2e son `004`.
- Copiar datos reales al entorno de pruebas. No se hace nunca: son datos personales.
- Mover el desarrollo diario fuera de la base real. Se decide aparte.

## Cómo saber que está terminado

- [ ] En un equipo recién clonado, un comando deja app y base funcionando, y `admin@test.com`
      inicia sesión.
- [ ] `supabase db reset` termina sin errores, y un job de CI lo comprueba.
- [ ] `e2e/smoke.spec.ts` pasa contra el entorno local.
- [ ] Ningún paso del CI se conecta al proyecto real.
- [ ] La semilla está en el repo y dos corridas seguidas dejan la base idéntica.
- [ ] La guía de `docs/` explica cómo levantarlo y cómo agregar datos a la semilla.

## Trampas conocidas

- **Tests atados a identificadores reales.** Los tests SQL usan filas que existen en la base
  actual (por ejemplo "Instructor 238 es de la sede 1" en `fix-445-m-egresos-caja-cerrada.sql`).
  O la semilla los reproduce, o el test crea lo suyo. Lo segundo es más sano.
- **Extensiones.** `pg_cron` y las llamadas HTTP desde la base se comportan distinto en local.
  Las tareas programadas conviene probarlas llamando a su función, no esperando el horario.
- **Auth hooks.** El correo de recuperación pasa por `send-auth-email` como hook; en local hay
  que declararlo en `config.toml` o apagarlo a propósito.
- **Buckets de Storage.** Si se crearon desde el panel y no por migración, no existirán en local.
- **Deriva** (_drift_): lo que se cambió a mano en el panel no está en ninguna migración. El primer
  `db reset` lo va a hacer visible. Es un hallazgo útil, no un obstáculo.
- **Un entorno persistente se pudre.** Si se elige B, sin un despliegue automático de migraciones
  queda atrasado en dos semanas.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Opción A sola, o A más C con plan Pro | Dueño del producto (junto con `001`) |
| Quién mantiene la semilla cuando cambia el esquema | Equipo |
| Si el desarrollo diario se separa de la base real, y cuándo | Equipo |
| Qué se hace con las cuentas de prueba en la base real una vez que exista el entorno aislado | Equipo |

## Vocabulario

- **Staging:** entorno de preproducción.
- **Seed:** datos iniciales de un entorno.
- **Drift:** diferencia entre lo que dice el repo y lo que hay en la base real.
- **Ephemeral:** que se crea y se destruye por corrida.
- **Parity:** qué tanto se parece un entorno a producción.
