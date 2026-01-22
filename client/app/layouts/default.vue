<script setup lang="ts">
import { useAuth } from '~/features/auth';
import { AppHeader } from '~/widgets/app-header';

const { shouldShowHeader } = useAuth();
</script>

<template>
  <div class="min-h-screen bg-surface-secondary flex flex-col">
    <AppHeader v-if="shouldShowHeader" />
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
