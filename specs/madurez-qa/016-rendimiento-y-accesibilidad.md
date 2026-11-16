# 016 — Rendimiento y accesibilidad estricta

> **Fase:** 4 · **Prioridad sugerida:** Baja · **Tipo sugerido:** fix
> **Depende de:** `003` (consultas) y `004` (accesibilidad en el CI) · **Desbloquea:** nada
> **Nivel hoy:** 1 (hay mediciones puntuales y un reporte de accesibilidad que no bloquea) · **Meta:** 2

## En una frase

Una consulta que se vuelve lenta o una pantalla que deja de ser usable con teclado se detecta
antes de publicarla.

Este archivo junta dos temas **no funcionales**: cualidades del sistema que no son "hace lo que
tiene que hacer" sino "lo hace bien". Se agrupan porque comparten método: medir, fijar una línea
base y no dejar que empeore.

---

## Parte A — Rendimiento

### El concepto

- **Latencia:** cuánto tarda una operación. Se mira en **percentiles**, no en promedio: el p95 es
  el tiempo que el 95 % de las operaciones no supera. El promedio esconde a los usuarios que
  esperan diez segundos.
- **Presupuesto de rendimiento** (_performance budget_): un límite acordado ("la agenda de una
  semana carga en menos de un segundo") que se comprueba automáticamente.
- **Regresión de rendimiento:** algo que funcionaba rápido y dejó de hacerlo. Es lo que más
  importa detectar; el valor absoluto importa menos que el cambio.
- **Plan de ejecución** (`EXPLAIN`): cómo decide el motor resolver una consulta. Un recorrido
  completo de una tabla grande donde debería usar un índice es la causa típica de lentitud.
- **Consultas N+1:** una consulta para la lista y una más por cada fila.

Tipos de prueba, que se confunden seguido:

| Tipo | Pregunta |
| ---- | -------- |
| De regresión | ¿Esto tarda más que antes? |
| De carga (_load test_) | ¿Aguanta el uso esperado? |
| De estrés (_stress test_) | ¿Dónde se rompe? |
| De resistencia (_soak test_) | ¿Se degrada con las horas? |

Para un sistema con decenas de usuarios internos, casi todo el valor está en el primero.

En el navegador hay medidas estándar (_Core Web Vitals_) de cuánto tarda en aparecer el contenido,
cuánto tarda en responder a un clic y cuánto se mueve la pantalla mientras carga, y un
**presupuesto de tamaño** para los archivos que se descargan.

### Por qué importa acá

Verificado el 2026-11-15:

- **La seguridad por fila tiene costo, y ya se pagó una vez.** `indices/DATABASE.md:102`
  (`fix-196-b`): la política se evaluaba fila por fila y la Agenda tardaba unos 5 segundos por
  semana y 21 segundos para 28 días. Se corrigió moviendo el cálculo a una función.
- **Las mediciones existen como prosa.** El índice de base de datos anota tiempos antes y después
  de varios cambios (por ejemplo, Base Alumnos de unos 35 a 24 ms en `spec 0049-b`). Ninguna es un
  test: la próxima política que reintroduzca el problema no avisa.
- **Alguien ya probó con volumen:** `supabase/scripts/seed_d6_volumen.sql` y su limpieza.
- **El plan gratuito tiene cómputo limitado y compartido.** El rendimiento en producción depende
  también de eso (ver `001`).
- **El proyecto es estricto con el layout sin saltos** (regla de skeletons en `visual-system.md`),
  sin medición automática.

### Cómo se hace

1. **Presupuesto para las consultas principales.** Elegir las cinco o seis que sostienen las
   pantallas más usadas (agenda de una semana, base de alumnos, KPIs del panel, cuadratura). Con
   una semilla de volumen y suplantando a un rol real, afirmar que tardan menos que un límite
   holgado, o que su plan no recorre completa una tabla grande. En runners compartidos el tiempo
   varía: preferir afirmaciones sobre el plan, o límites generosos.
2. **Revisión periódica en producción.** Una vez al mes, mirar las consultas que más tiempo
   acumulan y los avisos del asesor de rendimiento de Supabase (llaves foráneas sin índice,
   políticas que llaman a funciones por cada fila).
3. **Presupuesto de tamaño del build**, que Angular puede hacer cumplir fallando la compilación.
   Revisar si `angular.json` lo tiene y con qué valores.
4. **Prueba de carga**, solo antes de un evento que la justifique (abrir la matrícula pública), y
   nunca contra producción.

---

## Parte B — Accesibilidad estricta

### El concepto

**Accesibilidad** (_a11y_) es que el sistema lo pueda usar una persona con baja visión, sin
ratón, con un lector de pantalla o con dificultades motoras. La referencia es **WCAG**, con
niveles A, AA y AAA; AA es el estándar habitual.

Lo esencial sobre las pruebas automáticas: **encuentran solo una parte de los problemas**.
Detectan bien lo mecánico (contraste insuficiente, un botón sin nombre, un campo sin etiqueta) y
no pueden juzgar lo demás: si el orden del foco tiene sentido, si un diálogo atrapa el teclado, si
el texto alternativo describe la imagen.

Por eso hay dos capas: la automática como piso que no puede bajar, y una revisión manual corta y
repetible.

### Por qué importa acá

- **Ya hay medición.** `e2e/barrido-rutas.spec.ts` corre axe en cada combinación de ruta, rol,
  ancho y tema (chequeo C7 de `spec 0054-b`).
- **Solo reporta.** `docs/E2E-PLAYWRIGHT.md`: por defecto adjunta el resultado y no falla.
- **Hay línea base:** 49 archivos en `e2e/a11y-baseline/`, uno por ruta y rol.
- **El modo estricto existe y está apagado** (`E2E_A11Y_STRICT=1`), "hasta que el equipo lo
  acuerde".
- **La regla de método ya está escrita:** la línea base se regenera solo después de corregir.
- **El barrido no corre solo** (ver `004`).

### Cómo se hace

1. **Encender el modo estricto en el CI** para violaciones graves nuevas: no exige arreglar lo que
   hay, impide agregar.
2. **Bajar la línea base por regla,** empezando por la que más se repite. Una regla corregida en
   un componente compartido suele limpiar decenas de pantallas.
3. **Revisión manual por publicación,** con una lista corta: recorrer los cinco flujos principales
   solo con teclado; el foco siempre visible; los diálogos y paneles laterales devuelven el foco al
   cerrarse; todo campo tiene etiqueta.
4. **Afirmaciones de accesibilidad en los tests de componentes** (`006`): nombre accesible, rol.

---

## Alcance propuesto

- Presupuestos para las consultas principales, en el job de base de datos.
- La revisión mensual de rendimiento, con responsable.
- El modo estricto de accesibilidad encendido en el CI.
- La línea base de accesibilidad reducida en las reglas más frecuentes.
- La lista de revisión manual, en la guía de publicación.

## Fuera de alcance

- Optimizar consultas: cada hallazgo va a su fix.
- Certificar conformidad con WCAG.
- Pruebas de carga.

## Cómo saber que está terminado

- [ ] Quitar un índice usado por la Agenda deja el job de base de datos en rojo.
- [ ] Hay una fecha fija para la revisión de rendimiento y quedó registro de la primera.
- [ ] Un PR que agrega un botón sin nombre accesible deja el CI en rojo.
- [ ] La línea base de accesibilidad tiene menos entradas que al empezar.
- [ ] La lista de revisión manual se usó en una publicación.

## Trampas conocidas

- **Medir tiempo en runners compartidos.** El mismo test tarda distinto cada vez. Un presupuesto
  ajustado genera rojos falsos.
- **Probar con diez filas.** Una consulta lenta con cincuenta mil filas es instantánea con diez.
- **Olvidar el rol.** Una consulta probada como administrador de la base no pasa por las
  políticas; hay que suplantar a un usuario real.
- **Optimizar sin medir.** Primero la medición, después el cambio.
- **Regenerar la línea base de accesibilidad para aceptar algo nuevo.** La regla ya lo prohíbe.
- **Creer que axe en verde es accesible.** Es el piso.
- **Modo oscuro.** El contraste se mide por tema; el barrido ya lo contempla.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué consultas llevan presupuesto y de cuánto | Equipo |
| Cuándo se enciende el modo estricto de accesibilidad | Equipo |
| Quién hace la revisión manual en cada publicación | Equipo |

## Vocabulario

- **Latency / p95:** tiempo de respuesta / el valor que el 95 % de las operaciones no supera.
- **Performance budget:** límite acordado y comprobado.
- **EXPLAIN:** el plan con que el motor resuelve una consulta.
- **N+1:** una consulta por cada fila de una lista.
- **Load / stress / soak test:** carga esperada / hasta romper / durante horas.
- **Core Web Vitals:** medidas estándar de la experiencia de carga en el navegador.
- **WCAG / AA:** norma de accesibilidad web / su nivel habitual.
- **a11y:** abreviatura de accesibilidad.
