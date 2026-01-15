<script setup lang="ts">
import { useAuth } from '../model/useAuth'

const { register, isAuthenticated, initFromStorage } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

onMounted(() => {
  initFromStorage()
  if (isAuthenticated.value) {
    router.replace('/files')
  }
})

async function handleSubmit() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }

  loading.value = true

  try {
    await register(email.value, password.value)
    router.push('/files')
  } catch (e: any) {
    error.value = e.data?.message || 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md bg-surface rounded-lg shadow-md p-8">
    <h1 class="text-2xl font-semibold text-content text-center mb-8">Create an account</h1>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="error" class="p-3 bg-danger-soft border border-danger-border rounded text-danger text-sm">
        {{ error }}
      </div>

      <div>
        <label for="email" class="block text-sm font-medium text-content-secondary mb-1">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          class="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-content"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-content-secondary mb-1">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          class="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-content"
          placeholder="At least 6 characters"
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-sm font-medium text-content-secondary mb-1">Confirm Password</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          type="password"
          required
          class="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-content"
          placeholder="Confirm your password"
        />
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ loading ? 'Creating account...' : 'Create account' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-content-secondary">
      Already have an account?
      <NuxtLink to="/login" class="text-primary hover:text-primary-hover font-medium">
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>
