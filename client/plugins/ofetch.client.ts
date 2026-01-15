export default defineNuxtPlugin({
  name: 'ofetch',
  setup() {
    const authStore = useAuthStore();

    globalThis.$fetch = $fetch.create({
      onRequest: ({ options }) => {
        const localJwt = authStore.jwt || localStorage.getItem('jwt');
        if (localJwt) {
          const headers = new Headers(options.headers);
          headers.set('Authorization', `Bearer ${localJwt}`);
          options.headers = headers;
        }
      },
    });
  },
});
