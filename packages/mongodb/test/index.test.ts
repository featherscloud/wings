import { describe, it, after, before, beforeEach, afterEach } from 'node:test'
import assert from 'assert'
import { MongoClient, ObjectId } from 'mongodb'
import { adapterTests, Person } from '@wingshq/adapter-tests'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { MongodbAdapter } from '../src'

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

describe('Wings mongodb Adapter', () => {
  const mongod = MongoMemoryServer.create()
  const client = mongod.then((server) => MongoClient.connect(server.getUri()))
  const db = client.then((client) => client.db('feathers-test'))
  const peopleAdapter = new MongodbAdapter<Person>({
    id: '_id',
    Model: db.then(async (db) => {
      const collection = db.collection('people')
      await collection.createIndex({ name: 1 }, { partialFilterExpression: { team: 'blue' } })
      return collection
    })
  })
  const peopleCustomAdapter = new MongodbAdapter<Person>({
    id: 'customid',
    Model: db.then((db) => db.collection('people-customid'))
  })

  after(async () => {
    await (await db).dropDatabase()
    await (await client).close()
    await (await mongod).stop()
  })

  it('instantiated the adapter', () => {
    assert.ok(peopleAdapter)
  })

  describe('Service utility functions', () => {
    describe('getObjectId', () => {
      it('returns an ObjectID instance for a valid ID', () => {
        const id = new ObjectId()
        const objectify = peopleAdapter.getObjectId(id.toString())

        assert.ok(objectify instanceof ObjectId)
        assert.strictEqual(objectify.toString(), id.toString())
      })

      it('returns an ObjectID instance for a valid ID', () => {
        const id = 'non-valid object id'
        const objectify = peopleAdapter.getObjectId(id.toString())

        assert.ok(!(objectify instanceof ObjectId))
        assert.strictEqual(objectify, id)
      })
    })
  })

  describe('Special collation param', () => {
    let people: Person[]

    function indexOfName(results: Person[], name: string) {
      let index = 0

      for (const person of results) {
        if (person.name === name) {
          return index
        }
        index++
      }

      return -1
    }

    beforeEach(async () => {
      peopleAdapter.options.disableObjectify = true
      people = await peopleAdapter.create([{ name: 'AAA' }, { name: 'aaa' }, { name: 'ccc' }])
    })

    afterEach(async () => {
      try {
        await Promise.all([
          peopleAdapter.remove(people[0]._id),
          peopleAdapter.remove(people[1]._id),
          peopleAdapter.remove(people[2]._id)
        ])
      } catch (error: unknown) {}
    })

    it('queries for ObjectId in find', async () => {
      const person = await peopleAdapter.create({ name: 'Coerce' })
      const results = await peopleAdapter.find({
        paginate: false,
        query: {
          _id: new ObjectId(person._id)
        }
      })

      assert.strictEqual(results.length, 1)

      await peopleAdapter.remove(person._id)
    })

    it('works with normal string _id', async () => {
      const person = await peopleAdapter.create({
        _id: 'lessonKTDA08',
        name: 'Coerce'
      })
      const result = await peopleAdapter.get(person._id)

      assert.strictEqual(result.name, 'Coerce')

      await peopleAdapter.remove(person._id)
    })

    it('sorts with default behavior without collation param', async () => {
      const results = await peopleAdapter.find({
        paginate: false,
        query: { $sort: { name: -1 } }
      })

      assert.ok(indexOfName(results, 'aaa') < indexOfName(results, 'AAA'))
    })

    it('sorts using collation param if present', async () => {
      const results = await peopleAdapter.find({
        paginate: false,
        query: { $sort: { name: -1 } },
        mongodb: { collation: { locale: 'en', strength: 1 } }
      })

      assert.ok(indexOfName(results, 'aaa') > indexOfName(results, 'AAA'))
    })

    it('removes with default behavior without collation param', async () => {
      await peopleAdapter.remove(null, { query: { name: { $gt: 'AAA' } } })

      const results = await peopleAdapter.find({ paginate: false })

      assert.strictEqual(results.length, 1)
      assert.strictEqual(results[0].name, 'AAA')
    })

    it('removes using collation param if present', async () => {
      const removed = await peopleAdapter.remove(null, {
        query: { name: 'AAA' },
        mongodb: { collation: { locale: 'en', strength: 1 } }
      })
      const results = await peopleAdapter.find({ paginate: false })

      assert.strictEqual(removed.length, 2)
      assert.strictEqual(results[0].name, 'ccc')
      assert.strictEqual(results.length, 1)
    })

    it('handles errors', async () => {
      await assert.rejects(
        () =>
          peopleAdapter.create(
            {
              name: 'Dave'
            },
            {
              mongodb: { collation: { locale: 'fdsfdsfds', strength: 1 } }
            }
          ),
        {
          name: 'GeneralError'
        }
      )
    })

    it('updates with default behavior without collation param', async () => {
      const query = { name: { $gt: 'AAA' } }

      const result = await peopleAdapter.patch(null, { age: 99 }, { query })

      assert.strictEqual(result.length, 2)
      result.forEach((person) => {
        assert.strictEqual(person.age, 99)
      })
    })

    it('updates using collation param if present', async () => {
      const result = await peopleAdapter.patch(
        null,
        { age: 110 },
        {
          query: { name: { $gt: 'AAA' } },
          mongodb: { collation: { locale: 'en', strength: 1 } }
        }
      )

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].name, 'ccc')
    })

    it('pushes to an array using patch', async () => {
      const result = await peopleAdapter.patch(
        null,
        { $push: { friends: 'Adam' } },
        {
          query: { name: { $gt: 'AAA' } }
        }
      )

      assert.strictEqual(result[0].friends?.length, 1)

      const patched = await peopleAdapter.patch(
        null,
        {
          $push: { friends: 'Bell' }
        },
        { query: { name: { $gt: 'AAA' } } }
      )

      assert.strictEqual(patched[0].friends?.length, 2)
    })

    it('overrides default index selection using hint param if present', async () => {
      const indexed = await peopleAdapter.create({
        name: 'Indexed',
        team: 'blue'
      })

      const result = await peopleAdapter.find({
        paginate: false,
        query: {},
        mongodb: { hint: { name: 1 } }
      })

      assert.strictEqual(result[0].name, 'Indexed')
      assert.strictEqual(result.length, 1)

      await peopleAdapter.remove(indexed._id)
    })
  })

  describe('Aggregation', () => {
    let bob: Person
    let alice: Person
    let doug: Person

    type Todo = {
      _id: string
      name: string
      userId: string
      person?: Person
    }

    const todoAdapter = new MongodbAdapter<Todo>({
      id: '_id',
      Model: db.then((db) => db.collection('todos'))
    })

    before(async () => {
      bob = await peopleAdapter.create({ name: 'Bob', age: 25 })
      alice = await peopleAdapter.create({ name: 'Alice', age: 19 })
      doug = await peopleAdapter.create({ name: 'Doug', age: 32 })

      // Create a task for each person
      await todoAdapter.create({ name: 'Bob do dishes', userId: bob._id })
      await todoAdapter.create({ name: 'Bob do laundry', userId: bob._id })
      await todoAdapter.create({ name: 'Alice do dishes', userId: alice._id })
      await todoAdapter.create({ name: 'Doug do dishes', userId: doug._id })
    })

    after(async () => {
      ;(await db).collection('people').deleteMany({})
      ;(await db).collection('todos').deleteMany({})
    })

    it('assumes the feathers stage runs before all if it is not explicitly provided in pipeline', async () => {
      const result = await todoAdapter.find({
        query: { name: /dishes/ as any, $sort: { name: 1 } },
        pipeline: [
          {
            $lookup: {
              from: 'people',
              localField: 'userId',
              foreignField: '_id',
              as: 'person'
            }
          },
          { $unwind: { path: '$person' } }
        ],
        paginate: false
      })
      assert.deepEqual(result[0].person, alice)
      assert.deepEqual(result[1].person, bob)
      assert.deepEqual(result[2].person, doug)
    })

    it('can prepend stages by explicitly placing the feathers stage', async () => {
      const result = await todoAdapter.find({
        query: { $sort: { name: 1 } },
        pipeline: [
          { $match: { name: 'Bob do dishes' } },
          { $feathers: {} },
          {
            $lookup: {
              from: 'people',
              localField: 'userId',
              foreignField: '_id',
              as: 'person'
            }
          },
          { $unwind: { path: '$person' } }
        ],
        paginate: false
      })
      assert.deepEqual(result[0].person, bob)
      assert.equal(result.length, 1)
    })
  })

  testSuite(peopleAdapter, '_id')
  testSuite(peopleCustomAdapter, 'customid')
})
