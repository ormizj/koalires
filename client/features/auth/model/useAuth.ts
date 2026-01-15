import { useUser } from '~/entities/user'
import { authApi } from '../api/authApi'

export function useAuth() {
  const router = useRouter()
  const { user, token, isAuthenticated, setUser, setToken, initFromStorage, clearUser, fetchUser } = useUser()

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password)
    setToken(response.token)
    setUser(response.user)
  }

  async function register(email: string, password: string) {
    const response = await authApi.register(email, password)
    setToken(response.token)
    setUser(response.user)
  }

  function logout() {
    clearUser()
    router.push('/login')
  }

  return {
    user,
    token,
    isAuthenticated,
    initFromStorage,
    login,
    register,
    logout,
    fetchUser
  }
}
