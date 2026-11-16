# 001 — Respaldo y restauración ensayada

> **Fase:** 0 · **Prioridad sugerida:** P0 · **Tipo sugerido:** spec
> **Depende de:** nada · **Desbloquea:** nada (es la red de seguridad de todo lo demás)
> **Nivel hoy:** 0 (no existe) · **Meta:** 3 (copia automática, aviso si falla, restauración ensayada)

## En una frase

Si mañana la base se borra o se corrompe, el equipo sabe cuántos datos se pierden, cuánto tarda en
volver, y lo sabe porque ya lo hizo una vez.

## El concepto

Un **respaldo** (_backup_) es una copia. Una **restauración** (_restore_) es volver a tener un
sistema funcionando a partir de esa copia. La segunda es la única que importa: una copia que nunca
se restauró es una hipótesis.

Dos números definen qué tan protegido está un sistema:

- **RPO** (_Recovery Point Objective_): cuántos datos se pueden perder, medido en tiempo. Con una
  copia diaria, el RPO es de hasta 24 horas: todo lo que se hizo después de la última copia se pierde.
- **RTO** (_Recovery Time Objective_): cuánto tiempo puede estar caído el sistema mientras se restaura.

Ambos son decisiones de negocio, no técnicas. La técnica solo dice cuánto cuesta cada nivel.

Tipos de copia:

- **Lógica** (_logical backup_, `pg_dump`): un archivo SQL con el esquema y los datos. Portable y
  legible, lento de restaurar en bases grandes.
- **Física** (_physical backup_): copia de los archivos del motor. Rápida, no portable.
- **Recuperación a un punto en el tiempo** (_PITR_, _Point-in-Time Recovery_): copia física más el
  registro de cada cambio. Permite volver a cualquier minuto, no solo a la última copia.

La **regla 3-2-1** resume la práctica: 3 copias, en 2 medios distintos, 1 fuera del proveedor
principal. Si la única copia vive donde vive la base, borrar el proyecto se lleva las dos.

El **ensayo de restauración** (_restore drill_, _disaster recovery drill_) consiste en restaurar a
un lugar distinto del real, comprobar que el sistema funciona y medir cuánto tardó.

## Por qué importa acá

Verificado el 2026-11-15:

- **La organización de Supabase está en plan gratuito** (`plan: free`). La documentación de
  Supabase dice que los respaldos automáticos diarios existen solo en los planes Pro, Team y
  Enterprise, y recomienda a los proyectos gratuitos exportar con `supabase db dump` y guardar la
  copia fuera.
- **No hay ninguna copia programada.** Ningún workflow de `.github/workflows/` ni script de
  `scripts/` o `supabase/scripts/` genera un volcado.
- **Es la única base** (ver `002`): la usan la app publicada, el desarrollo y los tests.
- **Los archivos no viven en la base.** Cédulas, contratos y documentos de vehículos están en
  Storage. La documentación de Supabase aclara que los respaldos de base no incluyen los objetos de
  Storage, solo sus metadatos.
- **Los secretos tampoco.** Credenciales SMTP, de Webpay y las URLs de la app están en los secretos
  de las edge functions (`docs/DEPLOY.md`). Una base restaurada sin ellos no envía correos ni cobra.
- **Las migraciones recrean el esquema, no los datos.** Y ni siquiera el esquema está garantizado:
  `indices/DOMAIN-GOTCHAS.md` DG-013 registra tres casos en que las migraciones no levantaban una
  base desde cero, y `indices/DATABASE.md:134` dos funciones que existieron en la base sin estar
  versionadas.
- **Los proyectos gratuitos con poca actividad se pausan** a los 7 días y solo se pueden reanudar
  durante 90 días, según la documentación. Hoy no aplica porque el proyecto tiene uso diario.

Lo que puede provocar una pérdida no es exótico: una migración con un `DELETE` sin `WHERE`, un
script de limpieza de datos de prueba que alcanza filas reales, una cuenta comprometida, o borrar
el proyecto equivocado desde el panel.

## Qué hay hoy

- 298 migraciones versionadas en `supabase/migrations/`.
- Un rollback de la app en segundos (`.github/workflows/rollback-produccion.yml`), que no toca la base.
- La CLI de Supabase ya instalada y enlazada al proyecto: los tests SQL se corren con
  `npx supabase db query --linked`.

## Cómo se hace

| Opción | Qué es | RPO | Costo | Límites |
| ------ | ------ | --- | ----- | ------- |
| **A. Volcado programado propio** | Un workflow con horario corre `supabase db dump` y sube el archivo cifrado a un almacenamiento externo | El intervalo que se programe (24 h si es diario) | Solo el almacenamiento | Lo mantiene el equipo; hay que avisar si falla; los secretos de la base pasan a vivir en GitHub |
| **B. Plan Pro** | Supabase respalda a diario y permite restaurar desde el panel; conserva 7 días | Hasta 24 h | La suscripción Pro | La copia vive en el mismo proveedor; restaurar deja el proyecto inaccesible mientras dura |
| **C. Pro con PITR** | Recuperación a cualquier minuto | Unos 2 minutos | Pro más el complemento de PITR y un tamaño de cómputo mayor | El más caro; reemplaza a los respaldos diarios |

**Recomendación:** hacer **A de inmediato**, porque es lo único que se puede tener esta semana y
da la copia externa de la regla 3-2-1. Si el producto pasa a Pro (decisión que también pesa en
`002`), se suma **B** y A queda como copia independiente con menor frecuencia. **C** recién tiene
sentido cuando perder un día de matrículas y pagos sea inaceptable para la escuela.

Además de la base hay que copiar:

- **Storage:** copia periódica de los buckets a otro almacenamiento (Storage es compatible con S3).
- **Secretos y configuración:** un inventario de qué secretos existen y dónde está su valor
  (gestor de contraseñas del equipo), más la configuración de Auth que no vive en el repo.

### El ensayo

1. Restaurar la última copia en un lugar que no sea el proyecto real: Supabase local o un proyecto
   temporal.
2. Comprobar: conteo de filas por tabla contra el original, que una cuenta restaurada puede iniciar
   sesión, que un documento conocido se abre, que las tareas programadas y extensiones existen.
3. Apuntar la app a esa base y correr el recorrido de humo (`004`).
4. Medir el tiempo total, de "se detecta el problema" a "el sistema responde".
5. Escribir el procedimiento (_runbook_) con los comandos exactos y lo que falló en el ensayo.

## Alcance propuesto

- Copia automática diaria de la base, cifrada, fuera de Supabase, con retención definida.
- Copia periódica de Storage.
- Aviso cuando la copia no se genera o pesa mucho menos que la anterior.
- Inventario de secretos.
- Un ensayo completo, documentado, con RPO y RTO medidos.
- Procedimiento escrito en `docs/` y fecha del próximo ensayo.

## Fuera de alcance

- Alta disponibilidad (réplicas, conmutación automática).
- Decidir el plan de Supabase: es una decisión del dueño del producto, este trabajo solo la informa.

## Cómo saber que está terminado

- [ ] Existe una copia de la base de menos de 24 horas fuera de Supabase, y se puede mostrar.
- [ ] Si la copia de anoche no se generó, alguien del equipo recibió un aviso (probado apagándola).
- [ ] Storage tiene copia, con su antigüedad conocida.
- [ ] Se restauró la copia en un entorno aparte y una persona inició sesión y abrió una ficha.
- [ ] El RTO medido y el RPO están escritos y el dueño de la escuela los aceptó.
- [ ] El procedimiento lo puede seguir alguien que no participó del ensayo.
- [ ] Hay una fecha para repetir el ensayo.

## Trampas conocidas

- **El volcado por defecto no incluye todo.** `supabase db dump` separa roles, esquema y datos, y
  trata distinto los esquemas que administra Supabase. Que las cuentas de usuario (esquema `auth`)
  viajen en la copia es justo lo que el ensayo tiene que demostrar; no darlo por hecho.
- **Nunca ensayar sobre el proyecto real.** Restaurar reemplaza lo que hay.
- **La copia contiene datos personales** (RUT, direcciones, documentos). Va cifrada, con acceso
  restringido y con plazo de retención: es un tratamiento de datos más bajo la Ley 21.719.
- **Una copia que se sobrescribe a sí misma no protege de la corrupción lenta.** Si el daño se
  descubre a los tres días, hace falta la copia de hace cuatro. Conservar varias.
- **Contraseñas de roles personalizados:** según la documentación, los respaldos diarios no las
  guardan.
- **El respaldo no reemplaza a las migraciones reproducibles.** Si el esquema no se puede levantar
  desde cero, cada restauración depende de que la copia esté completa (ver `002`).

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| RPO y RTO aceptables para la escuela | Dueño de la escuela |
| Plan gratuito con copia propia, o plan Pro | Dueño del producto |
| Dónde se guardan las copias y quién tiene acceso | Equipo, con el responsable de datos personales |
| Cuántos días de copias se conservan | Equipo |
| Cada cuánto se repite el ensayo | Equipo |

## Vocabulario

- **RPO / RTO:** cuánto dato se puede perder / cuánto tiempo se puede estar caído.
- **PITR:** recuperación a un punto exacto en el tiempo.
- **Runbook:** procedimiento paso a paso para una operación o una emergencia.
- **Restore drill:** ensayo de restauración.
- **Off-site:** fuera del proveedor o lugar donde vive el original.
