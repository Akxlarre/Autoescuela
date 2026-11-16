# 015 — E2E estables

> **Fase:** 4 · **Prioridad sugerida:** P2 · **Tipo sugerido:** fix
> **Depende de:** `002` y `004` · **Desbloquea:** poder confiar en el rojo del CI
> **Nivel hoy:** 1 (la suite funciona, con esperas fijas y saltos según los datos) · **Meta:** 3

## En una frase

Cuando un e2e falla es porque algo se rompió, y cuando pasa es porque se probó.

## El concepto

Un test **inestable** (_flaky_) pasa o falla sin que cambie el código. Es el mayor problema de las
suites de punta a punta, porque destruye lo único que un test entrega: confianza. Después de tres
rojos falsos, el equipo vuelve a correr el test hasta que pase y deja de leer los fallos.

Su opuesto silencioso es el test que **nunca prueba**: el que se salta según las condiciones, o
que pasa porque no llegó a comprobar nada. Se ve verde y no protege.

**Causas habituales de inestabilidad**

| Causa | Ejemplo | Remedio |
| ----- | ------- | ------- |
| Tiempo | Esperar 2 segundos y asumir que ya cargó | Esperar la condición, no el reloj |
| Estado compartido | Dos tests modifican el mismo registro | Cada test crea sus datos |
| Orden | Un test depende de lo que dejó otro | Tests independientes |
| Datos del entorno | "Hoy no hay clases agendadas" | Sembrar lo que el test necesita |
| Fecha y hora reales | Falla de noche, o a fin de mes | Fijar el reloj |
| Servicios externos | La red tardó | Aislar o simular |
| Carreras reales en la app | La pantalla muestra datos de la petición anterior | Es un bug del producto, no del test |

La última fila importa: a veces el test inestable está diciendo la verdad.

**Prácticas**

- **Esperas por condición** (_auto-waiting_, _web-first assertions_): afirmar "el botón es
  visible" y dejar que la herramienta reintente hasta que lo sea, con un tope.
- **Aislamiento** (_test isolation_): cada test prepara y limpia lo suyo.
- **Cuarentena** (_quarantine_): un test inestable identificado sale del camino que bloquea, pero
  sigue corriendo, con dueño y fecha límite. No se borra ni se ignora.
- **Tasa de inestabilidad** (_flake rate_): porcentaje de corridas que fallan sin motivo. Lo que
  no se mide no baja.
- **Reintentos:** un reintento automático esconde la inestabilidad si no se informa. Bien usado,
  marca el test como inestable y lo reporta.

## Por qué importa acá

Verificado el 2026-11-15:

- **51 esperas fijas** (`waitForTimeout`) en `e2e/`.
- **31 saltos condicionales** (`test.skip`) que dependen de los datos del día. Ejemplos: "No hay
  clases agendadas desde hoy", "Ninguna de las próximas 4 semanas está sin clases", "La sede tiene
  una sola página de alumnos", "Ningún alumno Clase B activo tiene consentimientos vigentes".
  Cuando la condición no se da, el test no corre y nadie se entera.
- **La inestabilidad ya obligó a ajustar la configuración.** `playwright.config.ts` limita a 4
  workers y sube el tiempo de cada afirmación a 10 segundos porque con más carga "fallaban tests
  al azar".
- **Sin reintentos** (`retries: 0`), lo que es honesto pero deja cada falla al azar como un rojo.
- **Corre contra datos que otros modifican**, lo que explica buena parte de los saltos (ver `002`).
- **Un solo navegador:** Chrome.
- **Lo que ya está bien resuelto:** `knownBug()` marca los bugs conocidos sin relajar el test, y
  `known-errors.ts` exige una justificación por cada error tolerado (hoy hay una sola entrada).

## Qué hay hoy

- Las fábricas `createE2eAlumno()` y `seedClase()`.
- El fixture `cleanup`, que borra lo creado aunque el test falle.
- `watchErrors()`, que detecta errores de consola y de red.
- La infraestructura de trinquetes de `scripts/`.
- La traza de cada test fallido, ya configurada.

## Cómo se hace

### 1. Reemplazar las esperas fijas

Cada `waitForTimeout` se cambia por la condición que en realidad se espera: que un elemento sea
visible, que una respuesta de red llegue, que el estado de carga termine. Si la app no ofrece una
señal clara de "terminé de cargar", agregarla es una mejora del producto: también le sirve a
lectores de pantalla.

### 2. Reemplazar los saltos por datos sembrados

Con un entorno aislado y una semilla (`002`), el test que hoy se salta porque "no hay clases
agendadas" crea la clase que necesita. Los saltos que queden, porque de verdad dependen de una
configuración, pasan a una lista con motivo, igual que los errores tolerados.

### 3. Trinquetes

El número de esperas fijas y de saltos condicionales no puede crecer. Va como regla en el lint que
ya existe.

### 4. Medir

- Correr la suite varias veces seguidas y anotar qué tests no dieron siempre el mismo resultado.
- En el CI, un reintento, con el reporte de inestables visible.
- Una lista corta de los peores, con dueño.

### 5. Cuarentena

Una etiqueta para los inestables identificados: salen del check obligatorio, siguen corriendo cada
noche, y tienen fecha de arreglo.

### 6. Controlar el reloj

Para las pantallas que dependen de la fecha (de noche en Chile, fin de mes, feriados), fijar la
hora del navegador en el test en vez de depender de cuándo corre la suite.

### 7. Otros navegadores

Solo para el humo, y solo si el uso real lo justifica: el portal del instructor se usará desde el
teléfono.

## Alcance propuesto

- Las esperas fijas reemplazadas, o justificadas una por una.
- Los saltos condicionales reemplazados por datos sembrados, o en lista con motivo.
- Trinquetes de ambos.
- La tasa de inestabilidad medida y registrada.
- El mecanismo de cuarentena y su regla.

## Fuera de alcance

- Escribir tests nuevos.
- Cambiar de herramienta.
- Regresión visual.

## Cómo saber que está terminado

- [ ] No quedan esperas fijas sin justificación escrita.
- [ ] No quedan saltos condicionales sin justificación escrita.
- [ ] Agregar una espera fija o un salto nuevo deja el lint en rojo.
- [ ] La suite corrida 20 veces seguidas sobre el mismo código da el mismo resultado al menos 99 de
      cada 100 tests.
- [ ] Hay una lista de tests en cuarentena con dueño y fecha, y es corta.
- [ ] El límite de 4 workers se revisó: se mantiene con motivo o se quitó.

## Trampas conocidas

- **Quitar una espera destapa un bug real.** Si al cambiar la espera por una condición el test
  empieza a fallar, puede que la pantalla tenga una carrera. Es un hallazgo; reservar tiempo para
  ellos.
- **Subir el tiempo máximo en vez de arreglar.** Tapa el síntoma y alarga la suite.
- **Reintentar hasta que pase.** Tres reintentos sin reporte convierten una suite inestable en una
  que parece estable.
- **Cuarentena eterna.** Sin fecha límite, es un cementerio de tests.
- **Cuentas compartidas.** Varios tests con la misma secretaria, en paralelo, sobre los mismos
  datos, se pisan aunque cada uno limpie lo suyo.
- **Simular demasiado.** Reemplazar el backend para estabilizar convierte el e2e en otra cosa.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Tasa de inestabilidad aceptable | Equipo |
| Cuántos reintentos en el CI | Equipo |
| Plazo máximo de un test en cuarentena | Equipo |
| Si el humo corre en un segundo navegador | Equipo |

## Vocabulario

- **Flaky test:** test que falla a veces sin que cambie el código.
- **Flake rate:** porcentaje de fallas sin motivo.
- **Auto-waiting:** esperar una condición en vez de un tiempo fijo.
- **Test isolation:** que un test no dependa de otro ni lo afecte.
- **Quarantine:** apartar un test inestable sin borrarlo.
- **Retry:** volver a correr un test que falló.
