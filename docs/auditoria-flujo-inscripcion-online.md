# Auditoría — Flujo de Inscripción Online (`/inscripcion`)

> **Artefacto de trabajo** — UX/UI audit del flujo público de matrícula online.  
> Fecha: 2026-06-01 · Estado: En revisión

---

## Ecosistema completo — De las webs al wizard

El flujo de compra online comprende **dos proyectos separados** que se conectan mediante un enlace con query params:

```
[Webs Astro]  →  enlace con ?branchId=X&courseId=Y  →  [Angular /inscripcion]
```

### Proyecto 1 — Landing Pages (`webs/`)

**Stack:** Astro (SSR/SSG) · 2 temas: `azul` (sede 1) y `roja` (sede 2)

Cada tema es el mismo componente, diferenciado por variable de entorno `BRAND=azul|roja`.  
Los datos se cargan desde Supabase (`website_config` + catálogo `courses`) con **fallback a JSON estático** (`webs/src/content/site/{brand}.json`).

#### Estructura de secciones (una sola página, scroll)

| Sección | Componente | CTA hacia inscripción |
|---------|-----------|----------------------|
| Barra de navegación | `Navbar.astro` | "Inscribirme Online" → `enrollmentUrl` (desktop) |
| Banner promo del mes | `PromoBanner.astro` | CTA configurable → `enrollmentUrl` |
| Hero principal | `Hero.astro` | "Inscribirme Online" → `enrollmentUrl` + WhatsApp (opcional) |
| Catálogo de cursos | `Services.astro` | CTA por curso → `enrollmentUrl&courseId=Y` |
| Precios | `Pricing.astro` | CTA por fila → `enrollmentUrl&courseId=Y` |
| ¿Por qué nosotros? | `WhyUs.astro` | Sin CTA |
| Preguntas frecuentes | `FAQ.astro` | Sin CTA |
| Ubicación | `Location.astro` | Sin CTA |
| Contacto | `Contact.astro` | CTA directo → `enrollmentUrl` |
| Footer | `Footer.astro` | Sin CTA de inscripción |
| Botones flotantes | `FloatingCTA.astro` | WhatsApp + llamada (NO directo a inscripción) |

#### Construcción del `enrollmentUrl`

```js
// webs/src/pages/index.astro
const checkoutBaseUrl = import.meta.env.PUBLIC_CHECKOUT_URL || (isDev ? 'http://localhost:4200' : '');
const enrollmentUrl = `${checkoutBaseUrl}/inscripcion?branchId=${siteData.brand.branchId}`;

// Por curso (Pricing, Services):
const checkoutUrl = `${enrollmentUrl}&courseId=${course.courseId}`;
```

En producción comparten dominio → `enrollmentUrl` = `/inscripcion?branchId=1` (relativo).

#### También enlaza al portal

`Navbar.astro` incluye un link "Portal Alumnos" → `/login` (acceso para alumnos ya matriculados).

---

### Proyecto 2 — Wizard Angular (`src/`)

#### Recepción de los query params

```ts
// public-enrollment.component.ts — afterNextRender()
const branchIdParam = this.route.snapshot.queryParamMap.get('branchId');
const courseIdParam = this.route.snapshot.queryParamMap.get('courseId');
```

| Escenario | Comportamiento en el wizard |
|-----------|----------------------------|
| Sin params (URL directa) | Muestra paso `branch` normalmente |
| Solo `?branchId=X` | Auto-selecciona la sede y salta al paso `personal-data` |
| `?branchId=X&courseId=Y` | Auto-selecciona sede + pre-rellena categoría/tipo de curso, salta a `personal-data` |

**El paso `branch` se omite visualmente** cuando el usuario llega desde la web con `branchId` — el wizard arranca directamente en el formulario de datos.

---

## Arquitectura del flujo

Hay **dos rutas** en el flujo público:

| Ruta | Componente | Autenticación |
|------|-----------|---------------|
| `/inscripcion` | `PublicEnrollmentComponent` | ❌ Anónimo |
| `/inscripcion/retorno` | `PublicEnrollmentRetornoComponent` | ❌ Anónimo |

Facade central: `PublicEnrollmentFacade` — Edge Function `public-enrollment` bypasea RLS.

---

## Flujo A — Clase B (Matrícula completa + Webpay)

**7 pasos + retorno = 8 pantallas**

```
branch → personal-data → payment-mode → schedule → documents → contract → payment → /retorno
```

### Pantalla 0 — Draft Banner (condicional)

Se muestra **antes** de los pasos si existe un borrador en localStorage.  
Componente: inline en `PublicEnrollmentComponent`  
UI: ícono `file-clock`, texto "Tienes una solicitud en curso", 2 botones: "Retomar solicitud" / "Empezar de nuevo"

### Pantalla 1 — `branch` — Selección de Sede y Tipo de Licencia

Componente: `app-branch-course-selector`

- **Fase 1:** Cards de sede (nombre, dirección, cursos disponibles + precio, ícono `car`/`truck`)
- **Fase 2:** Cards de flujo (Clase B / Profesional) — solo visible si la sede tiene ambos. Si hay solo un flujo, se auto-selecciona.
- CTA: "Continuar" (aparece al completar selección)
- *Nota: la Progress Bar de puntos aún no aparece aquí — se inicializa después de `confirmBranchSelection()`*

### Pantalla 2 — `personal-data` — Datos del Alumno

Componente: `app-personal-data-step`  
Campos: RUT, nombres, apellidos, email, teléfono, fecha de nacimiento, género, dirección + selector de categoría/curso (2 niveles: categoría → curso específico)  
Lógica: `rutValid`, `ageStatus` (advertencia si menor), validación email  
Sin selector de sede (pasa `branches=[]`)

### Pantalla 3 — `payment-mode` — Modalidad de Pago

Componente: **inline en el padre** (no es un Dumb component separado)

2 cards:
- **Pago total** → 12 clases (o N según curso)
- **Abono (50%)** → 6 clases

CTA: "Continuar" (aparece al seleccionar)

### Pantalla 4 — `schedule` — Selección de Instructor y Horario

Componente: `app-assignment-step` con `[hidePaymentMode]="true"`, `[stepNumber]="4"`

- Selector de instructor (cards)
- Navegación semanal
- Grid de slots disponibles por día
- Panel resumen de slots seleccionados (badge contador verde/naranja)
- Restricción: máx 1 clase por día
- Auto-avance al siguiente día disponible tras seleccionar un slot
- Polling Realtime cada 15s vía Edge Function

### Pantalla 5 — `documents` — Foto Carnet

Componente: `app-documents-step` con `[stepNumber]="5"`  
En el flujo público solo pide la **foto del carnet** (no documentos HVC ni licencia previa)

- Upload de imagen → `facade.uploadCarnetPhoto(file)` → Storage `public-uploads/carnet/{token}`
- Preview local con blob URL (bucket privado, no URL pública)
- Lightbox al hacer clic en la foto
- `canAdvance` bloqueado hasta upload exitoso

### Pantalla 6 — `contract` — Contrato y Términos

Componente: `app-contract-step` con `[isPublic]="true"`, `[stepNumber]="6"`

En modo público (diferente al admin):
- Oculta: indicador 3 pasos, instrucciones de impresión, upload físico
- Muestra: checkbox de aceptación de términos + botón "Generar contrato" (preview PDF)
- CTA: "Continuar al Pago" (en lugar de "Continuar")
- `canProceed = termsAccepted` (no requiere PDF subido)

### Pantalla 7 — `payment` — Resumen y Pago Webpay

Componente: **inline en el padre** (no es un Dumb component separado)

- Avatar con iniciales + nombre + curso
- Card sede (nombre + dirección)
- Modalidad de pago + clases agendadas
- **Total a pagar ahora** (CLP formateado)
- Aviso "Serás redirigido a Webpay"
- CTA: "Proceder al pago" (con spinner durante `isSubmitting`)
- `onPaymentProceed()` → Edge Fn `initiate-payment` → `window.location.href` → Transbank

### Pantalla 8 — `/inscripcion/retorno` — Resultado de Pago

Componente: `PublicEnrollmentRetornoComponent`

4 estados:

| Estado | Condición | UI |
|--------|----------|----|
| `loading` | Verificando token_ws | Spinner animado |
| `success` | Webpay confirmó | ícono check + N° matrícula (`kpi-value`) + card detalle (sede, curso, clases, monto, saldo pendiente) + "Recibirás un correo..." + btn "Volver al inicio" |
| `rejected / cancelled` | Usuario canceló en Webpay (`TBK_TOKEN` presente, sin `token_ws`) | ícono warning + "Pago cancelado" + btn "Reintentar pago" |
| `rejected / bank_rejected` | Banco rechazó | ícono error + mensaje humanizado (códigos Webpay -1 a -5) + btn "Intentar con otra tarjeta" |
| `error` | Sin token / timeout | ícono warning + msg + btn "Volver al inicio" |

---

## Flujo B — Clase Profesional (Pre-inscripción)

**4 pasos — sin pago**

```
branch → personal-data → psych-test-intro → psych-test → pre-confirmation
```

### Pantalla 3 — `psych-test-intro` — Info EPQ

Inline en el padre. 3 bullets (81 preguntas, 10-15 min, sin respuestas incorrectas). CTA "Comenzar test".

### Pantalla 4 — `psych-test` — Test Psicológico EPQ

Componente: `app-psych-test`  
81 preguntas SI/NO paginadas en 6 páginas (~14 por página). Barra de progreso interna. Botón "Enviar test" solo en última página si todo respondido.

### Pantalla 5 — `pre-confirmation`

Componente: `app-public-confirmation` con `type="pre-inscription"`. Mensaje de éxito + próximos pasos.

---

## Progress Bar (dots)

```
facade.steps() → array de PublicStepConfig
```

Se renderiza en ambos flujos excepto en la pantalla de confirmación. Los dots se marcan `completed` (check) o `active` (número). El paso `branch` **no aparece** como dot (los steps se inicializan después de `confirmBranchSelection()`).

---

## Hallazgos UX/UI — Estado Actual

### En el wizard Angular

| # | Área | Observación | Impacto estimado |
|---|------|-------------|-----------------|
| 1 | **Arquitectura** | Pasos `payment-mode` (P3) y `payment` (P7) son inline en el padre — no son Dumb components reutilizables | Difícil rediseñar en aislamiento |
| 2 | **Orientación** | La Progress Bar no se muestra en el paso `branch` — el usuario no sabe cuántos pasos hay al llegar | Alto — desorientación inicial |
| 3 | **Confianza pre-pago** | La pantalla de pago (P7) no muestra el desglose de las clases agendadas (solo el conteo) | Alto — baja confianza antes de pagar |
| 4 | **Post-compra** | Pantalla retorno `success` no tiene CTA para ir al portal del alumno ni instrucciones claras de próximos pasos | Alto — drop-off sin orientación |
| 5 | **Contrato** | El usuario acepta términos pero no "firma" nada memorable — baja percepción de compromiso | Medio |
| 6 | **Flujo Profesional** | `pre-confirmation` termina sin folio visible ni confirmación de email enviado | Medio — "¿fue enviado?" |
| 7 | **Draft restore** | El banner no muestra cuándo fue creado ni en qué paso quedó el borrador | Medio — fricción al retomar |
| 8 | **Contexto** | El header "Matrícula Online" es estático — no cambia según el paso ni refleja sede/curso elegido | Medio |
| 9 | **Documentos** | El paso `documents` no tiene guía visual de qué es una foto aceptable (fondo, formato, tamaño) | Medio — re-uploads y abandono |
| 10 | **Resiliencia** | El wizard vive en una sola URL `/inscripcion` — recarga = pérdida de estado (salvo draft localStorage) | Medio — especialmente en mobile |

### En la transición Web → Wizard

| # | Área | Observación | Impacto estimado |
|---|------|-------------|-----------------|
| 11 | **Ruptura de contexto** | Al llegar desde la web con `?branchId&courseId`, el wizard arranca en blanco (fondo neutro, header genérico) — el usuario pierde toda la identidad visual de la landing (color de marca, nombre, fotos) | Alto — sensación de "me sacaron del sitio" |
| 12 | **Sin confirmación de pre-selección** | Si el usuario llega con `?courseId=Y`, el curso se pre-rellena en el formulario pero no hay mensaje visible tipo "Estás inscribiéndote en Clase B — Sede Norte" antes del formulario | Medio — confusión silenciosa |
| 13 | **FloatingCTA no linkea inscripción** | Los botones flotantes de WhatsApp y teléfono son el último recurso en la web, pero si el usuario abandona el wizard no hay forma de retomarlo desde ahí | Medio |
| 14 | **Datos de precio no persisten** | La web muestra el precio con posible `priceOverride`; el wizard calcula su propio precio desde BD. Si hay override en la web y no en el wizard, el usuario ve precios distintos | Alto — quiebre de confianza |
| 15 | **Sin tracking de origen** | No se pasa `utm_source` ni parámetro de origen al wizard — no es posible saber desde qué sección de la web provino el usuario | Bajo ahora, bloquea análisis futuro |

---

## Síntesis de la Investigación UX

> Basado en `docs/research/ux-wizard-inscripcion-educativo.md` y `docs/research/ux-transicion-landing-checkout.md`
> Fuentes: Baymard Institute, Nielsen Norman Group, CXL, benchmarks de Stripe / Booking / Shopify

### Datos críticos

| Métrica | Valor | Fuente |
|---------|-------|--------|
| Tasa promedio abandono en checkout | **70.19%** | Baymard (14 años de mediciones) |
| Usuarios que no vuelven tras mala experiencia de pago | **88%** | UX transaccional |
| Causa #1 de abandono: costos inesperados | **39–48%** de toda la deserción | Baymard Institute |
| Causa: preocupaciones de seguridad | **25%** del abandono | Baymard Institute |
| Consistencia visual → impacto en ingresos | **+33%** | Estudios de marca en checkout |
| Recuperación vía WhatsApp — tasa de apertura | **80–98%** | Benchmarks de industria |
| Recuperación vía email — tasa de apertura | **20–45%** | Benchmarks de industria |
| Tráfico orgánico: conversión promedio | **~2.4%** | CXL / datos industria |
| Tráfico social/pagado: conversión promedio | **~1.3%** | CXL / datos industria |

### Principios validados que aplican a este proyecto

1. **Continuidad de marca es obligatoria** — La ruptura visual landing→wizard activa la heurística de phishing del usuario. El wizard debe heredar el color primario de la sede desde `?branchId`. Impacto: hasta +33% en ingresos.

2. **Resumen de contexto ANTES del primer campo** (Baymard) — Mostrar "qué elegiste" (curso + sede + precio) antes de pedir cualquier dato. La omisión crea "formulario ciego": el usuario teme completar datos para el curso equivocado y abandona.

3. **Saltar el paso ya realizado en la web, NO repetirlo** — Deep link con `courseId` = Paso 1 completado. Mostrarlo como ✓ en el stepper + botón "Editar" que abre los selectores internamente, sin salir del wizard. Fuente: Baymard + patrón Booking.com.

4. **Efecto del progreso dotado** — Arrancar con 1 paso ya marcado como completo multiplica la motivación para terminar. El usuario no quiere "desperdiciar" el avance acumulado.

5. **Precio visible desde el paso 1** — No puede aparecer por primera vez en el resumen pre-pago. El "sticker shock" tardío es causa del 39–48% de abandono.

6. **CTAs de la web en misma pestaña** (`target="_self"`) — NNGroup categórico: nueva pestaña desactiva el botón Atrás en móvil, causa desorientación y abandono. El 75% del tráfico es móvil.

7. **Señales de confianza en los primeros 3 segundos** — Logo + WhatsApp de contacto + "Sin cobros sorpresa" junto al CTA de pago. Sellos de seguridad al lado de campos sensibles, NO en el footer.

8. **Draft = 30 días** para servicios de alto valor. Autosave field-by-field. Banner de retorno mostrando fecha y paso donde se dejó.

9. **Progress bar con nombres de pasos** — Para 7 pasos, los nombres ("Datos", "Horario", "Pago") superan a los dots numéricos puros. Mostrar el total de pasos, no ocultarlos.

10. **WhatsApp como CTA principal post-pago** — 80–98% apertura vs 20–45% email. El botón primario en `/retorno` success debe ser WhatsApp o portal del alumno, nunca "Volver al inicio".

---

## Decisiones de Rediseño

### Decidido — con respaldo de investigación

**Transición Web → Wizard**
- [x] **Tematización dinámica por sede**: al recibir `?branchId`, el wizard inyecta el color primario de la sede como variable CSS global. Botones, barra de progreso y accents adoptan el tema azul/roja.
- [x] **Banner de contexto antes del primer campo**: card con nombre del curso + sede + precio visible desde el inicio. Botón "Editar selección" abre los selectores internamente sin salir del wizard.
- [x] **Paso de selección de sede eliminado** (revisado 2026-06-01): las landings son empresas distintas, la sede es tenant vía `branchId`, no una elección del wizard. Sin `branchId` → pantalla de orientación con enlaces a las webs. El tipo de licencia (Clase B/Profesional) pasa a ser el primer paso, auto-saltado si la sede ofrece una sola opción. Ver spec `0009` AC6/AC-E1.
- [x] **`target="_self"` en todos los CTAs de la web**: obligatorio según NNGroup para móvil.
- [x] **Precio visible desde el paso 1** en el banner de contexto, no solo en el resumen pre-pago.

**Wizard interno**
- [x] **Progress bar con nombres**: reemplazar dots numéricos por stepper nombrado ("Datos", "Modalidad", "Horario", "Foto", "Contrato", "Pago"). Color de barra = color de sede.
- [x] **Señales de confianza en el header**: logo escuela + WhatsApp de la sede + "Sin cobros sorpresa" junto al CTA de pago.
- [x] **Desglose de clases en resumen pre-pago**: mostrar fechas y horas agendadas antes del redirect a Webpay, no solo el conteo.
- [x] **Draft banner mejorado**: "Dejaste en: Selección de horario · hace 2 días" — fecha relativa + paso donde se pausó.
- [x] **`/retorno` success — CTA principal WhatsApp**: botón primario = WhatsApp de la sede. Secundario = portal `/login`. Eliminar "Volver al inicio" como acción principal.
- [x] **Guía de foto en paso `documents`**: instrucciones inline + ejemplo de foto válida/inválida antes del botón upload.

### Pendiente de decisión

- [ ] ¿Pasar `?source=social` desde la web para mostrar trust signals adicionales a usuarios de redes sociales?
- [ ] ¿Implementar exit-intent modal dentro del wizard? (NNGroup lo desaconseja, pero datos muestran 17% conversión en abandono de carrito)
- [ ] ¿Sincronizar `priceOverride` de la web al wizard via query param? ¿O confiar en que BD siempre es fuente de verdad?
- [ ] ¿Extraer `payment-mode` y `payment` a Dumb components propios o mantenerlos inline?
