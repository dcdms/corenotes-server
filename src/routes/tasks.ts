import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, ilike } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { ulid } from 'ulid'
import { z } from 'zod'
import { TASK_AVAILABLE_COLORS } from '@/constants/task-available-colors'
import { db } from '@/db/connection'
import { tasks as _tasks } from '@/db/schema'
import { auth, type MiddlewareVariables } from '@/middlewares/auth'

const tasks = new Hono<{ Variables: MiddlewareVariables }>()

tasks.use('/tasks/*', auth)

tasks.get(
  '/tasks',
  describeRoute({
    summary: 'List tasks',
    operationId: 'list_tasks',
    tags: ['tasks'],
    responses: {
      200: {
        description: 'Successful Response',
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                tasks: z.array(
                  z.object({
                    id: z.string(),
                    title: z.string(),
                    description: z.string(),
                    color: z.enum(TASK_AVAILABLE_COLORS),
                    favorite: z.boolean(),
                  }),
                ),
              }),
            ),
          },
        },
      },
    },
  }),
  zValidator('query', z.object({ search: z.string().optional() })),
  async (c) => {
    const { search } = c.req.valid('query')
    const { user } = c.var

    const list = await db
      .select({
        id: _tasks.id,
        title: _tasks.title,
        description: _tasks.description,
        color: _tasks.color,
        favorite: _tasks.favorite,
      })
      .from(_tasks)
      .where(
        and(
          eq(_tasks.user_id, user),
          search ? ilike(_tasks.title, '%' + search + '%') : undefined,
        ),
      )
      .orderBy(desc(_tasks.id))

    return c.json({ tasks: list })
  },
)

tasks.post(
  '/tasks',
  describeRoute({
    summary: 'Create task',
    operationId: 'create_task',
    tags: ['tasks'],
    responses: {
      201: {
        description: 'Successful Response',
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                id: z.string().ulid(),
                color: z.enum(TASK_AVAILABLE_COLORS),
              }),
            ),
          },
        },
      },
    },
  }),
  zValidator(
    'json',
    z.object({
      title: z.string(),
      description: z.string(),
      favorite: z.boolean(),
    }),
  ),
  async (c) => {
    const { title, description, favorite } = c.req.valid('json')
    const { user } = c.var

    if (!user) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const id = ulid()

    const color =
      // biome-ignore lint/style/noNonNullAssertion: this code always hits a color
      TASK_AVAILABLE_COLORS[
        Math.round(Math.random() * (TASK_AVAILABLE_COLORS.length - 1))
      ]!

    await db
      .insert(_tasks)
      .values({ id, user_id: user, title, description, color, favorite })

    return c.json({ id, color }, 201)
  },
)

tasks.patch(
  '/tasks/:id',
  describeRoute({
    summary: 'Edit task',
    operationId: 'edit_task',
    tags: ['tasks'],
    responses: {
      204: { description: 'Successful Response' },
      404: {
        description: '404 Response',
        content: {
          'application/json': {
            schema: resolver(z.object({ error: z.literal('task_not_found') })),
          },
        },
      },
    },
  }),
  zValidator('param', z.object({ id: z.string().ulid() })),
  zValidator(
    'json',
    z
      .object({
        title: z.string(),
        description: z.string(),
        color: z.enum(TASK_AVAILABLE_COLORS),
        favorite: z.boolean(),
      })
      .partial(),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const { title, description, color, favorite } = c.req.valid('json')
    const { user } = c.var

    const [task] = await db
      .select()
      .from(_tasks)
      .where(and(eq(_tasks.id, id), eq(_tasks.user_id, user)))

    if (!task) {
      return c.json({ error: 'task_not_found' }, 404)
    }

    await db
      .update(_tasks)
      .set({ title, description, color, favorite })
      .where(eq(_tasks.id, id))

    return c.body(null, 204)
  },
)

tasks.delete(
  '/tasks/:id',
  describeRoute({
    summary: 'Delete task',
    operationId: 'delete_task',
    tags: ['tasks'],
    responses: {
      204: { description: 'Successful Response' },
      404: {
        description: '404 Response',
        content: {
          'application/json': {
            schema: resolver(z.object({ error: z.literal('task_not_found') })),
          },
        },
      },
    },
  }),
  zValidator('param', z.object({ id: z.string().ulid() })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { user } = c.var

    const [task] = await db
      .select()
      .from(_tasks)
      .where(and(eq(_tasks.id, id), eq(_tasks.user_id, user)))

    if (!task) {
      return c.json({ error: 'task_not_found' }, 404)
    }

    await db.delete(_tasks).where(eq(_tasks.id, id))

    return c.body(null, 204)
  },
)

export { tasks }
