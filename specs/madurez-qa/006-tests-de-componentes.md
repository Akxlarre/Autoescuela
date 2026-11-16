# 006 — Tests de componentes

> **Fase:** 1 · **Prioridad sugerida:** P2 · **Tipo sugerido:** fix
> **Depende de:** nada · **Desbloquea:** parte de la accesibilidad de `016`
> **Nivel hoy:** 1 (existen specs, los que renderizan están desactivados) · **Meta:** 2

## En una frase

Un cambio en la plantilla de un componente compartido se detecta en segundos, sin levantar el
navegador ni la base.

## El concepto

Entre el test de una función y el test de punta a punta hay un nivel intermedio: probar **un
componente solo**, renderizado, sin el resto de la app. Hay varias profundidades:

| Nivel | Qué prueba | Velocidad | Qué no ve |
| ----- | ---------- | --------- | --------- |
| Solo la clase | La lógica TypeScript del componente | Muy rápido | Nada de la plantilla |
| Renderizado (_DOM test_) | Que la plantilla muestra lo correcto según las entradas, y emite lo correcto al interactuar | Rápido | Estilos reales, integración |
| En navegador real (_component testing_) | Lo mismo, con el motor de un navegador | Medio | Integración con el backend |
| Visual (_visual regression_) | Que se ve igual que la captura aprobada | Lento | Comportamiento |

La idea guía es **probar como lo usa una persona**: buscar un botón por su rol y su texto, hacer
clic, mirar qué aparece. Un test atado a clases CSS o a la estructura interna se rompe con cada
rediseño sin que haya un bug. Es la filosofía de la familia _Testing Library_.

Por qué hace falta este nivel si ya hay e2e:

- **Velocidad:** un e2e tarda segundos y necesita base; un test de componente tarda milisegundos.
- **Estados difíciles de provocar:** cargando, vacío, error, texto larguísimo, cien elementos.
  En un e2e hay que fabricar el dato; en un test de componente se pasa por la entrada.
- **Diagnóstico:** cuando falla, se sabe qué componente es.

## Por qué importa acá

Verificado el 2026-11-15:

- **296 componentes, 105 specs de componente.**
- **Los tests que renderizan están apagados.** `vitest.config.ts` excluye 6 archivos con este
  comentario: los tests de plantilla necesitan un plugin que rompe los tests de facades y
  servicios, "excluidos hasta implementar una solución de doble configuración".
- **Hay 8 `describe.skip`** por el mismo motivo, entre ellos `AlertCardComponent`,
  `EmptyStateComponent`, `IconComponent`, `KpiCardComponent`, `TabsComponent`.
- **Los desactivados son los más reutilizados.** Ícono, tarjeta de KPI, estado vacío y tarjeta de
  alerta aparecen en casi todas las pantallas.
- **Las reglas del proyecto son reglas de plantilla:** estado de carga con
  `<app-skeleton-block>`, estado de error con "Reintentar", atributos `data-llm-action` en los
  botones que modifican datos. Hoy eso solo lo verifican los e2e (bloque X01 de
  `e2e/transversal-shell.spec.ts`), que no corren solos (`004`).

## Qué hay hoy

- Vitest con `happy-dom` (y `jsdom` instalado).
- Los 6 specs excluidos, ya escritos.
- La regla de componentes presentacionales: solo `input()` y `output()`, sin facades. Eso los hace
  fáciles de probar aislados.
- Las reglas de estados de `swr-pattern.md` (caso A, caso B), que son una lista de qué probar.

## Cómo se hace

El bloqueo es de configuración: el plugin que compila plantillas no convive con la forma en que
hoy corren los tests de facades.

| Opción | Qué es | Nota |
| ------ | ------ | ---- |
| **A. Dos proyectos en Vitest** | Uno para lógica (como hoy) y otro para componentes con el plugin de plantillas; cada test cae en el que le corresponde por nombre o carpeta | Es la "doble configuración" que el comentario de `vitest.config.ts` deja pendiente |
| **B. El runner de tests de Angular** | Usar la integración oficial de Angular con Vitest (`ng test`) | Puede resolver el conflicto de raíz; hay que confirmar en la documentación de Angular 21 qué soporta y cuánto cambia la configuración actual |
| **C. Tests de componente en navegador** | Playwright montando el componente solo | Más fiel, más lento, otra herramienta |

**Recomendación:** evaluar B primero con una prueba corta (medio día); si no calza, A. C queda
como complemento para los pocos componentes donde el motor del navegador importa.

Qué probar en cada componente, en orden de valor:

1. **Cada estado que la plantilla distingue:** cargando, vacío, error, con datos.
2. **Lo que emite:** al hacer clic en "Reintentar" sale el evento.
3. **Accesibilidad básica:** el botón tiene nombre accesible, el ícono decorativo está oculto para
   lectores de pantalla.
4. **Atributos `data-llm-*`** en los elementos que la regla exige.
5. **Bordes:** texto muy largo, lista vacía, valores nulos.

Por dónde empezar: los componentes compartidos del sistema de diseño (son pocos y se usan en
todos lados), después los organismos con más lógica de plantilla.

## Alcance propuesto

- La configuración que permite correr tests de plantilla junto a los demás.
- Los 6 specs excluidos y los 8 `describe.skip` reactivados y pasando.
- Una plantilla de test de componente y su sección en `.claude/rules/testing-tdd.md`.
- Los componentes compartidos del sistema de diseño con sus cuatro estados probados.
- El impacto en el tiempo del CI, medido.

## Fuera de alcance

- Llevar los 296 componentes a tener spec.
- Regresión visual por capturas.
- Componentes de página completa: esos se prueban mejor por e2e.

## Cómo saber que está terminado

- [ ] `vitest.config.ts` no excluye ningún spec de componente.
- [ ] No queda ningún `describe.skip` cuyo motivo sea la configuración.
- [ ] Borrar el botón "Reintentar" de `EmptyStateComponent` deja un test en rojo.
- [ ] La guía de testing explica cómo escribir un test de componente y cuándo no escribirlo.
- [ ] Los tests de facades siguen pasando sin cambios.
- [ ] El tiempo de `test:ci` no aumentó más de lo acordado.

## Trampas conocidas

- **`OnPush` y señales.** Las entradas se asignan con `fixture.componentRef.setInput(...)` y hay
  que disparar la detección de cambios; si no, la plantilla no se actualiza y el test da un falso
  resultado.
- **Animaciones.** Los componentes usan `GsapAnimationsService`; en los tests se reemplaza por un
  doble que no anime.
- **PrimeNG.** Los componentes que abren capas flotantes (menús, diálogos) renderizan fuera del
  componente y dependen de un DOM más completo. Son candidatos a e2e, no a este nivel.
- **`happy-dom` no es un navegador.** No calcula tamaños ni estilos. Nada que dependa de medidas
  (el presupuesto de alto del patrón app-like) se puede probar acá.
- **Tests atados a clases CSS.** Las reglas visuales del proyecto cambian seguido; buscar por rol,
  texto o `data-llm-*`.
- **Probar la librería.** No hace falta comprobar que `@if` funciona; se prueba la decisión que
  tomó quien escribió el componente.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Opción A o B, después de la prueba corta | Equipo |
| Qué componentes son obligatorios | Equipo |
| Si un componente compartido nuevo exige spec para mergearse | Equipo |

## Vocabulario

- **DOM:** la estructura de la página que el navegador (o su simulador) mantiene en memoria.
- **Fixture:** en Angular, el envoltorio que crea y controla un componente dentro de un test.
- **Test double:** reemplazo de una dependencia real dentro de un test.
- **Testing Library:** familia de librerías que promueve probar como lo usa una persona.
- **Visual regression:** comparar capturas contra una versión aprobada.
