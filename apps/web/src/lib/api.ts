import axios from "axios"
import { useAuthStore } from "../store/auth"

const api = axios.create({ baseURL: "http://localhost:3001" })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = "/"
    }
    return Promise.reject(error)
  }
)

export default api

export function formatMoney(paise: number | string): string {
  const rupees = Number(paise) / 100
  return "Rs " + rupees.toLocaleString("en-IN")
}
