# 003 — Tests SQL en el CI

> **Fase:** 1 · **Prioridad sugerida:** P1 · **Tipo sugerido:** spec
> **Depende de:** `002` · **Desbloquea:** `011`, la matriz de permisos de `012`
> **Nivel hoy:** 1 (existen, se corren a mano) · **Meta:** 3 (corren en cada PR y bloquean)

## En una frase

Una migración que rompe un permiso o un candado de caja deja el PR en rojo antes de llegar a la base.

## El concepto

Una regla se prueba **en la capa donde vive**. Si "una secretaria no ve alumnos de otra sede" está
escrita como política de la base, el test que la protege tiene que hablarle a la base. Un test de
interfaz solo prueba que la pantalla no muestra el dato, no que el dato sea inaccesible.

Ideas del **testing de base de datos** (_database testing_):

- **Seguridad a nivel de fila** (_Row Level Security_, RLS): la base decide fila por fila qué ve y
  qué modifica cada usuario. Se prueba suplantando al usuario dentro de la sesión SQL.
- **Casos negativos** (_negative tests_): comprobar lo que **no** se puede hacer. En permisos son
  los más importantes y los que menos se escriben.
- **Aislamiento por transacción:** cada test abre una transacción, hace lo suyo y la deshace. No
  deja rastro y no depende del test anterior.
- **pgTAP:** la librería estándar para tests dentro de Postgres. Aporta afirmaciones (`ok`, `is`,
  `throws_ok`, `results_eq`) y un formato de salida, TAP, que cualquier herramienta de CI entiende.
  `supabase test db` la ejecuta.
- **Análisis estático de funciones:** `supabase db lint` revisa el código PL/pgSQL sin ejecutarlo y
  encuentra errores de tipos que de otro modo aparecen recién al correr.

## Por qué importa acá

Verificado el 2026-11-15:

- **65 tests SQL** en `supabase/tests/`: 29 de RLS, 10 de agenda, 5 de flota, 5 de caja, 5 de
  asistencia, 3 de promociones, 3 de auditoría, 2 de servicios y 1 de zona horaria, tareas y
  notificaciones. Son los tests de mayor riesgo de negocio del repo.
- **No tienen runner.** Ningún script de `package.json` ni workflow los ejecuta.
- **Se corren contra el proyecto real.** El encabezado de cada uno indica
  `npx supabase db query --linked -f <archivo>`, confiando en que la transacción se deshace.
- **El resultado se lee a mano.** El test termina con un `RAISE` cuyo mensaje trae `RESULT: …`; una
  corrida correcta se ve como un error, y `FALLA` hay que buscarlo en el texto.
- **No usan pgTAP** (0 archivos).

Por qué esto es un problema concreto y no de prolijidad:

- **Las funciones de la base se redefinen muchas veces.** `log_change()` tiene 14 versiones
  (`indices/DATABASE.md:160`). La versión del 2026-06-14 perdió por accidente dos comportamientos
  de la anterior y además dejó la función rota. Un test que corriera solo lo habría mostrado ese día.
- **Una política de RLS se puede debilitar sin querer** al reescribirla para otro caso. Sin tests
  automáticos, la corrección de aislamiento por sede de ayer no está protegida mañana.
- **Correr contra la base real no es gratis aunque se deshaga:** las secuencias avanzan, se toman
  bloqueos sobre tablas en uso, y un test al que se le borre el `RAISE` final confirmaría sus cambios.

## Qué hay hoy

- Los 65 tests, con un formato consistente: `BEGIN`, datos de base, `SET LOCAL role authenticated`
  suplantando una cuenta de prueba, bloques `DO` con las comprobaciones y `RAISE` final.
- Un meta-test que vigila una clase de error: `supabase/tests/rls/fix-363-m-auditoria-y-rpc.sql`
  comprueba que ninguna función `SECURITY DEFINER` quede sin la protección debida.
- 11 archivos e2e que prueban permisos por la API con `getClientFor()`, fuera de la interfaz.

## Cómo se hace

| Opción | Qué es | Costo | Resultado |
| ------ | ------ | ----- | --------- |
| **A. Runner propio** | Un script que recorre `supabase/tests/`, ejecuta cada archivo contra la base local, lee la línea `RESULT:` y devuelve éxito o falla | Bajo; los 65 tests no se tocan | Corre en CI esta misma iteración |
| **B. Migrar a pgTAP** | Reescribir los tests con afirmaciones estándar y usar `supabase test db` | Alto: 65 reescrituras | Reporte por afirmación, herramienta mantenida por otros |

**Recomendación: A ahora, B de a poco.** El runner propio entrega el valor de inmediato. Los tests
nuevos se escriben en pgTAP y los viejos se convierten cuando haya que tocarlos.

Sumar al mismo job, porque el costo es mínimo:

- **`supabase db lint`**: análisis estático de las funciones. El error que rompió `log_change()`
  (un operador de JSON aplicado a un tipo que no lo admite, que solo fallaba al ejecutarse) es de
  la familia que estas herramientas buscan.
- **Un inventario como test:** toda tabla del esquema público tiene RLS activada, y toda tabla con
  `branch_id` aparece en al menos un test de aislamiento por sede. Convierte "nos olvidamos de
  probar la tabla nueva" en un rojo.

Antes de `002` no hay forma segura de automatizarlos: programar un robot que corra 65 tests contra
la base real multiplica el riesgo que hoy se corre a mano.

## Alcance propuesto

- `npm run test:db`: corre todos los tests SQL contra la base local y devuelve un código de salida.
- Job de CI en cada PR que toque `supabase/`, y siempre en `main`.
- `supabase db lint` en el mismo job.
- Los tests que dependan de filas de la base real pasan a crear sus propios datos.
- El inventario de tablas con RLS.
- Una plantilla para tests nuevos y su explicación en `.claude/rules/testing-tdd.md`.

## Fuera de alcance

- Reescribir los 65 tests a pgTAP.
- Tests de concurrencia: son `011`, aunque reutilizan este job.
- Escribir tests de RLS nuevos: la matriz de permisos es `012`.

## Cómo saber que está terminado

- [ ] `npm run test:db` corre los 65 tests en un equipo con el entorno local y dice cuántos pasaron.
- [ ] Un test que falla deja el comando y el PR en rojo, con el nombre del test en el mensaje.
- [ ] Un PR de prueba que debilita una política de RLS queda en rojo.
- [ ] El job tarda menos de un tiempo acordado (sugerido: 5 minutos).
- [ ] Ningún test SQL del CI se conecta al proyecto real.
- [ ] Crear una tabla sin RLS deja el PR en rojo.

## Trampas conocidas

- **Simular la sesión no es lo mismo que una petición real.** `indices/DOMAIN-GOTCHAS.md` DG-049:
  una corrección se "verificó" con un fixture SQL que fijaba un parámetro de sesión que la API real
  nunca fija, y en producción seguía rota. Los tests SQL prueban la lógica de la política; lo que
  depende de cómo llega la sesión se prueba además por la API (los `getClientFor()` de los e2e).
- **Tests que pasan porque no probaron nada.** Un bloque que espera una excepción tiene que fallar
  si la excepción no ocurre. Revisarlo al portar.
- **Orden y dependencia entre archivos.** Cada test tiene que poder correr solo.
- **Datos con fechas.** Los tests actuales usan fechas del año 2099 para no chocar con cierres
  reales; en una base local eso deja de ser necesario, pero no molesta.
- **`SECURITY DEFINER`:** esas funciones se saltan la RLS. Su test debe suplantar a un rol sin
  permiso y comprobar que la función misma lo rechaza.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Si los tests nuevos se escriben en pgTAP desde ya | Equipo |
| Si el job bloquea el merge desde el primer día o empieza como informativo | Equipo |
| Tiempo máximo aceptable del job | Equipo |

## Vocabulario

- **RLS:** permisos por fila en la base.
- **pgTAP / TAP:** librería de tests para Postgres / formato estándar de resultados.
- **Negative test:** test de lo que debe estar prohibido.
- **Fixture:** datos preparados para un test.
- **Static analysis / lint:** revisar código sin ejecutarlo.
