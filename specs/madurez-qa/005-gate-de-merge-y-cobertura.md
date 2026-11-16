# 005 — Gate de merge y cobertura

> **Fase:** 1 · **Prioridad sugerida:** P2 · **Tipo sugerido:** fix
> **Depende de:** nada · **Desbloquea:** `014`
> **Nivel hoy:** 2 (el CI corre en cada PR y no bloquea: `main` no está protegida) · **Meta:** 3

## En una frase

Un PR en rojo no se puede mergear, y la cantidad de código probado no puede bajar sin que alguien
lo decida.

## El concepto

Un **gate de calidad** (_quality gate_) es una condición que el cambio tiene que cumplir para
avanzar. Avisar no es un gate: si el check está en rojo y el botón de merge sigue funcionando, lo
único que hay es una sugerencia.

En GitHub el gate se configura con la **protección de rama** (_branch protection_): exigir pull
request, exigir que ciertos checks pasen (_required status checks_), y decidir si la regla aplica
también a los administradores.

**Cobertura** (_code coverage_) es el porcentaje de código que se ejecuta mientras corren los
tests. Hay varias medidas:

| Medida | Cuenta |
| ------ | ------ |
| De líneas (_line coverage_) | Líneas ejecutadas |
| De ramas (_branch coverage_) | Caminos de cada `if` recorridos |
| De funciones | Funciones llamadas al menos una vez |

Lo que la cobertura dice: qué código **no** está probado. Lo que no dice: si el código cubierto
está **bien** probado. Un test que llama a una función y no comprueba nada suma cobertura. Por eso
la cobertura sirve como piso y no como objetivo (la **ley de Goodhart**: cuando una medida se
vuelve meta, deja de medir).

La forma sana de usarla es el **trinquete** (_ratchet_): se registra el valor actual y se impide
que baje. No obliga a nadie a llegar a un número; solo evita retroceder. Este proyecto ya usa ese
patrón en el lint de arquitectura.

Una variante más fina es la **cobertura del cambio** (_diff coverage_): exigir que las líneas
nuevas del PR estén cubiertas, sin importar el total.

## Por qué importa acá

Verificado el 2026-11-15:

- **El CI existe desde `fix-252-b`:** los jobs `Lint, tests y build` y `Tests de edge functions
  (Deno)` corren en cada PR.
- **Hoy no bloquea.** El propio `ci.yml` y `docs/DEPLOY.md` advierten que hace falta una regla en
  la rama: "Sin esa regla el CI avisa, pero no bloquea". Consultada la API de GitHub, `main` no
  tiene protección de rama ni reglas: un PR en rojo se puede mergear y se puede subir directo a
  `main` sin pasar por un PR.
- **La cobertura no se mide.** `package.json` tiene `test:coverage` y `vitest.config.ts` declara el
  proveedor `v8`, pero `@vitest/coverage-v8` no está en `package-lock.json`: el comando no puede
  generar un reporte tal como está.
- **No hay umbrales** en `vitest.config.ts`.
- **Hay tests desactivados que nadie cuenta:** 6 archivos excluidos en `vitest.config.ts` y 8
  `describe.skip` en `src/` (ver `006`). Nada impide que sean más.
- **El gate del despliegue es más laxo que el del PR:** corre `lint:arch` sin modo estricto.

El patrón del trinquete ya está en casa: `npm run lint:arch:strict` trata como error que un
archivo supere su cuota del baseline, y `--update-ds-baseline` consolida una mejora.

## Qué hay hoy

- El workflow de CI y sus dos jobs.
- La infraestructura de trinquetes de `scripts/` (baselines, modo estricto, actualización).
- El entorno `Production` con aprobadores obligatorios para publicar.

## Cómo se hace

**1. Activar la protección de `main`.** Con permisos de administrador del repositorio:

- Exigir pull request para cambiar `main`.
- Exigir los dos checks del CI.
- Exigir que la rama esté al día antes de mergear.
- Decidir si aplica a administradores. Si no aplica, el gate es opcional para quienes más mergean.

Y probarlo: abrir un PR que rompa un test y confirmar que el botón de merge queda deshabilitado.

**2. Hacer que la cobertura se mida.** Instalar el proveedor, correr una vez y guardar el
resultado como línea base.

**3. Poner el trinquete.** Dos caminos:

| Opción | Cómo | Nota |
| ------ | ---- | ---- |
| Umbrales de Vitest | `coverage.thresholds` con los valores actuales; Vitest tiene una opción para subirlos solo cuando la cobertura mejora | Lo más simple |
| Trinquete propio | Guardar el reporte y compararlo, como los baselines de `lint:arch` | Coherente con el resto, más trabajo |

Conviene separar por carpeta: exigente en `core/utils` y `core/facades`, donde está la lógica;
sin exigencia en componentes hasta que `006` destrabe sus tests.

**4. Contar los tests desactivados.** Una regla que falle si aumenta el número de `describe.skip`,
`it.skip` o exclusiones de `vitest.config.ts`. Los `knownBug()` de los e2e ya resuelven esto bien:
el test queda escrito y avisa cuando el bug se corrige.

**5. Mostrar el resultado en el PR:** un resumen de cobertura en el job, sin herramientas externas.

## Alcance propuesto

- Protección de `main` verificada con un PR de prueba, y documentada en `docs/DEPLOY.md`.
- Cobertura medida en el CI.
- Trinquete de cobertura por carpeta.
- Trinquete de tests desactivados.
- El gate del despliegue alineado con el del PR, o la diferencia explicada.

## Fuera de alcance

- Subir la cobertura. Este trabajo impide que baje; subirla es consecuencia de `006` y `010`.
- Medir si los tests detectan errores: es `014`.

## Cómo saber que está terminado

- [ ] Un PR con un test roto no se puede mergear (probado, con captura).
- [ ] El CI publica el porcentaje de cobertura en cada PR.
- [ ] Un PR que borra tests de `core/utils` queda en rojo por cobertura.
- [ ] Un PR que agrega un `describe.skip` queda en rojo.
- [ ] `npm run test:coverage` funciona en un equipo recién clonado.
- [ ] `docs/DEPLOY.md` dice cómo está configurada la protección y quién puede saltársela.

## Trampas conocidas

- **Perseguir el porcentaje.** Si el número se vuelve meta aparecen tests sin afirmaciones. El
  trinquete evita retroceder; la calidad de los tests se mira con `014` y en la revisión de código.
- **Un umbral global esconde huecos.** Un 80 % total puede ser 100 % en utilidades y 0 % en el
  módulo de caja. Por eso por carpeta.
- **Tiempo de CI.** Medir cobertura alarga la corrida. Si pesa, se mide en un job aparte.
- **Plantillas de Angular.** La cobertura de `v8` cuenta el TypeScript; lo que ocurre en la
  plantilla de un componente no aparece. Un componente puede figurar cubierto sin que su HTML se
  haya renderizado nunca.
- **Excepciones permanentes.** Si se permite saltar el gate "solo esta vez", conviene que quede
  registrado quién y por qué.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Si la protección aplica también a administradores | Equipo |
| Umbrales iniciales por carpeta | Equipo, a partir de la primera medición |
| Si se exige cobertura del cambio además del total | Equipo |

## Vocabulario

- **Quality gate:** condición obligatoria para avanzar.
- **Branch protection / required checks:** reglas de GitHub que bloquean el merge.
- **Coverage:** porcentaje de código ejecutado por los tests.
- **Ratchet:** trinquete; una medida que solo puede mejorar.
- **Diff coverage:** cobertura de las líneas que cambia un PR.
- **Baseline:** valor de referencia registrado.
