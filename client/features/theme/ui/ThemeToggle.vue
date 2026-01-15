<script setup lang="ts">
import { useTheme } from '../model/useTheme'

const { isDark, toggle } = useTheme()
const ready = ref(false)

onMounted(() => {
  ready.value = true
})
</script>

<template>
  <button
    @click="toggle"
    class="p-2 rounded-lg hover:bg-surface-secondary transition-colors w-10 h-10 flex items-center justify-center"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <Transition name="icon" mode="out-in">
      <svg
        v-if="!ready"
        key="placeholder"
        class="w-6 h-6"
        viewBox="0 0 24 24"
      />
      <svg
        v-else-if="isDark"
        key="sun"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-6 h-6 text-content"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
        />
      </svg>
      <svg
        v-else
        key="moon"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-6 h-6 text-content"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
        />
      </svg>
    </Transition>
  </button>
</template>

<style scoped>
.icon-enter-active,
.icon-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.8);
}

.icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.8);
}
</style>
