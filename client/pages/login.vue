<script setup lang="ts">
import { LoginForm, useAuth } from '~/features/auth'
import { ThemeToggle } from '~/features/theme'
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-surface-secondary">
    <div class="absolute top-4 right-4">
      <ThemeToggle />
    </div>
    <LoginForm />
  </div>
</template>
