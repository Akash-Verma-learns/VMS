import axios from "axios"
import { useAuthStore } from "../store/auth"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001" })

api.interceptors.request.use((config) => {
  if (!navigator.onLine) return Promise.reject(new Error("OFFLINE"))
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = "/"
    }
    return Promise.reject(err)
  }
)

export default api

export function formatMoney(paise: number | string | bigint): string {
  const rupees = Number(paise) / 100
  return "Rs " + rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}
