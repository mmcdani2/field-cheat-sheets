import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        hvac: resolve(__dirname, 'hvac.html'),
        sprayFoam: resolve(__dirname, 'spray-foam.html'),
        refrigerantLog: resolve(__dirname, 'partials/hvac/refrigerant-log.html')
      }
    }
  }
})