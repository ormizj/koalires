<script setup lang="ts">
import { useAuth } from '~/features/auth';
import { ThemeToggle } from '~/features/theme';

const { user, logout } = useAuth();
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border shadow-sm z-50"
  >
    <div class="h-full px-4 flex items-center justify-between">
      <span class="text-xl font-semibold text-content">Koalires</span>

      <div class="flex items-center gap-4">
        <ThemeToggle />
        <span class="text-content-secondary">{{ user?.email }}</span>
        <button
          class="px-4 py-2 rounded text-content-secondary hover:text-content hover:bg-surface-secondary transition-colors"
          @click="logout"
        >
          Logout
        </button>
      </div>
    </div>
  </header>
</template>
