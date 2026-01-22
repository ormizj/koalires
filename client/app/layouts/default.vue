<script setup lang="ts">
import { useAuth } from '~/features/auth';
import { AppHeader } from '~/widgets/app-header';

const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="min-h-screen bg-surface-secondary flex flex-col">
    <AppHeader v-if="isAuthenticated" />
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
