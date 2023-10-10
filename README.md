# fastify-orama

![Continuous Integration](https://github.com/mateonunez/fastify-orama/workflows/ci/badge.svg)

[Orama](https://oramasearch.com/) plugin for Fastify.

## Installation

```
npm install fastify-orama
```

****


## Usage

This plugin adds the `orama` decorator to your Fastify application.
The decorator exposes all the methods that [the Orama class exposes](https://docs.oramasearch.com/usage/create).

The `options` object is passed directly to the `Orama.create` constructor,
so it supports [all the options that Orama supports](https://docs.oramasearch.com/usage/create).

### Example

```js
import Fastify from 'fastify'
import fastifyOrama from 'fastify-orama'

const app = Fastify()

app.register(fastifyOrama, {
  schema: {
    quote: "string",
    author: "string"
  }
})

app.get('/quotes/:query', async function handler (req, reply) {
  const { params: { query } } = req

  const search = await app.orama.search({
    term: query,
    properties: ["quote"]
  })

  return { quotes: search.hits }
})

app.listen({ port: 3000 })
```


## Usage with data persistence

This plugin supports data persistence out of the box.
You need to pass the `persistence` option to the plugin registration!

This plugin uses [`@oramasearch/plugin-data-persistence`](https://docs.oramasearch.com/plugins/plugin-data-persistence)
under the hood to allow users to `load` or `persist` database instances.

Turning on the `persistence` option will add the `fastify.orama.persist()` method to your Fastify application.
You must call this method to save the database instance to the persistence layer, otherwise your data will be lost.

### PersistenceInFile

This plugin comes with a `PersistenceInFile` class that allows you to persist your data in a file.
If the file exists, the plugin will load the data from it when the plugin is registered.

Its constructor accepts the following options:

- `filePath`: The path to the file where the data will be persisted. Default: `./orama.msp`
- `format`: The format of the file where the data will be persisted. Default: `binary`
- `mustExistOnStart`: Whether the file must exist when the plugin is registered or not. Default: `false`. Note that if the file does not exist, you must specify the `schema` option in the plugin registration.


```js
import Fastify from 'fastify'
import { fastifyOrama, PersistenceInFile } from 'fastify-orama'

const app = Fastify()

// The database must exists to load it in your Fastify application
app.register(fastifyOrama, {
  schema: {
    quote: "string",
    author: "string"
  },
  persistence: new PersistenceInFile({
    filePath: './db.json', // Default: './orama.msp'
    format: 'json', // Default: 'binary',
    mustExistOnStart: true // Default: false
  })
})

app.post('/quotes', async function (req, reply) {
  const { body: { author, quote } } = req

  await fastify.orama.insert({
    author,
    quote
  })

  return { success: true }
})

app.addHook('onClose', async function persist (app) {
  const path = await app.orama.persist()
  app.log.info(`Database saved to ${path}`)
})

app.listen({ port: 3000 })
```

### PersistenceInMemory

This plugin comes with a `PersistenceInMemory` class that allows you to persist your data in memory.
This adapter may be useful for testing purposes, when you need to share the same database instance between multiple tests.

Its constructor accepts the following options:

- `jsonIndex`: The stringified JSON representation of the database instance. Default: `null`

```js
import Fastify from 'fastify'
import { fastifyOrama, PersistenceInMemory } from 'fastify-orama'

const appOne = Fastify()

await appOne.register(fastifyOrama, {
  schema: { author: 'string', quote: 'string' },
  persistence: new PersistenceInMemory()
})

// Do some stuff with the database
await appOne.orama.insert({
  quote: 'Orama and Fastify are awesome together.',
  author: 'Mateo Nunez'
})

const inMemoryDb = await appOne.orama.persist()

// Close the Fastify application
await appOne.close()


// Create a new Fastify test case
const appTwo = Fastify()
await appTwo.register(fastifyOrama, {
  persistence: new PersistenceInMemory({
    jsonIndex: inMemoryDb // Pass the in-memory database to the new Fastify application
  })
})

// The database is persisted between Fastify applications
const results = await appTwo.orama.search({ term: 'Mateo Nunez' })
```

### Custom persistence

If you need a custom persistence layer, you can implement your own persistence class.
To do so, you need to implement the following methods:

```js
const customPersistance = {
  restore: async function restore () {
    // Restore the database instance from the persistence layer
    // Return the database instance or null if it does not exist
  },

  persist: async function persist (db) {
    // Persist the database instance to the persistence layer
    // Whatever this method returns will be passed to the `app.orama.persist()` method
}

await fastify.register(fastifyOrama, {
  schema,
  persistence: customPersistance
})
```

## Orama Internals

Do you need to access the [Orama internals utilities](https://docs.oramasearch.com/internals/utilities)?
No problem!

```js
import { fastifyOrama, oramaInternals } from 'fastify-orama'

const app = Fastify()

// The database must exists to load it in your Fastify application
app.register(fastifyOrama, {
  schema: {
    quote: "string",
    author: "string"
  }
})

app.get('/genId', async function handler (req, reply) {
  return { newId: await oramaInternals.uniqueId() }
})
```

## Typescript

This plugin comes with Typescript support out of the box.
Using the `withOrama` helper, you can access the `orama` decorator in your Fastify application with the correct schema.

```ts
import Fastify from 'fastify'

import { PersistenceInMemory, fastifyOrama } from 'fastify-orama'

const app = Fastify()

const mySchema = {
  quote: 'string',
  author: 'string'
} as const

await app.register(fastifyOrama, {
  schema: mySchema,
  persistence: new PersistenceInMemory()
})

const appWithOrama = app.withOrama<typeof mySchema>()
const id = await appWithOrama.orama.insert({ quote: 'Hello', author: 'World' })

appWithOrama.get('/hello', async () => {

  const {orama} = appWithOrama
  const result = await orama.search({ term: 'hello' })

  return {
    hello: result.hits
  }
})
```

Usage with `fastify-plugin`:

```ts
import fp from 'fastify-plugin'

fp(function plugins(fastify) {
  const fastifyWithOrama = fastify.withOrama<typeof mySchema>()

  expectType<{
    insert: (document: PartialSchemaDeep<TypedDocument<Orama<typeof mySchema>>>) => Promise<string>,
    search: (params: SearchParams<Orama<Schema<typeof mySchema>>, typeof mySchema>) => Promise<Results<Schema<typeof mySchema>>>,
    persist?: () => Promise<any>,
  }>(fastifyWithOrama.orama)
})
```

## License

fastifyOrama is licensed under the [MIT](LICENSE) license.
