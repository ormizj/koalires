import { useAuthStore } from '~/shared/stores';

export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['ofetch'],
  async setup() {
    const authStore = useAuthStore();
    await authStore._init();
  },
});
