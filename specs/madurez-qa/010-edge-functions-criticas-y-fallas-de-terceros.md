# 010 — Edge functions críticas y fallas de terceros

> **Fase:** 3 · **Prioridad sugerida:** P1 · **Tipo sugerido:** spec
> **Depende de:** `002` para la capa de integración (el resto puede empezar antes)
> **Nivel hoy:** 1 (la lógica compartida está probada; las funciones, no) · **Meta:** 2

## En una frase

Cada función que mueve dinero, crea cuentas o entrega documentos tiene probado qué pasa cuando
quien llama no debería, cuando el dato viene mal y cuando el correo o el pago fallan.

## El concepto

Una función de servidor tiene dos partes: la **lógica** (decidir) y la **cáscara** (recibir la
petición, comprobar quién llama, hablar con la base, enviar un correo, responder). La lógica se
prueba fácil con tests unitarios. Los errores graves suelen estar en la cáscara.

**Niveles de test**

| Nivel | Qué prueba | Qué reemplaza |
| ----- | ---------- | ------------- |
| Unitario | Una función pura | Nada: no toca el exterior |
| De manejador (_handler test_) | La función completa, con una petición fabricada | Base, correo y pago se reemplazan por dobles |
| De integración | La función corriendo contra una base real de pruebas | Solo los terceros externos |
| De contrato | Que quien llama y quien responde coinciden en la forma de los datos | — |

**Dobles de prueba** (_test doubles_): reemplazos de una dependencia real.

- **Stub:** devuelve una respuesta fija.
- **Fake:** una implementación simple que funciona (un servidor de correo que guarda en memoria).
- **Mock / spy:** además registra cómo lo llamaron, para afirmar "se envió un correo, una vez".

Para poder inyectarlos, la función tiene que recibir sus dependencias en vez de crearlas adentro.
Es el patrón de **puertos y adaptadores** (_ports and adapters_).

**Camino feliz y caminos tristes** (_happy path_, _sad paths_). El camino feliz es que todo salga
bien. Los tristes son todo lo demás, y en sistemas reales son la mayoría del código que importa.

**Idempotencia:** una operación es idempotente si repetirla no cambia el resultado. Los pagos y
los reintentos de red la exigen: el proveedor de pago puede notificar dos veces, el usuario puede
recargar la página de retorno. Se logra con una **llave de idempotencia** que identifica la
operación.

**Fallas parciales:** la función hizo tres pasos y falló en el cuarto. ¿Queda la matrícula creada
sin contrato enviado? ¿El usuario se entera? Es la pregunta más importante de este tema.

**Inyección de fallas** (_fault injection_): provocar a propósito el error de un tercero para ver
cómo se comporta el sistema.

## Por qué importa acá

Verificado el 2026-11-15:

- **36 edge functions.** Solo 2 tienen un test propio (`auto-create-next-promotions`, que necesita
  una base local y está excluido del CI, y `export-special-services`). Las otras 34 no.
- **La lógica compartida sí está probada:** 30 tests en `supabase/functions/_shared/`, entre ellos
  `staff-auth`, `service-role-auth`, `user-edit-authz`, `anti-abuse`, `cash-arqueo`,
  `payroll-totals`, `certificate-debt`, `email-errors`. Es el patrón correcto: extraer la decisión
  a una función pura.
- **El CI corre `deno test --allow-read`:** sin red ni variables de entorno. Solo puede probar
  lógica pura; ninguna cáscara.
- **Que el guard esté probado no prueba que cada función lo use.** 26 funciones importan
  `staff-auth`, 4 `user-edit-authz` y 2 `service-role-auth`. Ocho no importan ninguno de los
  guards compartidos: `dispatch-scheduled-announcements`, `export-table-pdf`, `generate-epq-pdf`,
  `generate-ficha-tecnica-pdf`, `generate-route-sheet-pdf`, `public-enrollment`,
  `send-auth-email`, `student-payment`. La mayoría valida por su cuenta; en `generate-epq-pdf` una
  búsqueda de los patrones habituales de autorización no encontró ninguno. **Hay que leerla antes
  de afirmar nada**, y ese es justo el punto: hoy saberlo exige leer función por función.
- **El historial muestra que es el punto débil.** El resumen de `specs/testing-piloto/` listó 14
  funciones que usaban la clave de servicio sin validar rol ni sede, y dos que permitían a una
  secretaria cambiar el correo de un administrador.
- **Dependencias externas:** pago con Webpay (`public-enrollment`, `student-payment`), correo por
  SMTP desde una sola cuenta (`_shared/school-mailer.ts`, `nodemailer`), generación de PDF.
- **La idempotencia de pago existe** vía `session_token` (`student-payment/index.ts:481`, `:529`,
  `:596`, `:613`), sin un test que la sostenga.
- **Las funciones con la clave de servicio se saltan la RLS.** Todo el control de acceso de esas
  funciones vive en su propio código.

## Qué hay hoy

- Los 30 tests de `_shared`.
- Los guards de autorización como módulos compartidos.
- La copia espejo de `chile-time` con los mismos vectores de test que la app.
- Mailpit, incluido en la CLI de Supabase, para capturar correo en local.

## Cómo se hace

### Capa 0 — Un meta-test del cableado (lo más barato y lo que más cubre)

Un test estático que recorre cada `index.ts` y falla si la función no llama a un guard de
autorización conocido, salvo que esté en una lista de excepciones con su justificación (pública por
diseño, hook con secreto propio, invocada solo por tarea programada). Es el mismo patrón de
`unchecked-reads.guard.spec.ts`: vigila una clase de error, no un caso.

### Capa 1 — Lógica pura (seguir como hoy)

Lo que decide vive en `_shared` y tiene test.

### Capa 2 — Tests de manejador

Cada función expone su manejador recibiendo las dependencias (cliente de base, envío de correo,
cliente de pago). El test lo llama con una petición fabricada y dobles. Corre en el CI actual, sin
base. Requiere un cambio pequeño y repetitivo en la forma de cada función.

### Capa 3 — Integración local

Las funciones servidas en local contra la base local, con el correo capturado y un servidor de
pago de mentira. Los proveedores de pago suelen ofrecer un ambiente de integración con credenciales
de prueba; confirmar el de Transbank antes de diseñar el doble.

### La matriz de casos por función

| Caso | Pregunta |
| ---- | -------- |
| Sin sesión | ¿Responde 401 sin hacer nada? |
| Rol equivocado | ¿Un instructor puede llamar una función de secretaria? |
| Sede equivocada | ¿Una secretaria puede operar sobre otra sede? |
| Dato inválido | ¿Rechaza con un mensaje claro, sin escribir nada? |
| Falla de la base a mitad | ¿Queda algo a medias? |
| El tercero no responde | ¿Hay tiempo máximo de espera? ¿Qué ve el usuario? |
| El tercero responde dos veces | ¿Se cobra o se matricula una sola vez? |
| El correo falla después de guardar | ¿El dato queda, y alguien se entera de que el correo no salió? |
| El PDF falla | ¿El flujo se cae o sigue sin el documento? |

### El contrato con la app

La app y la función tienen que coincidir en la forma de la petición y la respuesta. Dos formas de
sostenerlo: tipos compartidos, o un esquema validado en ambos lados. Para la base, generar los
tipos desde el esquema y que el build falle si cambian sin que el código acompañe.

## Alcance propuesto

- El meta-test de cableado de autorización, con su lista de excepciones.
- La lista acordada de funciones críticas (sugerido: las de pago, las que crean o modifican
  cuentas, y las que entregan documentos con datos personales).
- Tests de manejador para esas funciones, con la matriz de casos.
- Un test de idempotencia para el pago.
- El comportamiento definido y probado cuando el correo falla.
- La capa de integración, cuando exista `002`.

## Fuera de alcance

- Probar las 36 funciones con la matriz completa.
- Pruebas de carga.
- El contenido de los PDF (`013`).

## Cómo saber que está terminado

- [ ] Agregar una función sin guard de autorización deja el CI en rojo.
- [ ] La lista de excepciones tiene una justificación por entrada.
- [ ] Cada función crítica tiene tests de sin sesión, rol equivocado y sede equivocada.
- [ ] Enviar dos veces el mismo retorno de pago produce una sola matrícula y un solo pago.
- [ ] Con el correo fallando, el test afirma el comportamiento acordado.
- [ ] Los tests de manejador corren en el job actual de edge functions.
- [ ] Las funciones críticas están listadas en un índice.

## Trampas conocidas

- **Demasiados dobles.** Un test que reemplaza todo prueba que los dobles funcionan. Por eso la
  capa de integración existe: los dobles tienen que parecerse al original.
- **El doble que envejece.** Si el proveedor cambia su respuesta, el doble sigue igual y el test
  sigue verde. Un test de contrato contra el ambiente de integración del proveedor, corrido cada
  tanto, lo detecta.
- **Probar permisos solo por la interfaz.** Que la pantalla no muestre el botón no impide llamar a
  la función directamente.
- **Tiempo.** Las funciones corren en UTC; usar las utilidades de `chile-time`.
- **Secretos en los tests.** Los tests usan valores de mentira; ningún secreto real entra al CI.
- **El hook de correo de Auth** (`send-auth-email`) no valida sesión por diseño: valida un secreto.
  Su excepción en el meta-test tiene que decirlo.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Qué funciones son críticas | Equipo |
| Qué debe pasar cuando un correo no sale: reintentar, avisar a la secretaria, registrar | Dueño del producto |
| Si la matrícula pública, hoy fuera del piloto, entra en esta ronda | Equipo |
| Tiempo máximo de espera de cada tercero | Equipo |

## Vocabulario

- **Handler:** la función que recibe la petición y responde.
- **Test double / stub / fake / mock:** reemplazos de una dependencia real.
- **Happy path / sad path:** todo sale bien / algo sale mal.
- **Idempotency:** repetir no cambia el resultado.
- **Partial failure:** falló un paso después de que otros ya se hicieron.
- **Fault injection:** provocar una falla a propósito.
- **Contract test:** comprobar que dos partes coinciden en la forma de los datos.
- **Ports and adapters:** separar la lógica de lo que habla con el exterior.
