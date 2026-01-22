import { useAuthStore } from '~/shared/stores';

export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['ofetch'],
  setup() {
    const authStore = useAuthStore();
    authStore._initSync();
    void authStore._validateAuth();
  },
});
