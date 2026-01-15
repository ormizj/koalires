<script setup lang="ts">
import { useTheme } from '../model/useTheme'

const { isDark, toggle } = useTheme()
const hasInitialized = useState('theme-toggle-initialized', () => false)
const shouldAnimate = ref(false)

onMounted(() => {
  if (hasInitialized.value) {
    shouldAnimate.value = true
  }
  else {
    hasInitialized.value = true
  }
})

function handleToggle() {
  shouldAnimate.value = true
  toggle()
}
</script>

<template>
  <button
    class="p-2 rounded-lg hover:bg-surface-secondary transition-colors w-10 h-10 flex items-center justify-center"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="handleToggle"
  >
    <Transition
      v-if="shouldAnimate"
      name="icon"
      mode="out-in"
    >
      <Icon
        v-if="isDark"
        key="sun"
        name="heroicons:sun"
        class="w-6 h-6 text-content"
      />
      <Icon
        v-else
        key="moon"
        name="heroicons:moon"
        class="w-6 h-6 text-content"
      />
    </Transition>
    <template v-else>
      <Icon
        v-if="isDark"
        name="heroicons:sun"
        class="w-6 h-6 text-content"
      />
      <Icon
        v-else
        name="heroicons:moon"
        class="w-6 h-6 text-content"
      />
    </template>
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
