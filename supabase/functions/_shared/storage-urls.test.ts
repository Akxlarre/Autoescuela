// supabase/functions/_shared/storage-urls.test.ts
//
// Ejecutar:
//   npx --yes deno test --no-lock --node-modules-dir=none supabase/functions/_shared/storage-urls.test.ts

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { publicStorageUrl } from './storage-urls.ts';

Deno.test('arma la URL pública desde SUPABASE_URL', () => {
  assertEquals(
    publicStorageUrl('assets', 'chillan_capacita.png', 'https://abc.supabase.co'),
    'https://abc.supabase.co/storage/v1/object/public/assets/chillan_capacita.png',
  );
});

Deno.test('tolera una barra final en la URL del proyecto', () => {
  assertEquals(
    publicStorageUrl('assets', 'logo.png', 'https://abc.supabase.co/'),
    'https://abc.supabase.co/storage/v1/object/public/assets/logo.png',
  );
});

Deno.test('sin URL del proyecto falla en vez de armar una URL rota', () => {
  assertThrows(() => publicStorageUrl('assets', 'logo.png', ''));
});
