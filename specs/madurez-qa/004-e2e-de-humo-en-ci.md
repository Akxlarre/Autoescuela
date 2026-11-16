# 004 — E2E de humo en el CI

> **Fase:** 1 · **Prioridad sugerida:** P1 · **Tipo sugerido:** spec
> **Depende de:** `002` · **Desbloquea:** `015`, la verificación de `009`
> **Nivel hoy:** 1 (existen, se corren a mano) · **Meta:** 3 (un subconjunto en cada PR, la suite completa cada noche)

## En una frase

Ningún PR se mergea si rompió el inicio de sesión, la carga de una pantalla principal o el camino
de matrícula a pago.

## El concepto

Un test **de punta a punta** (_end-to-end_, e2e) maneja la aplicación como una persona: abre el
navegador, inicia sesión, hace clic. Es el tipo de test que más se parece al uso real y también el
más lento y el más frágil. Por eso no se corren todos en todo momento, sino por niveles:

| Nivel | Qué contiene | Cuándo corre | Duración objetivo |
| ----- | ------------ | ------------ | ----------------- |
| **Humo** (_smoke test_) | Lo mínimo que prueba que el sistema está vivo | Cada PR | Menos de 10 minutos |
| **Regresión** (_regression suite_) | Todo | Cada noche, y antes de publicar | Lo que tarde |

El nombre viene de la electrónica: se enchufa el aparato y se mira si sale humo. No prueba que
funcione bien, prueba que no está roto de forma evidente.

Otras ideas del tema:

- **Recorridos críticos** (_critical user journeys_): los pocos caminos sin los cuales el negocio
  no opera. Son los candidatos al humo.
- **Tiempo de retroalimentación** (_feedback time_): cuánto tarda en saberse que algo se rompió.
  Un check que tarda una hora se termina ignorando.
- **Etiquetas** (_tags_): marcar cada test con su nivel para elegir qué corre.
- **Test inestable** (_flaky test_): pasa o falla sin que cambie el código. Un test inestable en
  el camino de cada PR enseña al equipo a ignorar el rojo (ver `015`).
- **Artefactos:** el reporte, las capturas y la traza de un test fallido, guardados por el CI para
  diagnosticar sin reproducirlo.

## Por qué importa acá

Verificado el 2026-11-15:

- **73 archivos e2e, unos 545 tests**, con infraestructura cuidada: sesiones por rol, detección de
  errores de consola y de red (`watchErrors().expectClean()`), limpieza automática, barrido de
  rutas por rol, ancho y tema con accesibilidad.
- **Ningún workflow los ejecuta.** `.github/workflows/ci.yml` corre lint, tests unitarios, tests de
  fechas, build y tests de edge functions.
- **Fue una decisión, no un olvido.** `ASG-i-021` dejó "integrarla en CI" fuera de alcance "cuando
  la suite sea estable". La suite ya creció a 73 archivos.
- **Ya está medio preparada:** `playwright.config.ts` tiene `forbidOnly` atado a la variable `CI`.
- **Corre contra la base compartida y en modo desarrollo:** `webServer` levanta `npx ng serve`.
  Se prueba un build distinto del que se publica.
- **La mayoría de los componentes solo se prueban así** (ver `006`). Si los e2e no corren, esa
  parte de la interfaz no tiene ninguna red.

## Qué hay hoy

- `e2e/smoke.spec.ts`, la plantilla de la guía.
- `e2e/barrido-rutas.spec.ts`, que visita cada ruta con cada rol.
- Fábricas de datos (`createE2eAlumno`, `seedClase`) y fixtures (`pageAs`, `cleanup`).
- Reporte HTML, traza y captura en cada falla, ya configurados.
- Una vista previa de Vercel por PR.

## Cómo se hace

**1. Elegir el humo.** Entre 10 y 20 tests, marcados con una etiqueta. Candidatos:

- Inicio de sesión con cada rol.
- Cada pantalla principal carga sin errores de consola ni de red (un subconjunto del barrido).
- Un recorrido que escribe, por flujo crítico: matrícula presencial hasta el pago; agendar una
  clase; registrar asistencia; abrir y cerrar la caja.
- Un caso de permisos: una secretaria no ve datos de la otra sede.

**2. Decidir contra qué corre.**

| Opción | Ventaja | Límite |
| ------ | ------- | ------ |
| **Entorno local del CI** (`002`) con build de producción servido como archivos estáticos | Aislado, determinista, prueba lo que se publica | Requiere `002` |
| Vista previa de Vercel del PR, solo lectura | Se puede hacer antes de `002` | Usa la base compartida: solo tests que no escriben |

**3. Armar el job.** Instalar el navegador, levantar el entorno, correr los tests con la etiqueta de
humo, subir el reporte como artefacto.

**4. Programar la suite completa** cada noche y como paso manual antes de publicar.

**5. Definir la política de reintentos.** Hoy `retries: 0`. En CI conviene un reintento, pero con
el test marcado como inestable y visible en el reporte, no escondido (ver `015`).

**Recomendación:** entorno local con build de producción. Como paso intermedio mientras `002` no
existe, un humo de solo lectura contra la vista previa, informativo y sin bloquear.

## Alcance propuesto

- Etiqueta de humo y selección inicial de tests.
- Job de CI en cada PR, con reporte y trazas como artefactos.
- Corrida completa programada, con aviso si falla.
- La guía `docs/E2E-PLAYWRIGHT.md` actualizada: qué es humo, cómo se agrega un test al humo.
- Dos semanas como check informativo; después, obligatorio.

## Fuera de alcance

- Estabilizar los tests existentes (esperas fijas, saltos condicionales): es `015`.
- Otros navegadores.
- Escribir tests nuevos más allá de los que falten para un recorrido de humo.

## Cómo saber que está terminado

- [ ] Cada PR corre el humo y muestra el resultado como check.
- [ ] El humo tarda menos de 10 minutos.
- [ ] Un PR de prueba que rompe el inicio de sesión queda en rojo.
- [ ] El reporte de un test fallido se puede descargar desde el PR.
- [ ] La suite completa corre sola cada noche y alguien recibe el aviso cuando falla.
- [ ] El humo corre contra un build de producción.
- [ ] El check es obligatorio para mergear.

## Trampas conocidas

- **Modo desarrollo contra build de producción.** El login se comporta distinto: en desarrollo
  precarga la contraseña de prueba (`login.component.ts:36`). Los tests no deben depender de eso.
- **`channel: 'chrome'`** usa el Chrome instalado en el equipo. En el CI hay que confirmar que el
  runner lo trae o instalar el navegador de Playwright.
- **Zona horaria del runner.** El CI corre en UTC, donde de noche en Chile ya es "mañana". Es una
  ventaja para encontrar errores de fechas y una fuente de fallas si un test asume la hora local.
- **Paralelismo.** La configuración limita a 4 workers porque con más carga fallaban tests al
  azar. En un runner más chico el número correcto puede ser menor.
- **Empezar bloqueando.** Si el check falla sin motivo en su primera semana, el equipo lo
  desactiva y cuesta volver a activarlo. Por eso el período informativo.
- **Humo que crece.** Cada test que se agrega alarga todos los PR. Poner un tope de tiempo y
  respetarlo.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué recorridos son críticos | Equipo, con quien conoce la operación de la escuela |
| Humo de solo lectura contra la vista previa mientras no exista `002`: sí o no | Equipo |
| Cuántos reintentos se permiten | Equipo |
| Quién recibe el aviso de la corrida nocturna | Equipo |

## Vocabulario

- **E2E:** test de punta a punta.
- **Smoke test:** el mínimo que prueba que el sistema responde.
- **Regression suite:** la suite completa.
- **Critical user journey:** recorrido sin el cual el negocio no opera.
- **Flaky:** inestable; falla a veces sin que cambie el código.
- **Artifact:** archivo que el CI guarda de una corrida.
