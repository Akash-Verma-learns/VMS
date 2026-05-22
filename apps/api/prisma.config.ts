import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: "postgresql://vms_user:vms_local_dev@localhost:5432/upsc_vms_dev",
  },
})