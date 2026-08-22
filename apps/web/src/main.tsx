import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "react-hot-toast"
// UX4G ships styles and a runtime. The runtime scans the DOM for ux4g-*
// classes and wires up interactive behaviour, so it must load once here —
// styles alone leave those components inert.
import "ux4g-web-components/design-system"

// The UX4G runtime follows the OS colour preference, which put dark-theme
// components on top of a light Tailwind surface. This product is used in
// brightly-lit exam halls and government offices, so the light theme is a
// deliberate choice rather than a default; pin it after the runtime loads.
document.documentElement.setAttribute("data-theme", "light")
import "./index.css"
import App from "./App"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  </StrictMode>
)
