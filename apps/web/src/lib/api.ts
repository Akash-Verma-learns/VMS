import axios from "axios"
import { useAuthStore } from "../store/auth"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001" })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // A 401 here means the session ended, not that the user did anything
      // wrong. Dropping them on a blank sign-in screen makes an expiry
      // indistinguishable from a crash, and silently discards the page they
      // were on. Record both, so the sign-in screen can say what happened and
      // send them back where they were.
      const here = window.location.pathname + window.location.search
      sessionStorage.setItem("vms:signed-out", "expired")
      if (here !== "/") sessionStorage.setItem("vms:return-to", here)
      useAuthStore.getState().clearAuth()
      window.location.replace("/")
    }
    return Promise.reject(error)
  }
)

export default api

export function formatMoney(paise: number | string): string {
  const rupees = Number(paise) / 100
  return "Rs " + rupees.toLocaleString("en-IN")
}
