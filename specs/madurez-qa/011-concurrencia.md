# 011 — Concurrencia

> **Fase:** 3 · **Prioridad sugerida:** P2 · **Tipo sugerido:** spec
> **Depende de:** `003` (reutiliza su job con base local) · **Desbloquea:** nada
> **Nivel hoy:** 1 (un test, fuera del CI) · **Meta:** 2

## En una frase

Dos personas haciendo lo mismo en el mismo segundo no pueden dejar un cupo vendido dos veces ni un
pago registrado doble.

## El concepto

Un sistema con varios usuarios ejecuta operaciones al mismo tiempo. Un error de **concurrencia**
aparece cuando el resultado depende del orden exacto en que se intercalan. Se llama **condición de
carrera** (_race condition_).

La forma más común es **comprobar y después actuar** (_check-then-act_, o TOCTOU):

```text
Secretaria A: ¿está libre el martes a las 10? → sí
Secretaria B: ¿está libre el martes a las 10? → sí
Secretaria A: agenda
Secretaria B: agenda          ← dos clases en el mismo cupo
```

Cada una hizo lo correcto. El error está entre la pregunta y la acción.

Otras formas:

- **Actualización perdida** (_lost update_): dos personas abren el mismo registro, las dos
  guardan, y la segunda pisa lo de la primera sin saberlo.
- **Doble envío** (_double submit_): doble clic, o reintento de red, sobre una acción que no es
  idempotente.
- **Tarea automática contra persona:** una tarea programada modifica filas que alguien está
  editando.

**Las defensas**, de más fuerte a más débil:

| Defensa | Cómo | Nota |
| ------- | ---- | ---- |
| Restricción de la base | `UNIQUE`, exclusión por rango | El motor rechaza la segunda escritura. No depende de que el código se acuerde |
| Bloqueo de fila | `SELECT … FOR UPDATE` dentro de una transacción | La segunda operación espera a la primera |
| Bloqueo de aviso | `pg_advisory_xact_lock` | Para serializar algo que no es una fila |
| Control optimista | Guardar solo si la versión no cambió desde que se leyó | Detecta la actualización perdida |
| Llave de idempotencia | Identificar la operación para no repetirla | Contra el doble envío |
| Deshabilitar el botón | En la interfaz | Mejora la experiencia; no es una defensa |

Un dato del motor que explica por qué pasa: el nivel de aislamiento por defecto de Postgres
(_read committed_) permite que dos transacciones lean el mismo estado antes de que ninguna escriba.

Estos errores **no aparecen en los tests normales**, porque un test ejecuta una cosa a la vez.

## Por qué importa acá

Verificado el 2026-11-15:

- **El dominio es de recursos compartidos:** un cupo es la combinación de instructor, vehículo y
  horario; dos secretarias por sede lo disputan, más el alumno desde su portal cuando se habilite.
- **Las defensas existen como código, no como restricciones.** 52 migraciones usan `FOR UPDATE`,
  6 usan bloqueos de aviso y ninguna usa una restricción de exclusión.
- **Ya hubo carreras reales:** `fix-187-b` (vehículo doble agendado), `fix-376-m` (vehículo con
  más de una clase en curso), `fix-228-m` (promociones duplicadas por dos ejecuciones solapadas),
  y `fix-028-m`, donde la tarea de fin de jornada pisaba una fila que ella misma había cancelado
  antes en la misma corrida (`indices/DATABASE.md:134`).
- **Hay un solo test de concurrencia:**
  `supabase/functions/auto-create-next-promotions/index.test.ts` abre dos conexiones y dispara
  `reserve_next_promotion_slot()` en paralelo. Necesita una base local y por eso está excluido del
  CI (`.github/workflows/ci.yml`).
- **Los 65 tests SQL corren en una sola sesión:** no pueden ver una carrera.

## Qué hay hoy

- El test de promociones, que sirve de plantilla.
- El fixture `pageAs()` de los e2e, que permite dos roles en dos navegadores dentro del mismo test.
- `getClientFor()`, para llamar a la API con dos sesiones a la vez.
- `createRequestGuard()` en los facades, que resuelve otra carrera: respuestas de red que llegan
  fuera de orden en el navegador.

## Cómo se hace

### 1. Inventario

Una tabla de operaciones críticas, con su defensa actual:

| Operación | Carrera posible | Defensa hoy |
| --------- | --------------- | ----------- |
| Agendar una clase | Dos secretarias, mismo cupo | Por completar |
| Agendar con el mismo vehículo desde dos instructores | Vehículo doble | Por completar |
| Registrar un pago | Doble clic; dos pestañas | Por completar |
| Cerrar la caja mientras otra persona registra un pago | El cierre no incluye el pago | Por completar |
| Asignar número de matrícula | Dos matrículas, mismo número | Por completar |
| Último cupo de una promoción profesional | Dos inscripciones | Por completar |
| Reagendar "todo o nada" | Queda a medias | Por completar |
| Descartar un borrador mientras se paga | Pago sobre una matrícula cancelada | Por completar |
| Retorno del pago en línea, dos veces | Doble matrícula | Llave de sesión |
| Tarea de fin de jornada contra edición manual | Estado pisado | Por completar |

Completar la tercera columna leyendo el código es la primera mitad del trabajo. Donde la respuesta
sea "ninguna", sale un fix.

### 2. Cómo se prueba una carrera

- **A nivel de base, por fuerza bruta:** N conexiones disparan la misma operación a la vez; se
  afirma que exactamente una tuvo éxito y que el estado final es coherente. Como una carrera es
  cuestión de probabilidad, se repite muchas veces.
- **A nivel de base, forzando el orden:** dos sesiones con transacciones explícitas. La sesión A
  hace el primer paso y se detiene; la B hace todo; la A termina. Es determinista: prueba un
  intercalado concreto, no depende de la suerte.
- **A nivel de API:** dos clientes con sesiones distintas llaman en paralelo.
- **A nivel de interfaz:** doble clic sobre el botón; dos navegadores sobre el mismo registro.

### 3. Cómo se corrige

En orden de preferencia: una restricción de la base si la regla se puede expresar; si no, mover la
comprobación y la escritura a una sola función con bloqueo; para el doble envío, una llave de
idempotencia.

Para el solape de clases, Postgres tiene una restricción hecha para eso: exclusión sobre el rango
de tiempo, por instructor y por vehículo, limitada a las clases no canceladas. Con ella el doble
agendamiento deja de depender del código.

## Alcance propuesto

- El inventario completo, con la defensa de cada operación.
- Un test de carrera por cada operación de prioridad alta, corriendo en el job con base local.
- El test de promociones existente, dentro del CI.
- Un fix por cada operación sin defensa.
- Una regla en la guía de base de datos: toda operación que comprueba y después escribe declara su
  defensa.

## Fuera de alcance

- Pruebas de carga (cuántos usuarios aguanta): es rendimiento, `016`.
- Edición colaborativa en tiempo real.
- Reescribir las defensas que ya funcionan.

## Cómo saber que está terminado

- [ ] El inventario está en un índice y cada operación tiene su defensa nombrada.
- [ ] Cada operación de prioridad alta tiene un test que falla si se quita su defensa (comprobado
      quitándola).
- [ ] Los tests de carrera corren en el CI.
- [ ] Ninguna operación crítica queda con "ninguna" como defensa.
- [ ] Un doble clic en "Registrar pago" produce un solo pago.

## Trampas conocidas

- **El test que pasa por suerte.** Si las dos operaciones no llegan a solaparse, el test queda
  verde sin haber probado nada. Repetir muchas veces o forzar el intercalado, y comprobar que el
  test falla cuando se quita la defensa.
- **Interbloqueo** (_deadlock_): dos transacciones que toman los mismos bloqueos en orden distinto
  se esperan mutuamente. Tomar los bloqueos siempre en el mismo orden.
- **Transacciones largas.** Un bloqueo retenido mientras se llama a un servicio externo frena a
  todos los demás.
- **Bloqueos de aviso con la misma llave.** Dos funciones distintas que usan el mismo número se
  bloquean entre sí sin motivo.
- **Confiar en el botón deshabilitado.** Protege de un doble clic, no de dos personas.
- **Restricción sobre datos que ya la violan.** Antes de crearla hay que limpiar los datos
  existentes (ver `008`).

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué operaciones son de prioridad alta | Equipo, con quien conoce la operación |
| Qué ve la segunda persona cuando pierde la carrera | Dueño del producto |
| Si el solape de agenda pasa a restricción de exclusión | Equipo |

## Vocabulario

- **Race condition:** el resultado depende del orden de ejecución.
- **Check-then-act / TOCTOU:** comprobar y después actuar, con una ventana en medio.
- **Lost update:** una escritura pisa a otra sin saberlo.
- **Lock:** bloqueo que hace esperar a otros.
- **Optimistic concurrency:** guardar solo si nadie cambió el dato desde que se leyó.
- **Deadlock:** dos operaciones que se esperan mutuamente.
- **Isolation level:** qué tanto ve una transacción de las demás.
