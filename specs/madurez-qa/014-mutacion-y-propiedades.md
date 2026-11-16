# 014 — Pruebas de mutación y por propiedades

> **Fase:** 4 · **Prioridad sugerida:** P2 · **Tipo sugerido:** spec
> **Depende de:** `005` (cobertura medida) · **Desbloquea:** nada
> **Nivel hoy:** 0 (no existe) · **Meta:** 1 (se corre a demanda sobre el código de dinero y fechas)

## En una frase

Se sabe si los tests de dinero y fechas detectarían un error, no solo si pasan por ese código.

## El concepto

Son dos técnicas distintas que atacan la misma debilidad: los tests con ejemplos elegidos a mano
solo prueban lo que a alguien se le ocurrió.

### Pruebas de mutación (_mutation testing_)

La pregunta: **¿mis tests se darían cuenta si el código estuviera mal?**

Una herramienta introduce un error pequeño en el código (un **mutante**): cambia `>` por `>=`,
`+` por `-`, borra una condición, devuelve siempre `true`. Después corre los tests.

- Si algún test falla, el mutante **murió** (_killed_): los tests lo detectaron.
- Si todos pasan, el mutante **sobrevivió** (_survived_): hay un error posible que ningún test ve.

El **puntaje de mutación** (_mutation score_) es el porcentaje de mutantes muertos. Dice lo que la
cobertura no puede: una línea puede estar cubierta al 100 % y no tener ninguna afirmación que
dependa de ella.

Los sobrevivientes típicos señalan huecos concretos: bordes sin probar (`>` contra `>=`),
condiciones cuyo efecto nadie afirma, valores de retorno que nadie mira.

Un **mutante equivalente** es un cambio que no altera el comportamiento; no se puede matar y se
descarta a mano. Por eso el 100 % no es la meta.

Su costo es el tiempo: corre la suite una vez por mutante. Se aplica a poco código, el que más
importa.

### Pruebas por propiedades (_property-based testing_)

La pregunta: **¿qué es verdad para cualquier entrada, no solo para mis ejemplos?**

En vez de escribir "para esta fecha, el resultado es este", se escribe una **propiedad**: "para
cualquier fecha y cualquier número de días, sumar y después restar devuelve la fecha original".
La herramienta genera cientos de entradas al azar y busca una que rompa la propiedad.

Cuando encuentra una, la **reduce** (_shrinking_) al caso más simple que sigue fallando, e informa
la **semilla** (_seed_) para reproducirlo.

Tipos de propiedad que sirven casi siempre:

| Tipo | Idea | Ejemplo |
| ---- | ---- | ------- |
| Ida y vuelta (_round-trip_) | Hacer y deshacer devuelve el original | Convertir fecha a texto y de vuelta |
| Invariante | Algo se conserva | La suma de las partes es el total |
| Idempotencia | Aplicar dos veces da lo mismo que una | Normalizar un RUT |
| Orden indiferente | El resultado no depende del orden | Sumar pagos |
| Monotonía | Más entrada nunca da menos salida | Más horas, no menos sueldo |
| Comparación con un modelo | Coincide con una versión simple y obviamente correcta | Dos implementaciones del mismo cálculo |

El último se llama **prueba diferencial** (_differential testing_) y es muy potente cuando hay dos
implementaciones de lo mismo.

## Por qué importa acá

Verificado el 2026-11-15:

- **La arquitectura lo favorece.** La regla del núcleo funcional (`architecture.md`) pide sacar la
  lógica a funciones puras en `core/utils/`. Hay 146 archivos y unas 9.700 líneas ahí, con 140
  specs. Las funciones puras son el terreno ideal para las dos técnicas.
- **Hay código donde un error de borde cuesta dinero:** `anulacion-pago.utils`,
  `cuadratura-hero-kpis.utils`, `cuadratura-medio-pago.utils`, `draft-payment.utils`,
  `estado-pago-clase.utils`, `ficha-pagos.utils`, `payment-concept.utils`,
  `payment-status.utils`; y en las edge functions, `payroll-totals`, `cash-arqueo`,
  `certificate-debt`.
- **Las fechas son un riesgo declarado.** `dates.md` existe porque el día de Chile y el de UTC
  difieren varias horas cada noche. `chile-time.utils.ts` se prueba en tres zonas horarias
  (`scripts/test-tz.mjs`), con ejemplos elegidos a mano.
- **Hay dos implementaciones del mismo cálculo:** la de la app y la copia espejo de las edge
  functions (`supabase/functions/_shared/chile-time.ts`), que hoy se mantienen alineadas con "los
  mismos vectores de test". Es el caso de manual para una prueba diferencial.
- **No hay ninguna de las dos herramientas** en `package.json`.
- **La cobertura no se mide** (`005`), así que hoy tampoco se sabe qué líneas están sin probar.

## Qué hay hoy

- Vitest, con 140 specs de utilidades.
- `scripts/test-tz.mjs`, que ya corre los tests en varias zonas horarias.
- La cultura de trinquetes para no retroceder.

## Cómo se hace

### Mutación

- Herramienta habitual en TypeScript: StrykerJS, que tiene un ejecutor para Vitest. Confirmar la
  compatibilidad con la versión de Vitest del proyecto antes de adoptarla.
- **Alcance mínimo:** los archivos de dinero y `chile-time.utils.ts`. No todo `core/utils`.
- **Cuándo corre:** a demanda y una vez por semana. No en cada PR.
- **Cómo se usa el resultado:** cada sobreviviente es una pregunta. "Si esta condición no
  estuviera, ¿debería fallar algún test?" Casi siempre la respuesta es un test que falta.
- **Meta:** un puntaje acordado en esos archivos, con trinquete.

### Propiedades

Librería habitual: fast-check, que se usa dentro de Vitest. Propiedades candidatas:

**Fechas**

- Sumar N días y restar N días devuelve la fecha original.
- La diferencia en días entre una fecha y esa fecha más N es N.
- El inicio del rango de un día pertenece a ese día; el instante anterior al fin exclusivo, también.
- El lunes de la semana de una fecha es lunes, no es posterior a la fecha y está a menos de 7 días.
- Todo lo anterior, con un generador que insista en los días de cambio de hora de Chile (días de
  23 y de 25 horas) y en la franja nocturna en que Chile y UTC están en días distintos.
- Diferencial: para cualquier instante, la utilidad de la app y la copia de las edge functions
  devuelven lo mismo.

**Dinero**

- La suma de las partes de un pago es su total.
- Repartir un monto en N cuotas suma exactamente el monto. El peso chileno no tiene decimales, así
  que el redondeo es donde se pierden pesos.
- Un descuento nunca deja un precio negativo.
- El saldo después de aplicar pagos no depende del orden en que se aplican.
- Anular un pago y recalcular devuelve el saldo anterior.

**Nómina**

- Más horas trabajadas nunca da menos pago.
- La suma por instructor es el total.

**Validaciones**

- Todo RUT con dígito verificador correcto se acepta; cambiarle un dígito lo vuelve inválido.

**Layout**

- El recorte por presupuesto nunca devuelve más elementos que el presupuesto y conserva el orden.

### Cuándo usar cada cosa

| Situación | Técnica |
| --------- | ------- |
| Un caso de negocio concreto que debe documentarse | Ejemplo |
| Una regla que vale para toda entrada | Propiedad |
| Un bug encontrado por una propiedad | El caso reducido se agrega como ejemplo fijo |
| Duda sobre si los tests de un archivo son buenos | Mutación |

## Alcance propuesto

- fast-check instalado, con un primer grupo de propiedades de fechas y dinero.
- La prueba diferencial entre las dos copias de `chile-time`.
- Stryker configurado para un conjunto pequeño de archivos, con su puntaje inicial registrado.
- Una sección en `.claude/rules/testing-tdd.md`: cuándo una propiedad, cuándo un ejemplo.

## Fuera de alcance

- Mutación sobre componentes o facades.
- Mutación en cada PR.
- Llevar el puntaje al 100 %.

## Cómo saber que está terminado

- [ ] Las propiedades de fechas y dinero corren dentro de `test:ci`.
- [ ] Una propiedad que falla informa la semilla y el caso reducido.
- [ ] La prueba diferencial falla si se modifica una sola de las dos copias de `chile-time`.
- [ ] Hay un comando para correr mutación sobre los archivos elegidos y su puntaje está registrado.
- [ ] Los sobrevivientes de la primera corrida están revisados: test agregado o descarte anotado.
- [ ] La guía de testing explica cuándo usar cada técnica.

## Trampas conocidas

- **La propiedad que repite la implementación.** Si el test calcula el resultado esperado con la
  misma fórmula que el código, no prueba nada. Las propiedades describen relaciones, no el cálculo.
- **Generadores que producen basura.** Entradas que el sistema nunca recibiría hacen fallar
  propiedades por motivos irrelevantes. Acotar el generador a lo válido.
- **No determinismo.** Una propiedad que usa la fecha de hoy falla un día y otro no. Fijar el
  reloj, y registrar la semilla cuando falla.
- **Tiempo de CI.** Cientos de casos por propiedad suman. Ajustar la cantidad de corridas.
- **Mutación sobre demasiado código.** Tarda horas y entrega una lista que nadie lee. Empezar
  chico.
- **Perseguir el puntaje.** Igual que con la cobertura: es un instrumento para encontrar tests
  que faltan, no un número que cumplir.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué archivos entran en mutación | Equipo |
| Puntaje mínimo y si lleva trinquete | Equipo |
| Si una función nueva de dinero o fechas exige al menos una propiedad | Equipo |

## Vocabulario

- **Mutant:** copia del código con un error pequeño introducido a propósito.
- **Killed / survived:** el mutante fue detectado / no lo fue.
- **Mutation score:** porcentaje de mutantes detectados.
- **Property:** afirmación que debe valer para cualquier entrada.
- **Generator:** lo que produce las entradas al azar.
- **Shrinking:** reducir un caso que falla al más simple posible.
- **Seed:** número que permite repetir la misma secuencia al azar.
- **Differential testing:** comparar dos implementaciones del mismo cálculo.
