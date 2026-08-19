# Acceptance 0009-m — Registro de consentimiento y deber de información (Ley 21.719)

> **Estado:** ✅ **CERRADA (2026-08-18)** — 7/7 AC + 3/3 edge cases vigentes.
> Quedan 2 datos que el negocio aún no tiene (región de Supabase, dominio público); no bloquean el
> código y están rastreados en constantes con test. Estamos en desarrollo, no desplegados.
> **Última verificación:** 2026-08-18
> Este archivo acumula evidencia. Un AC se marca ✅ solo con evidencia reproducible pegada acá.

---

## Resumen

| AC | Estado | Dónde |
|---|---|---|
| AC1 — Aviso Art. 14 ter | ✅ **Cumplido y verificado en navegador (flujo público)** | T4.3 / T4.5 · T5.3 |
| AC2 — Ruta pública de política | ✅ **Cumplido y verificado en navegador** | T4.4 · T5.3 |
| AC3 — Dos casillas separadas | ✅ Cumplido | T4.1 (público) · T4.2 (secretaría) |
| AC4 — Gate Art. 16 en el DMS | ✅ **Cumplido y verificado en navegador** | T4.6 · T5.3 |
| AC5 — Un registro por consentimiento | ✅ Cumplido | T3.1–T3.4 |
| AC6 — Consulta y append-only | ✅ Cumplido | T1.5/T1.6 · T4.7 · T5.3 |
| AC7 — Menores | ✅ Cumplido | T4.2 |
| AC-E1 — Negativa registrada | ✅ Cumplido | T1.3 · T4.6 |
| ~~AC-E2~~ | ➖ Eliminado | No existe matrícula en papel |
| AC-E3 — Revocación sin borrar | ✅ Cumplido | T1.5 · T4.7 |
| AC-E4 — Versión de política | ✅ Cumplido | T1.3 · T3.1 |

**Verificación automatizada:** `tsc -p tsconfig.app.json` limpio · `lint:arch` **0 errores** ·
**2184 tests verdes**.

---

## Evidencia

### AC5 · AC-E1 · AC7 — Persistencia (T3.4, 2026-08-18)

`npx supabase db reset` sobre 180 migraciones sin error; migración re-aplicada para confirmar
idempotencia. Verificado contra **Supabase local**, replicando las filas exactas que producen la Edge
Function (`persistConsents`) y el `ConsentsFacade`:

| Caso | Resultado |
|---|---|
| Autenticado: la IP del header pisa la que manda el cliente | `201.214.10.55` ✅ |
| `service_role`: gana la IP del payload de la Edge Function | `190.44.7.12` ✅ |
| `service_role` sin payload: cae al header | ✅ |
| Headers corruptos: `ip` NULL, el consentimiento **no** se cae | ✅ |
| `granted_by_representative = true` (AC7) | ✅ |
| `UPDATE granted` | rechazado por `trg_consents_append_only` ✅ |
| `INSERT` desde `anon` | `permission denied` ✅ |
| `source = 'papel'` | rechazado por `consents_source_check` ✅ |

> **Bug encontrado y corregido durante esta verificación.** La primera versión de
> `trg_consents_set_ip_fn()` era `SECURITY DEFINER`, y dentro de una función definer `current_user` es
> el **dueño** (postgres), no el rol que ejecuta: la rama de `service_role` nunca se tomaba y **toda
> matrícula online habría guardado la IP de un datacenter de Supabase**. Se pasó a `SECURITY INVOKER`,
> con el porqué escrito en el SQL para que nadie lo "arregle" de vuelta.

### AC5 — Los cuatro caminos, ninguno fire-and-forget

| Camino | Dónde | Si el registro falla |
|---|---|---|
| `submit-clase-b` | Edge Function | La matrícula **no** se completa |
| `submit-pre-inscription` | Edge Function | La preinscripción **no** se completa |
| Pago online (`initiate` → `confirm`) | `draft_snapshot` + Edge Function | La confirmación falla |
| Secretaría | `EnrollmentFacade.confirmEnrollment()` | La matrícula **no** se activa |

En el pago online, drafts e IP viajan en el snapshot porque la matrícula recién se crea en
`confirm-payment`: persistirlos antes dejaría huérfanos cada vez que un pago se rechaza. **La IP se
captura en `initiate-payment`**, que es cuando el titular marcó la casilla.

**3 tests** en `enrollment.facade.spec.ts` fijan lo esencial: que el consentimiento se registre antes de
confirmar, que **una matrícula no se confirme si el registro falla**, y que la negativa se propague.

### AC3 · AC7 — Casillas separadas (T4.1, T4.2)

En secretaría el AC se cumple distinto y es lo correcto: la aceptación del **contrato** ya está probada
por el **documento firmado a mano** que se sube — evidencia más fuerte que un checkbox. Lo que faltaba
era el consentimiento al **tratamiento de datos**.

**Test central:** *contrato firmado sin consentimiento NO deja avanzar* (`contract.component.spec.ts`).

**AC7 vive solo acá, y no por omisión:** `canAdvanceFn` bloquea a los menores en el **paso 1** del flujo
público (*"Tienes 17 años — No puedes inscribirte online"*), así que nunca llegan al contrato. En
secretaría el apoderado está presente con la autorización notarial, que es documento **obligatorio** en
el paso 3. Se registra `granted_by_representative`; **no se recolectan nombre ni RUT** del apoderado —
el documento notarial ya lo identifica mejor que un campo tipeado.

### AC1 · AC2 — Deber de información y política (T4.3–T4.5)

`app-privacy-notice` en ambos pasos de datos personales, **antes del primer campo**. Si el slug no
resuelve, no renderiza nada: un aviso que no identifica al responsable no cumple el Art. 14 ter.

`/politica-privacidad/:branchSlug` fuera de `path: 'app'`, sin guard. **6 tests**, incluido que cada
slug devuelva **la sociedad correcta** — servir la política equivocada sería declararle al titular que
sus datos los trata otra empresa.

### AC4 · AC-E1 — Gate del Art. 16 (T4.6)

Reubicado al DMS, único punto por donde el dato de salud entra al sistema (el wizard nunca lo pidió —
confirmado por el dueño el 17-08-2026: solo llega para justificar inasistencias).

Casilla no premarcada; sin ella la subida se bloquea **con explicación visible**. El consentimiento se
registra **antes** de subir. Acción **"No autoriza"** que registra `granted: false` y cierra sin subir:
sin ese botón, "dijo que no" sería indistinguible de "nadie preguntó". **4 tests** en el facade.

### AC6 · AC-E3 — Consulta y revocación (T4.7)

Drawer de solo lectura, sin editar ni eliminar, con una línea al pie explicando que es deliberado. El
candado real está en la base: sin policy de DELETE en ningún rol, trigger append-only, y
`REVOKE ALL ... FROM anon`. "Registrar revocación" solo para **admin** — el único rol con policy de
UPDATE; ofrecérselo a una secretaria sería mostrar una acción que la base va a rechazar. **7 tests.**

### AC2 — QA visual en navegador (T5.3, 2026-08-18)

`ng serve` + Playwright, **sin sesión iniciada**:

| Verificación | Resultado |
|---|---|
| `/politica-privacidad/conductores-chillan` carga sin sesión | ✅ El snapshot es solo `<main>`: sin sidebar ni topbar, confirma que está fuera del shell |
| Las 11 secciones renderizan con sus tablas | ✅ |
| `/politica-privacidad/autoescuela-chillan` muestra **la otra sociedad** | ✅ RUT, domicilio, canal y §4/§6/§8 propios de la OTEC |
| Slug inválido | ✅ Mensaje de ayuda + enlaces a ambas sedes |
| Consola del navegador | ✅ **0 errores, 0 warnings** |
| Móvil (390×844) | ✅ Legible, sin scroll horizontal |
| Modo oscuro (1440×900) | ✅ Contraste correcto, tokens del DS respetados |
| Supabase sin país declarado | ✅ Renderiza *"Supabase procesa datos fuera de Chile."* |

> **🐛 Bug de contenido encontrado por este QA.** La política de la **OTEC** declaraba
> *"Giro: Educación extraescolar — Escuela de conducción"*, que es el giro de la **otra** sociedad.
> Los tests no lo detectaban porque comparaban `legalName`, `rut` y `rightsEmail`, pero no el giro ni
> el **texto** de las secciones. Corregido, y el test de "no mezcla los datos de las dos sociedades"
> ahora recorre el JSON completo de cada política verificando que **no aparezca ningún dato de la
> sociedad ajena** (RUT, correo) y que el giro del párrafo coincida con el declarado.
>
> Es exactamente el tipo de error que ningún test unitario iba a encontrar solo, y la razón por la
> que `visual-system.md` dice que *"QA geométrico ≠ mirada humana"*.

### AC1 — QA visual del aviso (T5.3, flujo público)

`/inscripcion?sede=conductores-chillan` → Clase B → paso de datos personales, **sin sesión**:

| Verificación | Resultado |
|---|---|
| El aviso renderiza | ✅ `alert "Cómo tratamos tus datos personales"` |
| **Va antes del primer campo** | ✅ Verificado por `compareDocumentPosition` contra el primer `input` del formulario — no a ojo |
| Nombra a la sociedad de **esa** sede | ✅ "Sociedad Comercial Chillán Capacita Limitada" |
| Declara finalidad y plazo | ✅ "…5 años desde tu egreso o baja" |
| Canal de derechos | ✅ `conductorchillan@gmail.com` |
| Enlace a la política de su sede | ✅ `/politica-privacidad/conductores-chillan` |
| Consola | ✅ 0 errores |

### AC4 — QA visual del gate del Art. 16 (T5.3, 2026-08-18)

Sesión de secretaria, DMS → "Subir documento", alumno real de la base de la nube:

| Prueba | Resultado |
|---|---|
| Tipo `Certificado Médico` → aparece el aviso de dato sensible | ✅ |
| Casilla **no premarcada** | ✅ |
| **Archivo cargado + casilla sin marcar → subida bloqueada** | ✅ |
| Marcar la casilla → se habilita | ✅ |
| Desmarcarla → vuelve a bloquear | ✅ |
| Botón "No autoriza" presente (AC-E1) | ✅ |
| `Cert. Antecedentes` → sin bloque Art. 16, subida habilitada | ✅ |

### ✅ AC6 — Desincronización de esquema, resuelta (18-08-2026)

El panel mostraba *"Sin consentimientos registrados"*, pero la consulta devolvía **400**:

```
column consents.granted_by_representative does not exist
```

Sondeando columna por columna contra la API REST: en la nube existe **`representative_name`**, no
`granted_by_representative`. Está aplicada la versión de la migración **anterior al refactor del
17-08-2026**, así que el código apunta a una columna que no existe donde corre la app.

**Resuelto** con la migración correctiva `20260818120000_consents_align_representative_flag.sql`,
aplicada por el dueño el 18-08-2026. Tras aplicarla, el drawer carga **sin errores de consola** y su
estado vacío pasa a ser genuino.

> **La migración original tenía un defecto de idempotencia.** `CREATE TABLE IF NOT EXISTS` es
> idempotente solo si la tabla NO existe: si existe con otra forma, el CREATE se salta entero, ningún
> cambio de columna se aplica, y la migración revienta más abajo en el primer `COMMENT ON COLUMN` de
> una columna inexistente. La verificación de idempotencia que se hizo el 17-08 fue tramposa sin
> saberlo: se re-aplicó sobre una tabla que **ya tenía la forma nueva**. La correctiva sí se probó
> reconstruyendo la forma vieja, con backfill del representante y con el trigger append-only
> desactivado y vuelto a activar (verificado que sigue rechazando `UPDATE granted`).

### 🐛 Bug que ese 400 destapó — corregido

`loadByUser()` atrapaba el error y dejaba la lista vacía; el drawer solo miraba si estaba vacía. **En un
panel de cumplimiento, un fallo de consulta se veía idéntico a "este titular nunca consintió"** — la
conclusión opuesta a la verdad, justo en la pantalla con la que se le respondería a la Agencia.

Ahora hay un estado de error explícito ("esto **no significa** que el alumno no haya consentido: la
consulta falló") con el detalle técnico, más 2 tests de regresión. **El bug era independiente de la
desincronización**: cualquier caída de red lo habría producido. No lo vio ninguno de los 2184 tests.

### §8 — Métricas post-launch (T5.6)

Ambas consultas devuelven **0 filas**. Con la base vacía eso es trivialmente cierto; lo que queda
probado es que **las consultas sirven** para el día del despliegue.

> La segunda estaba mal escrita en el plan: `student_documents` se ancla a `enrollment_id`, no a
> `student_id`. Corregida al ejecutarla.

---

### AC6 — Por qué no hay captura de una fila renderizada

Decisión del dueño (18-08-2026): **no se crean consentimientos de prueba.** La tabla es append-only por
diseño —sin policy de DELETE en ningún rol— así que un registro falso quedaría **para siempre** en el
libro que se le muestra a la Agencia, atribuido a alguien que nunca consintió. Verificar el renderizado
no vale ese precio.

El renderizado de filas queda cubierto por los **9 tests** del drawer (los tres estados, sus variantes de
badge, el permiso de revocación y el formateo de fechas), y se confirmará visualmente con la primera
matrícula real.

## 🚩 Pendientes antes de cerrar

1. **Dos datos que el negocio aún no tiene** (confirmado el 18-08-2026). Ninguno bloquea el código;
   ambos están rastreados en constantes para que no se pierdan:

   | Dato | Dónde | Consecuencia de no fijarlo |
   |---|---|---|
   | `SUPABASE_HOSTING_COUNTRY` | `core/models/ui/privacy-policy.model.ts` | La política declara la transferencia internacional sin indicar el país. Es verdad, pero incompleto. `getPolicyPublishBlockers()` lo reporta y hay un test que cambia de rama solo al definirlo |
   | `POLICY_BASE_URL` | `supabase/functions/_shared/contract-pdf.ts` | La URL de la política se **imprime** en el contrato. Fijarlo después no arregla los contratos ya emitidos |
2. **T5.3 — QA visual: hecho para AC1 (flujo público) y AC2. Pendiente el resto.** Falta el paso de
   contrato del flujo público (requiere recorrer 5 pasos del wizard con datos reales), y **todo lo
   que necesita sesión**: aviso y casillas del flujo de secretaría, gate del Art. 16 en el DMS y
   panel de consentimientos.

   > **Blocker concreto:** la base local solo tiene sembrados **dos usuarios instructor**
   > (`carlos.munoz.inst@`, `roberto.soto.inst@`); no hay admin ni secretaria. Sin esas credenciales
   > no se puede entrar a las pantallas que faltan.

---

## Fuera de alcance, anotado para después

- `digital_contracts.signature_ip` y `audit_log.ip` son columnas declaradas desde el día uno que
  **nadie escribe nunca**. `request_client_ip()` las deja a un fix de distancia.
- Dos ramas de **código muerto** detectadas: `@if (!data().isMinor)` en `public-contract` (los menores
  no llegan hasta ahí) y `@if (isPublic())` en `matricula-steps/contract` (el único consumidor no pasa
  ese input). No se borraron: excede el alcance de esta spec.
- **Track `0010-m` abierto:** la preinscripción profesional guarda 81 respuestas del test psicométrico
  EPQ —datos de salud psíquica— sin consentimiento. **La corrida 1 de la auditoría no lo detectó.**
  Documentos de `.compliance/` ya corregidos (RAT actividad 15, EIPD R-8/M-11/M-12, política §2/§3/§5,
  Anexo 4 §4 bis).
