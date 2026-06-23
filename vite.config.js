import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tukar 'ladangalir' kepada nama repo GitHub anda
export default defineConfig({
  plugins: [react()],
  base: '/ladangalir/',
})
