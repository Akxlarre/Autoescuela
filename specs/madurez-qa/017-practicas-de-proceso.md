# 017 — Prácticas de proceso

> **No es una asignación.** Son hábitos: se adoptan y se mantienen, no se "cierran".
> Lo que sí conviene hacer una vez es decidir cuáles se adoptan y dónde quedan escritas.

## Para qué sirve este archivo

Las otras dieciséis capacidades son cosas que se construyen. Estas cinco son formas de trabajar
que deciden si lo construido se usa bien: dónde poner el esfuerzo, cómo encontrar lo que nadie
pensó probar, cuándo algo está terminado, qué hacer con un bug y qué mirar cada semana.

---

## 1. Pruebas basadas en riesgo

### El concepto

No se puede probar todo. La **estrategia basada en riesgo** (_risk-based testing_) decide dónde
poner el esfuerzo con una pregunta simple por cada cosa que puede salir mal:

**Riesgo = probabilidad de que ocurra × impacto si ocurre.**

Se mantiene una tabla, el **registro de riesgos** (_risk register_). Cada fila tiene el riesgo, su
probabilidad e impacto (alto, medio, bajo alcanza), qué lo controla hoy y qué falta. Lo de riesgo
alto se prueba a fondo y en varias capas; lo de riesgo bajo, poco o nada, a conciencia.

El valor está en que la decisión de qué no probar queda escrita, en vez de ocurrir por omisión.

### Registro inicial

Una primera versión con lo encontrado el 2026-11-15, para discutir y corregir:

| Riesgo | Prob. | Impacto | Qué lo controla hoy | Qué falta |
| ------ | ----- | ------- | ------------------- | --------- |
| Pérdida de la base o de los documentos | Baja | Crítico | Nada | `001` |
| Acceso de un tercero con una cuenta de prueba | Media | Crítico | Nada | `012`, `002` |
| Un robot o un error de test modifica datos reales | Media | Alto | Reglas de convivencia de los e2e | `002` |
| Una secretaria ve o modifica datos de otra sede | Media | Alto | RLS y sus tests, corridos a mano | `003`, `012` |
| Caja cerrada con totales incorrectos | Baja | Alto | Candados en la base; regla de carga fallida | `008` |
| Doble agendamiento de instructor o vehículo | Media | Medio | Funciones y triggers | `011`, `008` |
| Un error en producción que nadie reporta | Alta | Medio | Nada | `007` |
| Una tarea programada deja de hacer su trabajo | Media | Medio | Nada | `007` |
| Pago en línea duplicado o perdido | Baja | Alto | Llave de idempotencia sin test | `010` |
| Un contrato o certificado cambia sin revisión | Baja | Alto | Nada | `013` |
| Una publicación sube bien y no funciona | Baja | Medio | Revisión manual | `009` |
| Un PR rompe una pantalla sin que nadie lo vea | Media | Medio | E2E corridos a mano | `004`, `006` |
| Error de fechas de noche o en cambio de hora | Media | Medio | Regla de fechas, lint y tests en tres zonas | `014` |
| Dependencia con una vulnerabilidad explotable | Baja | Alto | Nada para npm | `012` |

### Cómo se mantiene

Se revisa cuando entra un módulo nuevo y después de cada incidente. Un riesgo que se materializó
sin estar en la tabla es la lección más útil que puede dar.

---

## 2. Pruebas exploratorias

### El concepto

Un test automático comprueba lo que alguien pensó. La **prueba exploratoria** (_exploratory
testing_) busca lo que nadie pensó: una persona usa el sistema con un objetivo, sin guion,
decidiendo el siguiente paso según lo que va viendo.

No es "probar al azar". Se hace por **sesiones** (_session-based testing_):

- **Una misión** (_charter_): "Explorar *esto*, con *estos recursos*, para descubrir *aquello*."
- **Tiempo acotado:** 60 a 90 minutos.
- **Notas** mientras se prueba: qué se hizo, qué se encontró, qué quedó sin mirar.
- **Cierre** de 10 minutos: bugs, dudas, ideas de tests automáticos.

### Preguntas que sirven de guía

| Familia | Pregunta |
| ------- | -------- |
| Bordes | ¿Qué pasa con cero, con uno, con muchísimos, con el máximo? |
| Interrupciones | ¿Y si recargo a la mitad? ¿Si cierro la pestaña? ¿Si vuelvo atrás? |
| Permisos | ¿Y si lo intento con otro rol? ¿Con otra sede? ¿Pegando la dirección directo? |
| Tiempo | ¿De noche en Chile? ¿El último día del mes? ¿En un feriado? ¿En cambio de hora? |
| Dos a la vez | ¿Dos pestañas? ¿Dos personas sobre el mismo registro? |
| Red | ¿Con conexión lenta? ¿Si se corta al guardar? |
| Orden | ¿Y si hago los pasos en otro orden del previsto? |
| Datos raros | ¿Nombres con tilde y apóstrofo? ¿Un texto larguísimo? ¿Un RUT con K? |
| Deshacer | ¿Puedo anular lo que hice? ¿Y anular la anulación? |

### Misiones sugeridas para este sistema

1. Explorar el **cierre de caja** con dos secretarias de la misma sede, para descubrir formas de
   que el total cerrado no coincida con los movimientos.
2. Explorar la **agenda** entre las 20:00 y la medianoche, para descubrir clases que aparecen en
   el día equivocado.
3. Explorar la **matrícula presencial** interrumpiéndola en cada paso, para descubrir borradores
   que quedan en un estado sin salida.
4. Explorar la **secretaria con permiso multi-sede**, para descubrir pantallas que mezclan datos
   de las dos sedes o que no le dejan elegir.
5. Explorar la **anulación de pagos**, para descubrir saldos que no vuelven a su valor.
6. Explorar cualquier módulo **solo con teclado**, para descubrir acciones inalcanzables.
7. Explorar **con conexión lenta**, para descubrir botones que se pueden apretar dos veces.
8. Explorar el **portal del instructor** desde un teléfono, cuando salga del piloto.

### Cuándo

Una sesión por módulo antes de cada publicación con cambios grandes, y una cuando entra una
feature nueva. Rinde más cuando la hace alguien que no escribió el código.

---

## 3. Definición de terminado

### El concepto

La **definición de terminado** (_Definition of Done_) es la lista de condiciones que un cambio
cumple para considerarse completo. Evita que "terminado" signifique "funciona en mi equipo".

El proyecto ya tiene una parte fuerte: los criterios de aceptación de cada track y el verificador
que no deja cerrar con criterios abiertos. Lo que sigue son las preguntas de calidad que hoy no
hace nadie de forma sistemática.

### Preguntas para sumar a cada track

| Pregunta | Viene de |
| -------- | -------- |
| ¿La regla está probada en la capa donde vive (base, función o interfaz)? | `003`, `010` |
| ¿Hay un caso negativo de permisos: otro rol, otra sede, sin sesión? | `012` |
| ¿Qué ve el usuario cuando la carga falla? ¿Está probado? | regla `swr-pattern.md` |
| Si toca dinero o agenda, ¿se agregó o revisó su invariante? | `008` |
| Si comprueba y después escribe, ¿cuál es su defensa contra dos a la vez? | `011` |
| Si llama a un tercero, ¿qué pasa cuando no responde? | `010` |
| Si cambia un documento, ¿se regeneró y aprobó la referencia? | `013` |
| Si la migración quita o renombra algo, ¿es compatible con la versión publicada? | `009` |
| ¿Cómo nos enteraríamos si esto falla en producción? | `007` |

No todas aplican a todo cambio. La práctica es responderlas, aunque la respuesta sea "no aplica".

---

## 4. Tratamiento de bugs

### Severidad y prioridad

Son dos cosas distintas y conviene no mezclarlas:

- **Severidad:** cuánto daño hace el bug cuando ocurre.
- **Prioridad:** qué tan pronto hay que corregirlo.

Un error de texto en la pantalla de login es de severidad baja y prioridad alta. Una pérdida de
datos en un flujo que nadie usa todavía es de severidad alta y prioridad media.

| Severidad | Criterio |
| --------- | -------- |
| Crítica | Pérdida de datos, exposición de datos personales, dinero mal registrado, sistema caído |
| Alta | Un flujo principal no se puede completar y no hay forma de rodearlo |
| Media | Un flujo falla pero hay una forma de rodearlo |
| Baja | Molestia visual o de texto |

### La pregunta que más enseña

Por cada bug que llega a producción: **¿por qué no lo detectó ninguna de nuestras redes?** Se
llama **análisis de escape** (_escape analysis_), y las respuestas se repiten:

| Respuesta | Qué mejora |
| --------- | ---------- |
| No había test en esa capa | Agregar el test, y revisar si falta la capa entera |
| El test existía y no corría solo | `003`, `004` |
| Solo ocurre con datos reales | Un invariante (`008`) |
| Solo ocurre con dos personas a la vez | `011` |
| Solo ocurre en producción | `009`, `007` |
| Nadie pensó en ese caso | Una misión exploratoria; una propiedad (`014`) |

Esto calza con lo que el proyecto ya hace con la fricción del propio harness (`/harness-feedback`):
la lección se generaliza a un guardrail en vez de quedar en el caso.

### Regla de regresión

Todo bug corregido deja un test que falla sin la corrección. El flujo de fix ya lo pide.

---

## 5. Qué mirar cada semana

Pocas medidas, que se puedan leer en cinco minutos:

| Medida | Qué dice |
| ------ | -------- |
| Bugs que llegaron a producción | Si las redes funcionan |
| Tiempo entre que algo se rompe y alguien se entera | Si el monitoreo sirve |
| Tiempo en volver a funcionar | Si el rollback y el respaldo sirven |
| Tasa de inestabilidad de los e2e | Si se puede confiar en el rojo |
| Duración del CI | Si el equipo va a esperar el resultado o a ignorarlo |
| Tests desactivados y errores tolerados | Si la deuda crece |
| Violaciones de invariantes | Si los datos están sanos |

Una revisión de 15 minutos por semana: qué falló, qué avisos llegaron, qué se desactivó y por qué.

---

## Mapa: qué se prueba en qué capa

| Qué | Dónde se prueba mejor |
| --- | --------------------- |
| Un cálculo (dinero, fechas, formato) | Test unitario de una función pura; propiedades |
| Estado y errores de un facade | Test unitario del facade |
| Qué muestra un componente en cada estado | Test de componente |
| Un permiso | Test SQL de la política, y test por la API |
| Una regla de negocio que vive en la base | Test SQL |
| Lo que hace una edge function ante cada caso | Test de manejador |
| Un flujo completo entre pantallas y roles | E2E |
| Que dos personas no se pisen | Test de concurrencia |
| Que un documento no cambió | Archivo de referencia |
| Que los datos reales cuadran | Invariante nocturno |
| Que producción responde | Humo post-despliegue y monitoreo |
| Lo que nadie pensó | Sesión exploratoria |

La regla general es probar cada cosa en la capa más baja que la pueda comprobar de verdad, y usar
las capas altas para lo que solo ellas ven.

## Vocabulario

- **Risk-based testing:** decidir qué probar según probabilidad e impacto.
- **Risk register:** la tabla de riesgos.
- **Exploratory testing / charter:** prueba sin guion con una misión.
- **Definition of Done:** condiciones para considerar algo terminado.
- **Severity / priority:** cuánto daño hace / qué tan pronto se corrige.
- **Escape analysis:** por qué un bug no fue detectado antes.
- **Regression test:** test que impide que un bug corregido vuelva.
