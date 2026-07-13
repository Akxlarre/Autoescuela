# Viabilidad de Conversión a SaaS — Informe de Investigación

> **Fecha:** 2026-07-13 · **Base:** auditoría del código real (142 migraciones, 76 tablas, 274 policies RLS, 612 archivos TS, 25 Edge Functions) + `docs/analisis-mercado-autoescuelas-chile.docx`
> **Pregunta:** ¿Es viable convertir este proyecto en un SaaS vertical para escuelas de conductores en Chile?

## Veredicto

**Sí, es viable — y el punto de partida es inusualmente bueno.** La parte cara de un SaaS vertical (el dominio profundo: Triple Match, matrícula chilena, RBAC con RLS real, contratos, certificados, carnets, Webpay, cuadratura de caja) ya está construida y validada en producción por un dueño real. Lo que falta es la **cáscara comercial** (tenancy, billing, onboarding), que es ingeniería conocida y acotada. Estimación: **3–4 meses de desarrollo enfocado** hasta la primera escuela externa pagando.

El hallazgo central de la auditoría: **el sistema ya es un proto-multi-tenant sin saberlo.** Las dos "sedes" (`branches`) son en realidad **dos empresas distintas** — marcas diferentes, webs separadas (`webs/`), paletas propias, oferta de cursos distinta (`has_professional`), numeración de matrícula independiente y configuración de sitio por sede (`website_config` JSONB con nombre de marca). El problema de "aislar y tematizar por cliente" ya se resolvió una vez; falta formalizarlo un nivel más arriba.

---

## 1. Viabilidad de negocio (resumen del análisis de mercado existente)

Según `docs/analisis-mercado-autoescuelas-chile.docx` (2026-05-29):

| Señal | Dato | Implicancia |
|---|---|---|
| Demanda | ~2M licencias tramitadas 2023 (+55,7%), ~328K nuevas/año | Mercado grande y en digitalización |
| Digitalización del sector | Mayoría gestiona con Excel/WhatsApp/papel | El dolor que este software ya resuelve es el dolor del mercado |
| Quejas del sector | 80% de reclamos son **administrativos**, no pedagógicos | Product-market fit de la tesis, validado con datos públicos |
| Competencia local | Solo **AutoSchool.cl** ($60K–$120K CLP/mes), foco Santiago, sin penetración verificada en regiones | Ventana de tiempo real en Biobío/regiones |
| Competencia extranjera | España/EE.UU. sin localización chilena (SEREMI, CONASET, SII, RUT) | La localización regulatoria es el foso defensivo |
| Ancla de precio | Planes AutoSchool: $60K/$90K/$120K por mes según alumnos | Pricing de referencia viable |

**Ventaja diferencial vs AutoSchool.cl:** este sistema nació dentro de una operación real con dos empresas y fue validado módulo a módulo por el dueño (`docs/reunion-demo-2026-05-29.md`). Profundidad operativa que un SaaS "de afuera" no tiene: flujo de matrícula presencial+online completo, test psicotécnico digital, ciclos teóricos con Zoom, carnet dual, libro de clases PDF, cuadratura con arqueo, SENCE, convalidaciones.

**Riesgos de negocio:**
1. **Carrera contra AutoSchool.cl** — si consolida regiones antes, la ventana se cierra.
2. **Carga de soporte** — pasar de 1 cliente (interno) a N escuelas exige soporte, SLA y onboarding; es el costo oculto de todo SaaS vertical.
3. **Propiedad intelectual** — aclarar contractualmente quién es dueño del software (¿el desarrollador o la escuela que lo encargó?) **antes** de comercializarlo a terceros. Bloqueante legal, no técnico.
4. **Demanda regional de licencias nuevas en Biobío bajó 9,8% en 2023** — el crecimiento regional viene de renovaciones; el TAM local es real pero no explosivo. Escalar implica salir de Biobío.

---

## 2. Activos técnicos (lo que ya juega a favor)

| Activo | Evidencia | Por qué importa para SaaS |
|---|---|---|
| **Proto-multitenancy operativo** | 2 empresas reales conviviendo en la misma BD, aisladas por `branch_id` vía RLS | El patrón de aislamiento existe y está probado en producción |
| **Helpers RLS centralizados** | `branch_visible()`, `auth_user_branch_id()`, `auth_user_role()` — las 274 policies llaman helpers, no lógica inline | El retrofit de tenancy se concentra en ~5 funciones SQL, no en 274 policies a mano |
| **Seguridad real en BD (no en frontend)** | RLS en las 76 tablas; capas 2–4 (guards, menú, EFs) declaradas explícitamente como UX | Arquitectura correcta para multi-tenant sobre Supabase; sin esto la conversión sería inviable |
| **White-label ya modelado** | `website_config` (JSONB por branch: marca, colores, precios) + `sede-theme.utils.ts` + landings Astro por empresa | El "cada cliente con su marca" ya tiene mecanismo |
| **`BranchFacade` como chokepoint frontend** | Regla arquitectónica: todo Facade branch-scoped lee `selectedBranchId()` | El filtro de tenant se inyecta en el mismo patrón, sin re-arquitectura de UI |
| **Pasarela de pago chilena integrada** | Transbank Webpay Plus en `public-enrollment` y `student-payment` | El flujo de dinero B2C ya funciona; falta solo el B2B (cobrar a las escuelas) |
| **Disciplina de ingeniería** | 142 migraciones idempotentes, SDD con specs/ACs, índices documentados, hooks de arquitectura | Un refactor estructural grande es ejecutable con bajo riesgo de regresión |
| **Config por sede en vez de código (tendencia reciente)** | `has_professional`, `max_classes_per_day`, `website_config` | La dirección ya es "config sobre hardcode"; hay que completarla |

---

## 3. Brechas técnicas (ordenadas por severidad)

### 3.1 Bloqueantes estructurales

1. **No existe el concepto `organization` sobre `branches`.** Hoy "admin ve todo" y `can_access_both_branches` asumen un solo dueño. Se necesita: tabla `organizations` (tenant), `branches.organization_id`, y que `branch_visible()` se redefina como `same_tenant() AND branch_visible()`. Es el corazón del retrofit — mecánico gracias a los helpers, pero toca todo.
2. **Unicidad global de identidad:** `users.rut UNIQUE` y `users.email UNIQUE` a nivel de BD completa. Un alumno matriculado en dos escuelas distintas (o un instructor que trabaja en dos) colisiona. Debe migrar a `UNIQUE(organization_id, rut)`, con decisión de diseño sobre `auth.users` (¿una identidad Supabase por persona o por persona×tenant?). **Es la migración más delicada del proyecto.**
3. **Sin capa de billing B2B:** planes, medición (por alumno activo, como AutoSchool), suspensión por no pago, panel superadmin. Todo por construir. Para cobro recurrente en CLP: Transbank Oneclick o Flow (Stripe es débil en Chile para suscripciones CLP).
4. **Sin provisioning:** hoy crear una "escuela" = migraciones y seeds a mano (cursos, `schedule_blocks`, usuarios, buckets). Se necesita un wizard de onboarding (asistido al inicio; self-service después).

### 3.2 Hardcodes de tenant único (auditados — pocos y localizables)

| Dónde | Qué | Archivos |
|---|---|---|
| SQL | `auth_can_enroll_course_type()` hardcodea reglas de branch 1 vs 2 | `20260310100000_enrollment_branch_course_restriction.sql` (+5 migraciones con `branch_id = 1/2` literal, mayoría seeds) |
| Frontend | Mapa tema↔sede hardcodeado (`1: 'roja', 2: 'azul'`) | `sede-theme.utils.ts`, `website-config.facade.ts:238` |
| Frontend | Nombres de sede literales | `route-sheet.component.ts:57`, ~21 archivos con "Chillán" (mayoría specs/tests) |
| Edge Functions | Nombre de escuela en PDFs y correos | 3 EFs (certificados, class-book, emails) — debe leerse de config del tenant |
| pg_cron | 7 jobs que iteran datos globales | Deben ser tenant-aware (hoy da igual; con N tenants, no) |

Es una lista corta y auditable — señal de que la disciplina "config sobre código" ya operaba. El costo real no está aquí sino en §3.1.

### 3.3 Consideraciones no bloqueantes

- **Un solo proyecto Supabase para todos los tenants:** correcto para partir (RLS aísla), pero implica noisy-neighbor, backup/restore por tenant complejo, y un blast radius compartido. Alternativa "proyecto por tenant" simplifica aislamiento pero complica operación y costos. Recomendación: **shared DB + RLS hasta ~20–30 escuelas**, reevaluar después.
- **`branch_visible(NULL) = true`:** las filas con `branch_id NULL` son visibles para todos. Bajo multitenancy hay que revisar cada tabla que use NULL como "global".
- **Landings Astro (`webs/`):** un proyecto por empresa desplegado a mano no escala. Pasa a ser módulo opcional white-label con template parametrizado — o se deja fuera del SaaS v1.
- **SII:** folios manuales (sin LibreDTE/OpenFactura). Para una escuela basta; como SaaS, la emisión automática es un diferenciador de roadmap, no un bloqueante.
- **4 roles fijos:** decisión deliberada (RBAC §6) y adecuada para SaaS v1. No tocar.
- **Ley 21.719 (vigencia dic-2026):** como software interno, la escuela es responsable del tratamiento; como SaaS, el operador pasa a ser **encargado de tratamiento** de N escuelas → requiere DPA con cada cliente, medidas de seguridad documentadas, RAT. El proyecto ya tiene el skill `compliance-cl` para generar esta documentación. Súmese Ley 21.595. **Debe estar listo antes del primer cliente externo, y la vigencia coincide con el timing del lanzamiento.**

---

## 4. Ruta propuesta (fases)

| Fase | Contenido | Esfuerzo estimado |
|---|---|---|
| **0. Higiene (desde ya)** | Regla dura: ningún hardcode nuevo de branch; todo nuevo parámetro de negocio nace como config. Resolver la pregunta de IP. | Continuo |
| **1. Modelo de tenant** | Tabla `organizations`, `organization_id` en `branches`, redefinir helpers RLS, migrar constraints de unicidad, parametrizar los ~10 hardcodes, crons tenant-aware. | 3–6 semanas |
| **2. Provisioning + superadmin** | Onboarding asistido (wizard de seeds: sedes, cursos, horarios, usuarios), panel superadmin, feature flags por plan. | 3–4 semanas |
| **3. Billing** | Suscripciones (Transbank Oneclick / Flow), medición por alumno activo, suspensión, facturación. | 2–3 semanas |
| **4. Go-to-market** | Piloto con 2–3 escuelas de baja digitalización en Gran Concepción (candidatas según el análisis: R-Group, Nova Chile, Agadez). Compliance 21.719 listo. | Paralelo a 2–3 |

**Total a primera escuela externa pagando: ~3–4 meses de desarrollo enfocado.**

## 5. Conclusión

La conversión no es una reescritura: es **añadir un nivel de aislamiento encima de un patrón que ya existe** (branch → organization) más una capa comercial estándar (billing + onboarding). Los riesgos dominantes no son técnicos sino de negocio: la propiedad del software, la ventana competitiva frente a AutoSchool.cl, y la capacidad de dar soporte a N escuelas. Técnicamente, la decisión más costosa e irreversible es el modelo de identidad (`rut`/`email` por tenant vs global) — conviene diseñarla con spec propia antes de escribir una sola migración.
