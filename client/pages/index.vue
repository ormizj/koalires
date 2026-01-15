<script setup lang="ts">
import { useAuth } from '~/features/auth'

const { isAuthenticated, initFromStorage, fetchUser } = useAuth()
const router = useRouter()

onMounted(async () => {
  initFromStorage()

  if (isAuthenticated.value) {
    await fetchUser()
  }

  if (isAuthenticated.value) {
    router.replace('/files')
  } else {
    router.replace('/login')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-gray-500">Loading...</div>
  </div>
</template>
