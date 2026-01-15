export function useTheme() {
  const isDark = useState('theme-dark', () => {
    if (import.meta.client) {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  function toggle() {
    isDark.value = !isDark.value
    if (import.meta.client) {
      if (isDark.value) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    }
  }

  onMounted(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })

  return {
    isDark: readonly(isDark),
    toggle
  }
}
