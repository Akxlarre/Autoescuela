# Catálogo de controles + crosswalk

Cada **control** es una unidad reutilizable de cumplimiento. Un mismo control satisface
requisitos de **varios marcos a la vez** → se evalúa una vez y se propaga. Esta es la pieza
que hace genérico al motor: para agregar un marco nuevo, se le suman columnas a esta tabla
(o el pack referencia los `id` de control que exige).

> Estado por control: ✅ cumple · ⚠️ parcial · ❌ falta · ❓ no verificable por código.
> `evidencia`: `archivo:línea` o "declarado por el usuario". Anota remediación si no es ✅.

## Crosswalk (control → marcos)

| id | Control | 21.719 (Datos) | 21.595 (MPD) | Autoescuela-CL (DS 39/251) | Futuro (ISO 27001 / SOC 2 / GDPR) | Fuente de evidencia |
|----|---------|----------------|--------------|-----------------------------|-----------------------------------|---------------------|
| `gov-responsable` | Responsable/oficial designado | DPO si aplica | Oficial de cumplimiento | Director técnico | ISO A.5.3 / SOC2 CC1 | usuario |
| `gov-registro` | Registro/inventario formal | RAT | Matriz de riesgos de delitos | Libro de registro de alumnos | ISO A.5.9 | usuario + código |
| `gov-politicas` | Políticas documentadas | Política de privacidad | Código de ética | Reglamento interno | ISO A.5.1 | docs generados |
| `gov-capacitacion` | Capacitación al personal | buena práctica | Capacitación (obligatoria) | — | ISO A.6.3 | usuario |
| `gov-auditoria` | Auditoría/revisión periódica | parte del MPI | Auditoría del modelo | — | ISO 9.2 / SOC2 CC4 | usuario |
| `gov-disciplinario` | Régimen disciplinario interno | parte del MPI | Sí (sanciones internas) | — | ISO A.6.4 | usuario |
| `gov-denuncias` | Canal de reporte/denuncias | canal de contacto/derechos | Canal anónimo de denuncias | — | ISO A.5.x / GDPR Art.38 | código + usuario |
| `data-licitud` | Base de licitud / consentimiento opt-in | Sí | — | vía `ley-21719` | GDPR Art.6 | código (formularios) |
| `data-derechos` | Derechos del titular (ARCO+portabilidad+bloqueo) | Sí (30 días) | — | vía `ley-21719` | GDPR Art.15-22 | código (endpoints) |
| `data-info` | Deber de información / aviso de privacidad | Sí | — | vía `ley-21719` | GDPR Art.13 | código + docs |
| `data-minimizacion` | Minimización y retención | Sí | — | — | GDPR Art.5 | código |
| `data-dpa` | Contratos con encargados (DPA) | Sí | control de terceros | — | GDPR Art.28 | docs + usuario |
| `data-transfer` | Transferencias internacionales con mecanismo | Sí | — | — | GDPR Cap.V | código (.env/proveedores) |
| `data-consent-text` | Texto de consentimiento opt-in + revocación | Sí (Art. 12/16) | — | — | GDPR Art.7 | docs + código |
| `data-rights-channel` | Canal/formulario para ejercer derechos | Sí (Art. 14 ter) | — | — | GDPR Art.12 | docs + código |
| `data-eipd` | Evaluación de Impacto (alto riesgo) | Sí (Art. 15 ter) | — | — | GDPR Art.35 | docs + usuario |
| `data-privacy-by-design` | Privacidad desde el diseño y por defecto | Sí (Art. 14 quáter) | — | — | ISO A.8.x / GDPR Art.25 | código |
| `data-pseudonym` | Seudonimización de datos | Sí (Art. 14 quinquies) | — | — | GDPR Art.32 | código |
| `sec-tls` | Cifrado en tránsito (TLS/HTTPS) | Sí | control interno TI | — | ISO A.8.24 / SOC2 CC6 | código/infra |
| `sec-rest` | Cifrado en reposo (datos sensibles/credenciales) | Sí | — | — | ISO A.8.24 / SOC2 CC6 | código/infra |
| `sec-passwords` | Hashing fuerte de contraseñas (bcrypt/argon2) | Sí | — | — | ISO A.8.5 | código |
| `sec-mfa` | MFA en accesos administrativos | Sí | control de acceso | — | ISO A.8.5 / SOC2 CC6.1 | código/infra/usuario |
| `sec-logs` | Logs de acceso y auditoría | Sí | control interno | — | ISO A.8.15 / SOC2 CC7 | código |
| `sec-tenant` | Segregación por tenant/cliente | Sí | — | — | SOC2 CC6 | código (`organizationId`) |
| `sec-secrets` | Secretos fuera del código | Sí | control interno | — | ISO A.8.24 | código (.env/secret mgr) |
| `sec-backups` | Backups y borrado/retención | Sí | — | — | ISO A.8.13 | infra/usuario |
| `inc-brechas` | Gestión de incidentes + notificación de brechas | Sí (sin dilaciones indebidas, Art. 14 sexies) | — | — | GDPR Art.33 / SOC2 CC7 | docs + usuario |
| `ctrl-interno` | Control interno: segregación de funciones / autorizaciones | — | Sí | — | ISO A.5.x / SOC2 CC | usuario + código |
| `sec-monitoring` | Monitoreo y alertas (audit log, secretos, errores) | detección de brechas | detección delitos informáticos | — | SOC2 CC7 | infra + usuario |
| `auto-reconocimiento` | Reconocimiento oficial vigente (Municipalidad Clase B / MTT Clase A) | — | — | Sí (Ley 18.290 Art. 31 bis) | — | usuario (resolución) |
| `auto-instructores` | Instructores cumplen licencia/antigüedad/idoneidad/curso pedagógico | — | — | Sí (DS 39 Art. 13 / DS 251 Art. 17) | — | usuario (ficha) |
| `auto-flota` | Vehículos cumplen especificación (doble comando, antigüedad, revisión técnica) | — | — | Sí (DS 39 Art. 4-8 / DS 251 Art. 10-11) | — | usuario (ficha) |
| `auto-seguro-flota` | Póliza de seguro de riesgos a terceros vigente por vehículo | — | — | Sí (DS 39 Art. 7) | — | usuario |
| `auto-curricula` | Programa de enseñanza aprobado + horas mínimas cumplidas | — | — | Sí (DS 39 Art. 17-18 / DS 251 Art. 12) | — | usuario |
| `auto-infraestructura` | Sala teórica e implementos exigidos presentes | — | — | Sí (DS 39 Art. 9 / DS 251 Art. 9) | — | usuario |
| `auto-registro-alumnos` | Libro de registro de alumnos foliado y visado | — | — | Sí (DS 39 Art. 21) | — | usuario |
| `auto-fiscalizacion` | Libros de reclamos/asistencia/fiscalización al día | — | — | Sí (DS 251) | — | usuario |
| `cons-contrato` | Contrato de matrícula conforme a Ley 19.496 (info veraz, sin cláusulas abusivas) | — | — | Sí | — | docs generados |
| `trib-clasificacion` | Clasificación tributaria (exento/afecto IVA) confirmada con SII/contador | — | — | Sí — no self-service, ver `nota-tributaria-iva.md` | — | usuario + `[CONTADOR]` |

## Cómo usarlo
1. En Fase 1, junta evidencia para cada `id` que tengan los packs activos.
2. En Fase 2, asigna estado + evidencia + remediación por control.
3. El score de cada marco = % de sus controles requeridos en ✅ (⚠️ cuenta como medio).
4. Guarda el resultado por control en `state.json` (ver `output-model.md`).
