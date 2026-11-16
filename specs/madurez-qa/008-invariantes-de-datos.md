# 008 — Invariantes de datos (dinero, agenda, auditoría)

> **Fase:** 2 · **Prioridad sugerida:** P1 · **Tipo sugerido:** spec
> **Depende de:** `007` para avisar (puede empezar sin él) · **Desbloquea:** nada
> **Nivel hoy:** 0 (no existe) · **Meta:** 3 (corre cada noche y avisa)

## En una frase

Si los datos reales dejan de cuadrar, el sistema lo detecta esa misma noche, sin importar qué bug
lo causó.

## El concepto

Un **invariante** es una afirmación sobre los datos que tiene que ser verdad siempre. "El saldo de
una matrícula es igual a su precio menos lo pagado." "Un vehículo no está en dos clases a la misma
hora."

Hay dos formas de defender un invariante:

| Defensa | Cómo | Cuándo actúa |
| ------- | ---- | ------------ |
| **Preventiva** | Restricciones de la base: `CHECK`, `UNIQUE`, llaves foráneas, exclusión por rango | Rechaza la escritura inválida |
| **Detectiva** | Una consulta que busca violaciones en los datos ya guardados | Encuentra el daño después |

La preventiva es mejor cuando se puede. La detectiva hace falta igual, por tres razones: no todo
se puede expresar como restricción, las reglas implementadas con código (triggers, funciones)
pueden tener errores, y los datos que ya estaban mal antes de agregar una restricción siguen ahí.

Conceptos cercanos:

- **Conciliación** (_reconciliation_): comparar dos fuentes que deberían coincidir. El saldo
  guardado contra la suma de los pagos. Es el control clásico de cualquier sistema con dinero.
- **Valor derivado guardado:** un número que se calcula a partir de otros y se almacena. Es
  rápido de leer y puede desincronizarse de su origen. Todo valor derivado guardado merece un
  invariante.
- **Consulta canario** (_canary query_): un chequeo cuyo único fin es avisar cuando algo dejó de
  pasar.

Lo valioso de este enfoque es que **no depende de la causa**. No importa si el daño lo hizo un
bug, una migración, una edición a mano en el panel o una condición de carrera: el chequeo mira el
resultado.

## Por qué importa acá

Verificado el 2026-11-15:

- **El sistema maneja dinero y deja valores derivados guardados.** El saldo de la matrícula lo
  mantiene un trigger sobre `payments` (`recalculate_enrollment_balance()`,
  `indices/DATABASE.md:160`). El cierre de caja guarda totales calculados en el navegador en el
  momento de cerrar (`swr-pattern.md` describe el riesgo de cerrar con totales viejos).
- **Las reglas de agenda están en código, no en restricciones.** Ninguna migración usa una
  restricción de exclusión (`EXCLUDE USING`: 0 archivos). Que un instructor o un vehículo no tenga
  dos clases solapadas lo garantizan funciones y triggers (52 migraciones usan `FOR UPDATE`, 6 usan
  bloqueos de aviso). Es código, y el código tuvo errores: `fix-187-b` (vehículo doble agendado),
  `fix-376-m` (vehículo con más de una clase en curso).
- **La auditoría falló en silencio siete semanas** (`log_change()`, ver `007`). Un invariante
  simple lo habría mostrado el primer día: "si ayer hubo cambios en tablas auditadas, ayer hay
  filas en `audit_log`".
- **Los candados de caja cerrada son triggers** (`guard_egreso_en_caja_cerrada`,
  `guard_venta_servicio_caja_cerrada`, `guard_anulacion_pago`). Un invariante comprueba que
  ninguno fue esquivado.
- **Ningún test puede dar esta garantía**, porque los tests corren sobre datos de prueba y esto
  mira los datos reales.

## Qué hay hoy

- Las funciones `chile_today()` y `chile_date()` para que los chequeos usen el día de Chile.
- `pg_cron` ya en uso, con 10 tareas.
- El patrón de lista de excepciones justificadas (`e2e/support/known-errors.ts`,
  `scripts/lib/*.allowlist.json`), reutilizable para violaciones históricas aceptadas.
- Los 65 tests SQL, que describen muchas de estas reglas para datos de prueba.

## Cómo se hace

### La pieza

Una función de solo lectura que ejecuta cada chequeo y devuelve, por invariante: nombre, gravedad,
cuántas filas lo violan y algunos identificadores de muestra. Una tarea nocturna la corre, guarda
el resultado en una tabla y, si algún conteo es mayor que cero, avisa por el canal de `007`.

### Invariantes candidatos

Son propuestas a validar contra el esquema y con quien conoce el negocio. Cada uno necesita su
definición exacta antes de escribirse.

**Dinero**

| Invariante | Detecta |
| ---------- | ------- |
| El saldo guardado de cada matrícula coincide con precio, descuentos y pagos no anulados | Trigger de saldo roto; pagos editados por fuera |
| El total de cada pago es la suma de sus partes (efectivo, transferencia, tarjeta, vale) | Errores al registrar pagos mixtos |
| Todo pago anulado tiene quién, cuándo y motivo | Anulaciones por un camino que esquiva el candado |
| Los totales de un cierre de caja coinciden con los movimientos de ese día y sede, recalculados | Cierres con datos viejos; movimientos agregados después |
| No hay movimientos de dinero creados después del cierre con fecha de un día cerrado, salvo ajustes registrados | Candados de caja esquivados |

**Agenda**

| Invariante | Detecta |
| ---------- | ------- |
| Ningún instructor tiene dos clases no canceladas solapadas | Condiciones de carrera al agendar |
| Ningún vehículo tiene dos clases no canceladas solapadas | Lo mismo |
| Ningún alumno tiene dos clases solapadas | Lo mismo |
| El vehículo de cada clase atiende la sede de esa clase | Regresiones de la lógica multi-sede |
| No quedan clases "agendadas" de días anteriores | La tarea de fin de jornada no corrió o falló |

**Ciclo de vida**

| Invariante | Detecta |
| ---------- | ------- |
| No hay borradores de matrícula vencidos hace más de un día | La tarea de limpieza no corre |
| El número de matrícula no se repite dentro de su ámbito | Carreras al asignar número |
| Toda fila que requiere sede la tiene | Regresiones de aislamiento por sede |

**Auditoría**

| Invariante | Detecta |
| ---------- | ------- |
| Si ayer hubo cambios en tablas auditadas, ayer hay filas en `audit_log` | `log_change()` rota |
| Ninguna acción de una secretaria quedó atribuida a "Sistema" | Regresión de la atribución de usuario |

### Tres usos del mismo código

1. **Cada noche sobre los datos reales:** la detección.
2. **En el CI sobre la semilla:** tiene que dar cero. Si no, la semilla o una migración están mal.
3. **Al final de la corrida e2e:** la suite tiene que dejar los datos consistentes. Encuentra
   bugs de escritura que ningún test individual afirma.

### La primera corrida

Lo normal es que encuentre violaciones históricas. Se clasifican una por una: corregir el dato,
corregir el código que lo produjo, o aceptarla en una lista de excepciones con motivo. El trabajo
no termina hasta que la línea base está clasificada.

### Promover a restricción

Cuando un invariante lleva tiempo en cero y es barato de comprobar en cada escritura, conviene
convertirlo en restricción de la base. Para los solapes de agenda existe la restricción de
exclusión por rango de tiempo, que hace imposible el doble agendamiento a nivel del motor.

## Alcance propuesto

- La función de chequeos, la tabla de resultados y la tarea nocturna.
- Un primer conjunto acordado de invariantes de dinero, agenda y auditoría.
- La línea base clasificada.
- El aviso cuando aparece una violación nueva.
- La corrida en el CI y al final de los e2e.
- En la definición de terminado de los tracks: una feature que toca dinero o agenda agrega su
  invariante.

## Fuera de alcance

- Corregir los datos históricos: cada hallazgo va a su propio fix.
- Convertir invariantes en restricciones: se hace uno por uno, después.
- Una pantalla para verlos. Alcanza con la tabla y el aviso.

## Cómo saber que está terminado

- [ ] La tarea corre cada noche y deja un resultado por invariante.
- [ ] Romper un invariante a mano en el entorno de pruebas genera el aviso.
- [ ] Cada violación histórica está corregida o aceptada con motivo.
- [ ] Los invariantes dan cero sobre la semilla, y el CI lo comprueba.
- [ ] Están escritos, en lenguaje de negocio, en un índice que el dueño puede leer.
- [ ] Quien conoce la operación de la escuela revisó la lista.

## Trampas conocidas

- **Estados legítimos que parecen violaciones.** Una matrícula con saldo perdonado, una clase
  reagendada. Si el chequeo los marca, el equipo aprende a ignorar el aviso. Definir con precisión.
- **Zona horaria.** "Ayer" y "hoy" son los de Chile: `chile_date()`, nunca la fecha de UTC.
- **Costo.** Recorrer tablas completas cada noche crece con los datos. Acotar por fecha de
  modificación cuando el invariante lo permite.
- **Datos personales en el aviso.** El aviso lleva conteos e identificadores, no nombres ni RUT.
- **Un chequeo con errores no avisa.** La tarea misma necesita su latido (`007`).
- **Confundir ausencia de avisos con datos sanos.** Si la lista de excepciones crece sin control,
  el chequeo deja de mirar.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué invariantes entran en la primera versión | Equipo, con quien conoce la operación |
| Qué significa exactamente "cuadrar" en saldo y en caja | Dueño de la escuela |
| Quién corrige un dato real cuando aparece una violación, y cómo queda registrado | Equipo |

## Vocabulario

- **Invariant:** afirmación que debe ser verdad siempre.
- **Reconciliation:** comparar dos fuentes que deben coincidir.
- **Constraint:** restricción que la base aplica en cada escritura.
- **Exclusion constraint:** restricción que impide que dos filas se solapen.
- **Derived value:** valor calculado a partir de otros y guardado.
- **Data integrity:** que los datos sean coherentes entre sí y con las reglas del negocio.
