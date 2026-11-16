# 012 — Seguridad automatizada

> **Fase:** 3 · **Prioridad sugerida:** P1 (con una parte urgente, ver abajo) · **Tipo sugerido:** fix
> **Depende de:** `003` para la matriz de permisos; el resto, de nada
> **Nivel hoy:** 1 (hay tests de permisos, se corren a mano) · **Meta:** 3

## En una frase

Una dependencia vulnerable, un secreto subido por error o un permiso que se abrió sin querer
aparecen en el PR, no en un incidente.

## El concepto

Las pruebas de seguridad se dividen por lo que miran:

| Sigla | Qué revisa | Ejemplo |
| ----- | ---------- | ------- |
| **SCA** (_Software Composition Analysis_) | Las librerías de terceros, contra una base de vulnerabilidades conocidas | `npm audit`, Dependabot |
| **SAST** (_Static Application Security Testing_) | El código propio, sin ejecutarlo | Reglas de lint de seguridad |
| **Escaneo de secretos** (_secret scanning_) | Contraseñas, llaves y tokens dentro del repositorio | gitleaks |
| **DAST** (_Dynamic Application Security Testing_) | La aplicación corriendo, atacándola desde afuera | Escáneres web |
| **Pruebas de autorización** | Que cada rol solo pueda lo que le corresponde | La matriz de permisos |

Las herramientas automáticas encuentran lo conocido: una librería con un aviso publicado, un
texto con forma de llave. **No encuentran errores de lógica**, y el más frecuente y grave es el de
**control de acceso** (_broken access control_): un usuario que accede a lo que no es suyo. Una
variante típica es **IDOR** (_Insecure Direct Object Reference_): cambiar un identificador en la
petición y recibir el dato de otro.

Por eso la pieza central es la **matriz de permisos**: una tabla de rol por recurso por acción,
con el resultado esperado en cada celda, convertida en tests que hablan con la API y no con la
pantalla.

Otros principios:

- **Mínimo privilegio** (_least privilege_): cada cuenta y cada llave puede solo lo que necesita.
- **Defensa en profundidad:** más de una capa. Que la pantalla no muestre el botón, que la función
  valide, que la base rechace.
- **Cadena de suministro** (_supply chain_): lo que se instala y lo que corre en el CI también es
  código que se ejecuta con los permisos del proyecto.
- **Modelado de amenazas** (_threat modeling_): preguntarse quién querría hacer qué, antes de
  construir.

## Por qué importa acá

Verificado el 2026-11-15.

### Urgente: cuentas de prueba públicas sobre datos reales

- El repositorio `Akxlarre/Autoescuela` es **público**.
- La contraseña de las cuentas de prueba está en al menos 12 archivos versionados, entre ellos
  `docs/E2E-PLAYWRIGHT.md` y `e2e/support/accounts.ts`.
- `admin@test.com` existe en la única base del proyecto, que tiene además 48 cuentas que no son de
  prueba. Es administrador y ve todas las sedes.
- `hotfix-007-i` sacó la contraseña de la pantalla de login en el build de producción. Eso no
  cubre el repositorio.

Mientras esas cuentas y esa base sean las mismas, cualquiera que lea el repositorio puede entrar
como administrador. La corrección de fondo es `002` (que las cuentas de prueba vivan solo en un
entorno de pruebas). La inmediata es de configuración y no requiere código: ver "Cómo se hace".

### El resto

- **12 vulnerabilidades conocidas en dependencias de producción** (`npm audit --omit=dev`): 9
  altas y 3 moderadas. Once tienen corrección disponible (paquetes de Angular, `postcss` y tres
  transitivas). `xlsx` no tiene corrección publicada en npm.
- **Dependabot solo vigila GitHub Actions** (`.github/dependabot.yml`), no las dependencias de npm.
- **No hay escaneo de secretos** configurado en el repositorio.
- **`main` no tiene protección de rama** ni reglas (ver `005`): cualquiera con permiso de
  escritura puede subir directo.
- **Los tests de permisos existen y no corren solos:** 29 tests SQL de RLS y 11 archivos e2e que
  consultan la API con `getClientFor()` (ver `003` y `004`).
- **El historial de hallazgos es de control de acceso.** El resumen de `specs/testing-piloto/`
  agrupó unas 40 sospechas graves, la mayoría de ese tipo: funciones con la clave de servicio sin
  validar rol ni sede, RLS que filtraba por rol y no por sede, Storage legible entre sedes. Cada
  una se corrigió en su fix; nada garantiza que no vuelvan.
- **Datos sensibles:** RUT, direcciones, documentos de identidad, resultados de test psicológico.
  La Ley 21.719 entra en vigencia en diciembre de 2026.

## Qué hay hoy

- Los tests de RLS y los de API por rol.
- Los guards de autorización compartidos de las edge functions, con tests.
- Un meta-test sobre funciones `SECURITY DEFINER` (`supabase/tests/rls/fix-363-m-auditoria-y-rpc.sql`).
- El asesor de seguridad de Supabase, disponible en el panel.
- La skill `compliance-cl` para la parte normativa.

## Cómo se hace

### 0. Lo inmediato: cuentas de prueba

Sin tocar código, y en este orden:

1. Cambiar la contraseña de todas las cuentas `@test.com` en la base real por valores que no estén
   en el repositorio.
2. Guardar las nuevas en el gestor de contraseñas del equipo y hacer que la suite e2e las lea de
   variables de entorno.
3. Revisar en el registro de auditoría y en los inicios de sesión si esas cuentas se usaron desde
   lugares que no son del equipo.
4. Decidir si el repositorio debe seguir siendo público.

Cambiar la contraseña sin el paso 2 rompe la suite e2e de todo el equipo: coordinarlo.

### 1. Dependencias

- `npm audit` en el CI. Primero informativo; después bloqueante para severidad alta, con una lista
  de avisos aceptados que lleve motivo y fecha de revisión.
- Dependabot para npm, agrupado y con frecuencia semanal.
- Revisión de cada aviso actual: muchos no son explotables en el uso que hace el proyecto, pero
  hay que mirarlos uno por uno.
- Las dependencias de las edge functions van fijadas por versión dentro del código
  (`npm:pdf-lib@1.17.1`, `npm:nodemailer@6`): revisarlas a mano cada cierto tiempo.

### 2. Secretos

Un escáner de secretos en el CI y como paso previo al commit. En un repositorio público GitHub
ofrece además su propio escaneo y la protección al subir; conviene activarlos.

### 3. La matriz de permisos

| Rol | Recurso | Leer propia sede | Leer otra sede | Escribir propia | Escribir otra |
| --- | ------- | ---------------- | -------------- | --------------- | ------------- |
| Sin sesión | cualquiera | no | no | no | no |
| Secretaria | alumnos | sí | no | sí | no |
| Secretaria con permiso multi-sede | alumnos | sí | sí | sí | por definir |
| Instructor | sus clases | sí | — | sí | — |
| … | … | … | … | … | … |

Los recursos son cuatro familias: tablas (RLS), funciones de la base, edge functions y archivos de
Storage. Cada celda se vuelve un test contra la API. El valor está en la exhaustividad: una tabla
nueva sin fila en la matriz deja el CI en rojo.

### 4. Lo que ya ofrece la plataforma

Correr el asesor de seguridad de Supabase de forma programada y tratar sus hallazgos como los de
un linter.

### 5. Configuración

- Protección de `main` (ver `005`).
- Fijar las acciones de terceros del CI a una versión exacta.
- Cabeceras de seguridad del sitio publicado, revisadas una vez.

### 6. Antes de abrir el pago en línea

Una revisión externa (prueba de penetración) cuando la matrícula pública con pago salga del piloto.

## Alcance propuesto

- El punto 0, de inmediato.
- `npm audit` y Dependabot para npm, con los 12 avisos actuales clasificados.
- Escaneo de secretos en el CI.
- La matriz de permisos escrita y convertida en tests, para tablas y edge functions.
- El asesor de seguridad programado.

## Fuera de alcance

- La documentación de cumplimiento normativo (`compliance-cl`).
- La prueba de penetración externa.
- Reescribir políticas de RLS que ya funcionan.

## Cómo saber que está terminado

- [ ] Ninguna contraseña de una cuenta que exista en la base real está en el repositorio.
- [ ] Un PR que agrega una dependencia con una vulnerabilidad alta queda en rojo o exige una
      excepción escrita.
- [ ] Los avisos actuales están corregidos o aceptados con motivo y fecha.
- [ ] Subir un texto con forma de llave deja el CI en rojo.
- [ ] La matriz cubre todas las tablas con datos personales y todas las edge functions.
- [ ] Una tabla nueva sin fila en la matriz deja el CI en rojo.
- [ ] Hay una persona responsable de revisar los avisos cada semana.

## Trampas conocidas

- **Falsa tranquilidad.** Un escáner en verde no dice nada sobre la lógica de permisos.
- **Ruido.** Muchos avisos de dependencias no aplican. Sin una lista de aceptados, el check se
  termina ignorando.
- **Actualizaciones que rompen.** Agrupar y tener tests que corran solos (`003`, `004`) antes de
  aceptar actualizaciones automáticas.
- **Rotar un secreto no lo borra del historial.** Lo que alguna vez se subió sigue en el historial
  de git: hay que invalidarlo, no solo quitarlo del archivo.
- **Probar seguridad contra producción.** Los tests de permisos corren en el entorno de pruebas.
- **La clave de servicio.** Se salta todo. Cada uso es una excepción al modelo de permisos y
  merece su test.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Si el repositorio sigue siendo público | Dueño del producto |
| Qué hacer con las cuentas de prueba en la base real, y cuándo | Equipo, ya |
| Política de bloqueo por vulnerabilidades | Equipo |
| Qué puede hacer la secretaria con permiso multi-sede en cada recurso | Dueño del producto |
| Quién revisa los avisos | Equipo |

## Vocabulario

- **SCA / SAST / DAST:** análisis de dependencias / del código / de la app corriendo.
- **Broken access control:** acceder a lo que no corresponde.
- **IDOR:** cambiar un identificador para ver el dato de otro.
- **Least privilege:** mínimo permiso necesario.
- **Supply chain:** todo lo que se instala y ejecuta de terceros.
- **Secret scanning:** búsqueda de credenciales en el repositorio.
- **Penetration test:** revisión de seguridad hecha por un tercero que intenta entrar.
