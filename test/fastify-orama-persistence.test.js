import { describe, it } from 'node:test'
import { strictEqual, match } from 'node:assert'
import Fastify from 'fastify'
import { FastifyOrama, PersistenceInMemory, PersistenceInFile } from '../index.js'
import { create, insert } from '@orama/orama'
import { persistToFile } from '@orama/plugin-data-persistence/server'

async function buildFakeDb (filePath, format) {
  const db = await create({
    schema: {
      author: 'string',
      quote: 'string'
    }
  })

  await insert(db, {
    author: 'Mateo Nunez',
    quote: 'Hi there! This is fastify-orama plugin.'
  })

  await persistToFile(db, format, filePath)

  return {
    filePath,
    format
  }
}

describe('PersistenceInFile', () => {
  it('Should load Orama database from file (binary)', async () => {
    const opts = await buildFakeDb(`./orama_${Date.now()}.msp`, 'binary')

    const fastify = Fastify()
    await fastify.register(FastifyOrama, {
      persistence: new PersistenceInFile(opts)
    })

    await fastify.ready()

    const results = await fastify.orama.search({ term: 'fastify-orama' })
    strictEqual(results.count, 1)

    const { document } = results.hits[Object.keys(results.hits)[0]]
    strictEqual(document.author, 'Mateo Nunez')
  })

  it('Should load Orama database from file (json)', async () => {
    const opts = await buildFakeDb(`./orama_${Date.now()}.json`, 'json')

    const fastify = Fastify()
    await fastify.register(FastifyOrama, {
      persistence: new PersistenceInFile(opts)
    })

    await fastify.ready()

    const results = await fastify.orama.search({ term: 'fastify-orama' })
    strictEqual(results.count, 1)

    const { document } = results.hits[Object.keys(results.hits)[0]]
    strictEqual(document.author, 'Mateo Nunez')
  })

  it('Should save correctly the new database on filesystem when it is created for the first time', async () => {
    const opts = {
      filePath: 'can-save.msp',
      format: 'binary'
    }

    const fastify = Fastify()
    await fastify.register(FastifyOrama, {
      schema: { author: 'string', quote: 'string' },
      persistence: new PersistenceInFile(opts)
    })

    await fastify.ready()

    {
      const results = await fastify.orama.search({ term: 'Mateo Nunez' })
      strictEqual(results.count, 0)
    }

    await fastify.orama.insert({
      quote: 'Orama and Fastify are awesome together.',
      author: 'Mateo Nunez'
    })

    const path = await fastify.orama.save()
    strictEqual(path, opts.filePath)

    {
      const results = await fastify.orama.search({ term: 'Mateo Nunez' })
      strictEqual(results.count, 1)
    }
  })

  it('Should reject when the database file is missing and there is no schema', async () => {
    try {
      const fastify = Fastify()
      await fastify.register(FastifyOrama, {
        persistence: new PersistenceInFile({ filePath: `${Date.now()}.msp` })
      })
    } catch (error) {
      strictEqual(error.message, 'You must provide a schema to create a new database')
    }
  })

  it('Should reject when the database is missing and it is mandatory', async () => {
    try {
      const fastify = Fastify()
      await fastify.register(FastifyOrama, {
        schema: { author: 'string', quote: 'string' },
        persistence: new PersistenceInFile({
          filePath: `${Date.now()}.msp`,
          mustExistOnStart: true
        })
      })
    } catch (error) {
      match(error.message, /^The database file .* does not exist$/)
    }
  })

  it('Should load the default db name', async () => {
    await buildFakeDb('./orama.msp', 'binary')
    const fastify = Fastify()
    await fastify.register(FastifyOrama, {
      persistence: new PersistenceInFile({
        mustExistOnStart: true
      })
    })

    await fastify.ready()

    const results = await fastify.orama.search({ term: 'fastify-orama' })
    strictEqual(results.count, 1)
  })
})

describe('PersistenceInMemory', () => {
  it('Should load Orama database from memory', async () => {
    const fastify = Fastify()
    await fastify.register(FastifyOrama, {
      schema: { author: 'string', quote: 'string' },
      persistence: new PersistenceInMemory()
    })

    await fastify.ready()

    {
      const results = await fastify.orama.search({ term: 'Mateo Nunez' })
      strictEqual(results.count, 0)
    }

    await fastify.orama.insert({
      quote: 'Orama and Fastify are awesome together.',
      author: 'Mateo Nunez'
    })

    const inMemoryDb = await fastify.orama.save()

    {
      const results = await fastify.orama.search({ term: 'Mateo Nunez' })
      strictEqual(results.count, 1)
    }

    await fastify.close()

    const fastifyTwo = Fastify()
    await fastifyTwo.register(FastifyOrama, {
      persistence: new PersistenceInMemory({
        jsonIndex: inMemoryDb
      })
    })

    await fastifyTwo.ready()

    {
      const results = await fastifyTwo.orama.search({ term: 'Mateo Nunez' })
      strictEqual(results.count, 1)
    }
  })
})
