<script setup lang="ts">
import { useAuth } from '~/features/auth'
import { AppHeader } from '~/widgets/app-header'

const { isAuthenticated } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-surface-secondary">
    <AppHeader v-if="isAuthenticated" />
    <main :class="{ 'pt-14': isAuthenticated }">
      <slot />
    </main>
  </div>
</template>
