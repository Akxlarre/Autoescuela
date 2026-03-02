---
name: angular-signals
description: >
  Implementar estado reactivo con Signals en Angular v20+.
  Activar cuando se pida manejo de estado, convertir BehaviorSubject/Observable a signals,
  crear estado derivado con computed(), linked state con linkedSignal(), o efectos con effect().
  También activar para patrones RxJS interop (toSignal, toObservable).
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Angular Signals — Estado Reactivo v20+

## Core APIs

```typescript
import { signal, computed, linkedSignal, effect, untracked } from '@angular/core';

// Writable state
const count = signal(0);
count.set(5);
count.update(c => c + 1);

// Derived (readonly) — auto-actualiza cuando dependencias cambian
const doubled = computed(() => count() * 2);

// Linked state — resetea cuando source cambia
const options = signal(['A', 'B', 'C']);
const selected = linkedSignal(() => options()[0]);

// Effects — side effects reactivos
effect(() => {
  console.log('Count changed:', count());
});
```

## Patrón en Componente

```typescript
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
export class TodoList {
  todos = signal<Todo[]>([]);
  filter = signal<'all' | 'active' | 'done'>('all');
  newTodo = signal('');

  filteredTodos = computed(() => {
    const todos = this.todos();
    switch (this.filter()) {
      case 'active': return todos.filter(t => !t.done);
      case 'done':   return todos.filter(t => t.done);
      default:       return todos;
    }
  });

  remaining = computed(() => this.todos().filter(t => !t.done).length);

  addTodo() {
    const text = this.newTodo().trim();
    if (text) {
      this.todos.update(list => [...list, { id: crypto.randomUUID(), text, done: false }]);
      this.newTodo.set('');
    }
  }
}
```

## Patrón en Servicio (Facade)

```typescript
@Injectable({ providedIn: 'root' })
export class AuthFacade {
  // Estado privado escribible
  private _user = signal<User | null>(null);
  private _loading = signal(false);

  // Exposición pública de solo lectura
  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  async login(credentials: Credentials): Promise<void> {
    this._loading.set(true);
    try {
      const user = await firstValueFrom(this.http.post<User>('/api/login', credentials));
      this._user.set(user);
    } finally {
      this._loading.set(false);
    }
  }
}
```

## RxJS Interop

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// Observable → Signal (en constructor o injection context)
users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });

// BehaviorSubject → Signal (requireSync para valores sincrónicos)
private user$ = new BehaviorSubject<User | null>(null);
currentUser = toSignal(this.user$, { requireSync: true });

// Signal → Observable (para usar operadores RxJS)
results = toSignal(
  toObservable(this.query).pipe(
    debounceTime(300),
    switchMap(q => this.http.get<Result[]>(`/api/search?q=${q}`))
  ),
  { initialValue: [] }
);
```

## linkedSignal avanzado

```typescript
// Preservar selección cuando la lista cambia
const selectedItem = linkedSignal<Item[], Item | null>({
  source: () => items(),
  computation: (newItems, previous) => {
    const prevItem = previous?.value;
    if (prevItem && newItems.some(i => i.id === prevItem.id)) {
      return prevItem;
    }
    return newItems[0] ?? null;
  },
});
```

## Untracked reads

```typescript
// Solo depende de 'a', no de 'b'
const result = computed(() => {
  const aVal = a();
  const bVal = untracked(() => b());
  return aVal + bVal;
});
```

Ver patrones avanzados en `references/signal-patterns.md`.
