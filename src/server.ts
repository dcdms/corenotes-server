import { serve } from '@hono/node-server'
import { Scalar } from '@scalar/hono-api-reference'
import { Hono } from 'hono'
import { openAPISpecs } from 'hono-openapi'
import { config } from '@/config'
import { auth } from '@/routes/auth'
import { tasks } from '@/routes/tasks'

const app = new Hono()

app.route('/', auth)
app.route('/', tasks)

app.get('/reference', Scalar({ url: '/docs', theme: 'elysiajs' }))

app.get(
  '/docs',
  openAPISpecs(app, {
    documentation: {
      info: {
        title: 'Corenotes REST API',
        description:
          'Modern Hono-based API with passwordless authentication and task management.',
        version: '1.0.0',
      },
    },
  }),
)

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    console.log('server is running on http://localhost:' + info.port)
  },
)
