# 009 — Verificación post-despliegue y deriva de la base

> **Fase:** 2 · **Prioridad sugerida:** P2 · **Tipo sugerido:** fix
> **Depende de:** nada (mejora con `004` y `007`) · **Desbloquea:** nada
> **Nivel hoy:** 0 (no existe) · **Meta:** 3 (cada publicación se comprueba sola y avisa)

## En una frase

"Publicado" pasa a significar "comprobado que funciona en producción", no "los archivos subieron".

## El concepto

Los tests corren antes de publicar, contra un build y un entorno que no son exactamente los
reales. Entre "los tests pasaron" y "el usuario puede trabajar" quedan cosas que solo existen en
producción: el servidor, la caché, el dominio, los secretos, la versión de la base.

Ideas del tema:

- **Verificación de despliegue** (_deployment verification_, _post-deploy smoke test_): apenas se
  publica, un chequeo automático confirma que la versión nueva responde.
- **Monitoreo sintético** (_synthetic monitoring_): el mismo chequeo, repetido cada cierto tiempo.
  Un robot hace lo que haría un usuario y avisa si no puede.
- **Punto de salud** (_health check_): una dirección que responde si el servicio está bien.
- **Criterio de vuelta atrás** (_rollback criteria_): la regla, escrita de antemano, que dice
  cuándo se revierte. Decidirlo en medio del incidente es más lento y peor.
- **Deriva** (_drift_): diferencia entre lo que dice el repositorio y lo que hay desplegado.

Y el problema más fino, el de las **dos velocidades**: la app se revierte en segundos, la base no.
Una migración que borra una columna no se deshace volviendo a subir archivos. La técnica estándar
es **expandir y contraer** (_expand and contract_):

1. **Expandir:** la migración solo agrega (columna nueva, tabla nueva). La versión anterior de la
   app sigue funcionando.
2. Publicar la app que usa lo nuevo.
3. **Contraer:** cuando ya no hay vuelta atrás posible a la versión vieja, otra migración quita lo
   que sobra.

Así, en todo momento la base es compatible con la versión actual de la app y con la anterior.

## Por qué importa acá

Verificado el 2026-11-15:

- **La publicación termina cuando los archivos suben.** Los pasos de
  `.github/workflows/deploy-app-production.yml` después de "Subir por FTPS" son "Resumen" y
  "Crear GitHub Release". Ninguno consulta el sitio publicado.
- **El paso manual existe, pero es manual.** `docs/DEPLOY.md` indica mirar
  `https://<dominio>/version.json`.
- **Ya pasó que subió bien y no servía.** `docs/DEPLOY.md` registra que con un dominio anterior
  "el deploy subía bien al cPanel, pero el dominio servía un 404 de Vercel".
- **El rollback de la app es excelente:** vuelve a subir el `site.zip` de un Release en segundos.
  No toca la base.
- **Migraciones y edge functions se publican a mano.** Ningún workflow ejecuta `db push` ni
  `functions deploy`. La coordinación entre versión de app, de base y de funciones la lleva una
  persona.
- **La base ya tuvo deriva.** `indices/DATABASE.md:134` registra dos versiones de una función que
  existieron en la base "nunca versionadas" y hubo que reconstruir.

## Qué hay hoy

- `version.json` público con la etiqueta de la versión.
- El workflow de rollback.
- Aprobación obligatoria de una persona antes de publicar.
- Playwright y `watchErrors().expectClean()`, reutilizables para un chequeo de solo lectura.
- `supabase migration list`, que compara las migraciones del repo con las aplicadas.

## Cómo se hace

### 1. Comprobar que subió lo que se quería

Después de subir, el workflow consulta `version.json` hasta que la etiqueta coincide con la
esperada (con reintentos, por la caché), y pide `index.html` y el archivo principal. Si no
coincide en un tiempo razonable, el workflow falla.

### 2. Humo de solo lectura contra producción

Un recorrido mínimo con un navegador real: iniciar sesión, cargar el panel y dos o tres pantallas,
sin errores de consola ni respuestas de error. **Nunca escribe.**

Usa una cuenta creada para esto, con el menor permiso posible, y nunca la cuenta de administrador
de pruebas. Sus credenciales viven como secretos del entorno `Production`.

### 3. Qué pasa si falla

| Opción | Cómo | Nota |
| ------ | ---- | ---- |
| Aviso y decisión humana | El workflow queda en rojo y avisa; una persona lanza el rollback | Lo prudente para empezar |
| Rollback automático | El workflow revierte solo | Solo cuando el chequeo lleve tiempo sin falsas alarmas |

### 4. Repetirlo en el tiempo

El mismo recorrido, programado cada cierto intervalo. Con eso pasa a ser monitoreo sintético y se
conecta con los avisos de `007`.

### 5. La base

- **Chequeo de deriva:** un job que compara las migraciones del repo con las aplicadas y avisa si
  hay una en el repo sin aplicar, o una aplicada que no está en el repo.
- **Regla de compatibilidad:** toda migración tiene que ser compatible con la versión de la app
  publicada en ese momento. Las que quitan o renombran algo se parten en expandir y contraer.
- **Orden de publicación escrito:** primero la migración que expande, después las funciones,
  después la app.
- **Opcional, a decidir:** automatizar la publicación de migraciones y funciones. La documentación
  de Supabase indica que su integración con GitHub puede desplegar desde `main` en cualquier plan.

### 6. Las edge functions

Un punto de salud que responda la versión desplegada, incluido en el chequeo.

## Alcance propuesto

- Verificación de `version.json` dentro del workflow de publicación.
- Humo de solo lectura contra producción, con cuenta dedicada.
- El mismo humo programado, con aviso.
- Chequeo de deriva de migraciones.
- El procedimiento escrito: cuándo se vuelve atrás, quién decide, en qué orden se publica.
- La regla de expandir y contraer en la guía de migraciones.

## Fuera de alcance

- Automatizar el despliegue de migraciones y funciones (queda como decisión).
- Despliegue gradual por porcentaje de usuarios: no aplica con un hosting de archivos estáticos.
- Volver atrás una migración ya aplicada: se resuelve con una migración nueva hacia adelante.

## Cómo saber que está terminado

- [ ] Publicar una versión cuyo `version.json` no coincide deja el workflow en rojo (probado en un
      entorno de pruebas del pipeline).
- [ ] Después de cada publicación corre el humo y su resultado queda en el resumen del workflow.
- [ ] El humo corre solo cada cierto intervalo y un fallo avisa.
- [ ] La cuenta de monitoreo no puede escribir datos de negocio (comprobado intentándolo).
- [ ] Una migración del repo sin aplicar genera un aviso.
- [ ] El procedimiento de vuelta atrás está en `docs/DEPLOY.md`.

## Trampas conocidas

- **Caché.** Justo después de subir, el servidor o un intermediario puede responder la versión
  anterior. Reintentar con espera y agregar un parámetro que evite la caché.
- **Falsa alarma única.** Un chequeo aislado puede fallar por la red. Avisar recién al segundo
  fallo seguido.
- **La cuenta de monitoreo es una puerta más.** Mínimo permiso, contraseña larga y rotación. Si
  el sistema de roles no tiene uno de solo lectura, decidir cómo se limita.
- **Límites de inicio de sesión.** Un chequeo cada pocos minutos que inicia sesión cada vez puede
  chocar con los límites de Auth. Reutilizar la sesión o espaciar.
- **Volver atrás la app con una base ya migrada.** Si la migración no era compatible con la
  versión anterior, el rollback deja una app rota de otra forma. Por eso la regla de compatibilidad.
- **Datos de prueba en producción.** El humo no crea nada. Si alguna vez hace falta probar una
  escritura en producción, se diseña aparte, con datos marcados y limpieza garantizada.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Rollback automático o decisión humana | Equipo |
| Cómo se limita la cuenta de monitoreo | Equipo |
| Si se automatiza la publicación de migraciones y funciones | Equipo |
| Cada cuánto corre el chequeo programado | Equipo |

## Vocabulario

- **Post-deploy smoke test:** chequeo mínimo apenas se publica.
- **Synthetic monitoring:** un robot que repite un recorrido de usuario.
- **Health check:** dirección que responde si el servicio está sano.
- **Rollback:** volver a la versión anterior.
- **Drift:** diferencia entre el repositorio y lo desplegado.
- **Expand and contract:** cambiar el esquema en dos pasos compatibles.
- **Backward compatible:** que lo nuevo funciona con la versión anterior.
