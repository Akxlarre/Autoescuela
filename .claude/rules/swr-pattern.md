# Patrón SWR (Stale-While-Revalidate) + Realtime

## Principio

**Nunca mostrar skeleton si ya tenemos datos cacheados.** El usuario ve datos inmediatos (posiblemente stale) mientras el Facade refresca silenciosamente en background. El skeleton solo aparece en la primera carga real (sin datos previos).

## Cuándo aplicar cada estrategia

| Estrategia | Cuándo usar | Ejemplo |
|------------|------------|---------|
| **SWR** | Cualquier Facade con datos que persisten entre navegaciones | Agenda, Dashboard, Alumnos |
| **SWR + Realtime** | Recursos compartidos con alta contención multi-usuario | Agenda (slots), Notificaciones |
| **Solo fetch** | Datos que cambian  en cada vista y no se revisitan | Detalle de alumno (por `:id`) |

## Implementación en Facades

### 1. Estado SWR (agregar al estado privado)

```typescript
/** Flag para evitar re-fetch completo con skeleton en re-visitas. */
private _initialized = false;
```

### 2. Initialize con guard SWR

```typescript
async initialize(): Promise<void> {
  if (this._initialized) {
    // SWR: mostrar datos cacheados, refrescar en background
    void this.refreshSilently();
    return;
  }

  // Primera carga: CON skeleton
  this._isLoading.set(true);
  this._error.set(null);
  try {
    await this.fetchData();
    this._initialized = true; // solo si cargó: una primera carga fallida se reintenta con skeleton
  } catch {
    this._data.set([]); // caso A: nada de lo anterior se muestra como vigente
    this._error.set('No se pudieron cargar los datos.'); // mensaje propio de la pantalla
  } finally {
    this._isLoading.set(false);
  }
}
```

### 3. Refresh silencioso (sin skeleton)

```typescript
/**
 * Refresca datos sin mostrar skeleton.
 * Usado por: SWR re-entry, Realtime events, post-action refresh.
 * Caso B: si falla, lo visible se queda, pero queda marcado como posiblemente viejo.
 */
private async refreshSilently(): Promise<void> {
  try {
    await this.fetchData();
    this._refreshFailed.set(false);
    this._error.set(null);
  } catch {
    this._refreshFailed.set(true);
  }
}
```

### 4. Método de fetch compartido

Extraer la lógica de fetch a un método reutilizable que solo obtiene y setea datos, sin tocar `_isLoading`:

```typescript
private async fetchData(): Promise<void> {
  const rows = assertReadOk(
    await this.supabase.client.from('tabla').select('...'),
  ); // lanza si la lectura falló (core/utils/db-error.utils.ts)
  this._data.set(rows);
}
```

`assertReadOk(resultado)` equivale a `if (error) throw error` y devuelve `data`. Cualquiera de las
dos formas sirve; lo que nunca sirve es leer `data` sin mirar `error`.

## Errores de carga: una lectura que falla nunca se ve como "no hay nada"

supabase-js **no lanza** cuando una lectura falla: resuelve `{ data: null, error }`. Si el Facade
toma solo `data` y sigue con `data ?? []`, la pantalla muestra $0, 0 o "sin datos", y el usuario no
puede distinguir "no hay nada" de "no cargó". Con datos de dinero, eso lleva a decidir con un número
falso.

### Regla 1 — Toda lectura revisa su error

Cada lectura (`select`, `rpc` de lectura, `functions.invoke`) lanza antes de usar `data`:
`assertReadOk(...)` o `if (error) throw error`. `data ?? []` solo es válido **después** de ese
chequeo. Lo verifica `src/app/core/facades/unchecked-reads.guard.spec.ts`: falla si un Facade
desestructura `data` sin `error`, o si de un `Promise.all` usa `.data` sin mirar `.error`.

**Varias consultas que forman un mismo total, tabla o KPI** (un `Promise.all`): basta que una falle
para que la carga completa cuente como fallida. Nunca se muestra un total armado con una parte de
los datos.

### Regla 2 — Dos casos de falla, con resultado distinto

| Caso | Cuándo | Qué pasa con lo visible | Qué ve el usuario |
|---|---|---|---|
| **A** | Primera carga, o **cambio de consulta** (filtro, período, sede, semana, `:id`) | Se retira: los datos de la consulta anterior no corresponden a la nueva | Estado de error con "Reintentar" en el lugar de la lista **y** de los KPIs |
| **B** | **Refresco de la misma consulta** (re-entrada SWR, Realtime, después de guardar) | Se mantiene | Los datos, más un aviso de que no se pudieron actualizar, con "Reintentar" |

El criterio para elegir el caso es una pregunta: **¿lo que está en pantalla responde a la misma
pregunta que la consulta que falló?** Si sí, es B (pueden estar viejos, pero son de lo que se
pidió). Si no, es A (mostrarlos sería contestar otra pregunta).

En el caso B, **una acción que guarda un valor calculado con esos datos queda bloqueada** hasta que
una carga termine bien: cerrar la caja del día con totales viejos es el ejemplo de lo que se evita.
El resto de las escrituras sigue disponible: la BD las valida.

### Regla 3 — Una carga que termina bien borra el error

`reintentar()` y el cambio de consulta limpian `_error` al **empezar**; una carga exitosa limpia
`_error` y `_refreshFailed` al **terminar**. Con el guard de orden (`createRequestGuard`, ver
`facades.md`), el error solo se aplica si la respuesta sigue siendo la vigente.

### En la pantalla

- `@if` nativo, sin componentes nuevos: `app-empty-state` con "Reintentar" para el caso A (dentro
  de la celda `.bento-fill`, centrado), `app-alert-card` para el caso B.
- Con la carga fallida los KPIs **no se renderizan en 0**: el estado de error los reemplaza.
- El botón "Reintentar" lleva `data-llm-action`.
- Lo verifica el bloque X01 de `e2e/transversal-shell.spec.ts`: corta la red y exige "Reintentar"
  en cada pantalla. Es la única red que ve un error que el Facade sí captura pero la pantalla no
  muestra.

### `_refreshFailed` solo donde se usa

El signal del caso B se agrega cuando la pantalla lo necesita: para mostrar el aviso o para
bloquear una acción. Un Facade cuyos datos no alimentan ninguna decisión puede dejar el refresco
fallido sin rastro, **siempre que** el `catch` diga en un comentario por qué no avisa.

### 5. Post-action refresh (scheduling, canceling, etc.)

Después de una mutación (INSERT/UPDATE/DELETE), usar refresh silencioso, NO `loadX()` con skeleton:

```typescript
async crearRegistro(payload: Payload): Promise<boolean> {
  // ... insert en BD ...
  await this.refreshSilently(); // ← sin skeleton
  return true;
}
```

## Integración con Realtime

Para recursos compartidos (agenda, notificaciones), combinar SWR con Supabase Realtime:

### Suscripción

```typescript
private realtimeChannel: RealtimeChannel | null = null;

private subscribeRealtime(): void {
  this.disposeRealtime();
  this.realtimeChannel = this.supabase.client
    .channel('nombre-canal')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tabla_base' },
      () => this.refreshSilently(),
    )
    .subscribe();
}
```

### Dispose

```typescript
dispose(): void {
  this.disposeRealtime();
}

private disposeRealtime(): void {
  if (this.realtimeChannel) {
    this.supabase.client.removeChannel(this.realtimeChannel);
    this.realtimeChannel = null;
  }
}
```

### Lifecycle en Smart Components

El Smart component controla el ciclo de vida del Realtime:

```typescript
export class MiPageComponent implements OnInit {
  private readonly facade = inject(MiFacade);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.facade.initialize();
    this.destroyRef.onDestroy(() => this.facade.dispose());
  }
}
```

## Limitaciones Supabase Realtime

- **Solo tablas base** — las VIEWs (`v_*`) NO disparan eventos Realtime.
- **Filtros limitados** — solo `eq`, no rangos (`gte`, `lt`). Para filtrar por rango de fechas, escuchar todos los eventos y refrescar incondicionalmente.
- **Idempotencia** — `subscribeRealtime()` siempre llama `disposeRealtime()` primero para evitar canales duplicados.

## Prohibiciones

- **NUNCA** mostrar skeleton si `_data()` ya tiene valor (SWR activo).
- **NUNCA** leer `data` de una respuesta de Supabase sin revisar `error` (Regla 1).
- **NUNCA** un `catch {}` vacío en un refresco sin un comentario que diga por qué la pantalla no
  necesita saberlo.
- **NUNCA** usar `setInterval`/polling — Supabase Realtime existe para esto.
- **NUNCA** suscribir Realtime sin su correspondiente `dispose()` en el ciclo de vida.
- **NUNCA** suscribir Realtime a VIEWs de Supabase — usar la tabla base subyacente.
