import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'assert'
import { adapterTests, Person } from '@wingshq/adapter-tests'
import knex from 'knex'
import { connection } from './connection'

import { KnexAdapter } from '../src'
import { ERROR } from '../src/error-handler'

const testSuite = adapterTests([
  '.id',
  '.options',
  '.get',
  '.get + $select',
  '.get + id + query',
  '.get + NotFound',
  '.get + id + query id',
  '.find',
  '.find + paginate + query',
  '.find + $and',
  '.find + $and + $or',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.remove + multi no pagination',
  '.remove + id + query id',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.update + id + query id',
  '.update + query + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multiple no pagination',
  '.patch multi query same',
  '.patch multi query changed',
  '.patch + query + NotFound',
  '.patch + NotFound',
  '.patch + id + query id',
  '.create',
  '.create ignores query',
  '.create + $select',
  '.create multi',
  '.find + equal',
  '.find + equal multiple',
  '.find + $sort',
  '.find + $limit',
  '.find + $limit 0',
  '.find + $skip',
  '.find + $select',
  '.find + $or',
  '.find + $in',
  '.find + $nin',
  '.find + $lt',
  '.find + $lte',
  '.find + $gt',
  '.find + $gte',
  '.find + $ne',
  '.find + $gt + $lt + $sort',
  '.find + $or nested + $sort',
  '.find + paginate',
  '.find + paginate + $limit + $skip',
  '.find + paginate + $limit 0',
  '.find + paginate + params'
])

const TYPE = process.env.TEST_DB || 'sqlite'
const db = knex(connection(TYPE) as any)

// Create a public database to mimic a "schema"
const schemaName = 'public'

const people = new KnexAdapter<Person>({
  Model: db,
  name: 'people'
})

const peopleId = new KnexAdapter<Person>({
  Model: db,
  id: 'customid',
  name: 'people-customid'
})

type Todo = {
  id: number
  text: string
  personId: number
  personName: string
}

class TodoAdapter extends KnexAdapter<Todo> {
  createQuery(params: any) {
    const query = super.createQuery(params)

    query.join('people as person', 'todos.personId', 'person.id').select('person.name as personName')

    return query
  }
}

const todos = new TodoAdapter({
  Model: db,
  name: 'todos'
})

const clean = async () => {
  await db.schema.dropTableIfExists('todos')
  await db.schema.dropTableIfExists(people.fullName)
  await db.schema.createTable(people.fullName, (table) => {
    table.increments('id')
    table.string('name').notNullable()
    table.integer('age')
    table.integer('time')
    table.boolean('created')
    return table
  })
  await db.schema.createTable('todos', (table) => {
    table.increments('id')
    table.string('text')
    table.integer('personId')
    return table
  })
  await db.schema.dropTableIfExists(peopleId.fullName)
  await db.schema.createTable(peopleId.fullName, (table) => {
    table.increments('customid')
    table.string('name')
    table.integer('age')
    table.integer('time')
    table.boolean('created')
    return table
  })
}

describe('Wings knex Adapter', () => {
  before(() => {
    if (TYPE === 'sqlite') {
      // Attach the public database to mimic a "schema"
      db.schema.raw(`attach database '${schemaName}.sqlite' as ${schemaName}`)
    }
  })
  before(clean)
  after(async () => {
    await clean()
    await db.destroy()
  })

  it('instantiated the adapter', () => {
    assert.ok(people)
  })

  describe('$like method', () => {
    let charlie: Person

    beforeEach(async () => {
      charlie = await people.create({
        name: 'Charlie Brown',
        age: 10
      })
    })

    afterEach(() => people.remove(charlie.id))

    it('$like in query', async () => {
      const data = await people.find({
        paginate: false,
        query: { name: { $like: '%lie%' } } as any
      })

      assert.strictEqual(data[0].name, 'Charlie Brown')
    })
  })

  describe('$notlike method', () => {
    let hasMatch: Person
    let hasNoMatch: Person

    beforeEach(async () => {
      hasMatch = await people.create({
        name: 'XYZabcZYX'
      })
      hasNoMatch = await people.create({
        name: 'XYZZYX'
      })
    })

    afterEach(() => {
      people.remove(hasMatch.id)
      people.remove(hasNoMatch.id)
    })

    it('$notlike in query', async () => {
      const data = await people.find({
        paginate: false,
        query: { name: { $notlike: '%abc%' } } as any
      })

      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].name, 'XYZZYX')
    })
  })

  describe('adapter specifics', () => {
    let daves: Person[]

    beforeEach(async () => {
      daves = await Promise.all([
        people.create({
          name: 'Ageless',
          age: null
        }),
        people.create({
          name: 'Dave',
          age: 32
        }),
        people.create({
          name: 'Dada',
          age: 1
        })
      ])
    })

    afterEach(async () => {
      try {
        await people.remove(daves[0].id)
        await people.remove(daves[1].id)
        await people.remove(daves[2].id)
      } catch (error: unknown) {}
    })

    it('$or works properly (#120)', async () => {
      const data = await people.find({
        paginate: false,
        query: {
          name: 'Dave',
          $or: [
            {
              age: 1
            },
            {
              age: 32
            }
          ]
        }
      })

      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].name, 'Dave')
      assert.strictEqual(data[0].age, 32)
    })

    it('$and works properly', async () => {
      const data = await people.find({
        paginate: false,
        query: {
          $and: [
            {
              $or: [{ name: 'Dave' }, { name: 'Dada' }]
            },
            {
              age: { $lt: 23 }
            }
          ]
        }
      })

      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].name, 'Dada')
      assert.strictEqual(data[0].age, 1)
    })

    it('where conditions support NULL values properly', async () => {
      const data = await people.find({
        query: {
          age: null
        }
      })

      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].name, 'Ageless')
      assert.strictEqual(data[0].age, null)
    })

    it('where conditions support NOT NULL case properly', async () => {
      const data = await people.find({
        paginate: false,
        query: {
          age: { $ne: null }
        }
      })

      assert.strictEqual(data.length, 2)
      assert.notStrictEqual(data[0].name, 'Ageless')
      assert.notStrictEqual(data[0].age, null)
      assert.notStrictEqual(data[1].name, 'Ageless')
      assert.notStrictEqual(data[1].age, null)
    })

    it('where conditions support NULL values within AND conditions', async () => {
      const data = await people.find({
        paginate: false,
        query: {
          age: null,
          name: 'Ageless'
        }
      })

      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].name, 'Ageless')
      assert.strictEqual(data[0].age, null)
    })

    it('where conditions support NULL values within OR conditions', async () => {
      const data = await people.find({
        paginate: false,
        query: {
          $or: [
            {
              age: null
            },
            {
              name: 'Dada'
            }
          ]
        }
      })

      assert.strictEqual(data.length, 2)
      assert.notStrictEqual(data[0].name, 'Dave')
      assert.notStrictEqual(data[0].age, 32)
      assert.notStrictEqual(data[1].name, 'Dave')
      assert.notStrictEqual(data[1].age, 32)
    })

    it('attaches the SQL error', async () => {
      await assert.rejects(
        () => people.create({}),
        (error: any) => {
          assert.ok(error[ERROR])
          return true
        }
      )
    })

    it('get by id works with `createQuery` as params.knex', async () => {
      const knex = people.createQuery()
      const dave = await people.get(daves[0].id, { knex })

      assert.deepStrictEqual(dave, daves[0])
    })
  })

  describe('associations', () => {
    it('create, query and get with associations, can unambigiously $select', async () => {
      const dave = await people.create({
        name: 'Dave',
        age: 133
      })
      const todo = await todos.create({
        text: 'Do dishes',
        personId: dave.id
      })

      const [found] = await todos.find({
        paginate: false,
        query: {
          'person.age': { $gt: 100 }
        } as any
      })
      const got = await todos.get(todo.id)

      assert.deepStrictEqual(
        await todos.get(todo.id, {
          query: { $select: ['id', 'text'] }
        }),
        {
          id: todo.id,
          text: todo.text,
          personName: 'Dave'
        }
      )
      assert.strictEqual(got.personName, dave.name)
      assert.deepStrictEqual(got, todo)
      assert.deepStrictEqual(found, todo)

      await people.remove(null)
      await todos.remove(null)
    })
  })

  testSuite(people, 'id')
  testSuite(peopleId, 'customid')
})
