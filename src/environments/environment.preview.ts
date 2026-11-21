// Entorno de los previews de Vercel (un deploy por PR). Apunta a la BD de DESARROLLO: un preview
// es público y lo prueba cualquiera, así que nunca debe escribir en producción (fix-505-m).
// Lo usa la configuración `preview` de angular.json; ver vercel.json.
export const environment = {
  production: true,
  supabase: {
    url: 'https://klcwwrwfdqdciffraozq.supabase.co',
    anonKey: 'sb_publishable_DKH5Cv3N09Sc9rXzebLZSQ_VWNaTE4D',
  },
};
