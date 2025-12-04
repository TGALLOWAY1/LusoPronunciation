import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import Busboy from 'busboy'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

// Plugin to handle API routes in development
function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/pronunciation-assessment', async (req, res, next) => {
        // Only handle POST requests
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          // Check environment variables early
          if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
            console.error('Missing Azure credentials:')
            console.error('  AZURE_SPEECH_KEY:', process.env.AZURE_SPEECH_KEY ? 'SET' : 'MISSING')
            console.error('  AZURE_SPEECH_REGION:', process.env.AZURE_SPEECH_REGION ? 'SET' : 'MISSING')
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ 
              error: 'Server configuration error',
              message: 'Missing Azure Speech credentials. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables.'
            }))
            return
          }

          // Import the handler dynamically (Node.js only)
          const { handlePronunciationAssessment } = await import('./src/server/routes/pronunciationAssessment')
          
          // Parse multipart/form-data using busboy
          const contentType = req.headers['content-type'] || 'multipart/form-data'
          const formData = new FormData()
          
          await new Promise<void>((resolve, reject) => {
            try {
              const busboy = Busboy({ headers: { 'content-type': contentType } })
              let pendingFiles = 0
              let finished = false
              
              const checkComplete = () => {
                if (finished && pendingFiles === 0) {
                  resolve()
                }
              }
              
              busboy.on('file', (name, file, info) => {
                const { filename, encoding, mimeType } = info
                console.log(`[API Plugin] Received file: ${name}, filename: ${filename}, mimeType: ${mimeType}`)
                pendingFiles++
                const chunks: Buffer[] = []
                
                file.on('data', (chunk: Buffer) => {
                  chunks.push(chunk)
                })
                
                file.on('end', () => {
                  const buffer = Buffer.concat(chunks)
                  console.log(`[API Plugin] File ${name} completed, size: ${buffer.length} bytes`)
                  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' })
                  formData.append(name, blob, filename)
                  pendingFiles--
                  checkComplete()
                })
                
                file.on('error', (err) => {
                  console.error(`[API Plugin] File ${name} error:`, err)
                  pendingFiles--
                  reject(err)
                })
              })
              
              busboy.on('field', (name, value) => {
                console.log(`[API Plugin] Received field: ${name} = ${value}`)
                formData.append(name, value)
              })
              
              busboy.on('finish', () => {
                console.log('[API Plugin] Busboy finished parsing')
                finished = true
                checkComplete()
              })
              
              busboy.on('error', (err) => {
                console.error('[API Plugin] Busboy error:', err)
                reject(err)
              })
              
              req.pipe(busboy)
            } catch (err) {
              console.error('[API Plugin] Error setting up busboy:', err)
              reject(err)
            }
          })
          
          // Log form data fields (check what we have)
          const formDataEntries: string[] = []
          // Note: FormData.keys() might not be available in Node.js, so we'll just log that parsing completed
          console.log('[API Plugin] FormData parsed successfully')

          // Create a Request object with the parsed FormData
          // Don't set Content-Type header - Request will set it automatically with boundary
          const url = new URL(req.url || '/api/pronunciation-assessment', `http://${req.headers.host || 'localhost:3000'}`)
          const headers = new Headers()
          // Copy headers except Content-Type (FormData will set it)
          Object.entries(req.headers).forEach(([key, value]) => {
            if (key.toLowerCase() !== 'content-type' && value) {
              headers.set(key, Array.isArray(value) ? value[0] : value)
            }
          })
          
          console.log('[API Plugin] Creating Request object...')
          const request = new Request(url.toString(), {
            method: req.method || 'POST',
            headers,
            body: formData,
          })

          console.log('[API Plugin] Calling handlePronunciationAssessment...')
          // Call the handler
          const response = await handlePronunciationAssessment(request)
          console.log('[API Plugin] Handler returned, status:', response.status)

          // Send response back to client
          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          
          const responseBody = await response.text()
          
          // Log response in development for debugging
          if (process.env.NODE_ENV !== 'production') {
            try {
              const parsed = JSON.parse(responseBody)
              console.log('[API Plugin] Response body (first 500 chars):', JSON.stringify(parsed).substring(0, 500))
            } catch (e) {
              console.log('[API Plugin] Response body (first 500 chars):', responseBody.substring(0, 500))
            }
          }
          
          res.end(responseBody)
        } catch (error) {
          // Log detailed error information
          console.error('API route error:', error)
          if (error instanceof Error) {
            console.error('Error name:', error.name)
            console.error('Error message:', error.message)
            console.error('Error stack:', error.stack)
          }
          
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          
          // Provide more detailed error message in development
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const isDev = process.env.NODE_ENV !== 'production'
          
          res.end(JSON.stringify({ 
            error: 'Internal server error',
            message: errorMessage,
            ...(isDev && error instanceof Error ? {
              stack: error.stack,
              name: error.name,
            } : {})
          }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
