import { describe, it, beforeAll as before, afterAll as after } from 'vitest'
import assert from 'assert'
import { adapterTests, Person } from '@wingshq/adapter-tests'
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { KyselyAdapter } from '../src'

const database = new SQLite(':memory:')

// Enable case-sensitive like to behave like Postgres
database.exec('PRAGMA case_sensitive_like=ON;')

const dialect = new SqliteDialect({ database })

const testSuite = adapterTests([
  // '.id',
  // '.options',
  // '.get',
  // '.get + $select',
  // '.get + id + query',
  // '.get + NotFound',
  // '.get + id + query id',
  // '.find',
  // '.find + paginate + query',
  // '.find + $and',
  // '.find + $and + $or',
  // '.remove',
  // '.remove + $select',
  // '.remove + id + query',
  // '.remove + multi',
  // '.remove + multi no pagination',
  // '.remove + id + query id',
  // '.update',
  // '.update + $select',
  // '.update + id + query',
  // '.update + NotFound',
  // '.update + id + query id',
  // '.update + query + NotFound',
  // '.patch',
  // '.patch + $select',
  // '.patch + id + query',
  // '.patch multiple',
  // '.patch multiple no pagination',
  // '.patch multi query same',
  // '.patch multi query changed',
  // '.patch + query + NotFound',
  // '.patch + NotFound',
  // '.patch + id + query id',
  // '.create',
  // '.create ignores query',
  // '.create + $select',
  // '.create multi',
  // '.find + equal',
  // '.find + equal multiple',
  // '.find + $sort',
  // '.find + $limit',
  // '.find + $limit 0',
  // '.find + $skip',
  // '.find + $select',
  // '.find + $or',
  // '.find + $in',
  // '.find + $nin',
  // '.find + $lt',
  // '.find + $lte',
  // '.find + $gt',
  // '.find + $gte',
  // '.find + $ne',
  // '.find + $gt + $lt + $sort',
  // '.find + $or nested + $sort',
  // '.find + paginate',
  // '.find + paginate + $limit + $skip',
  // '.find + paginate + $limit 0',
  // '.find + paginate + params'
])

interface Tables {
  people: Person
}

const db = new Kysely<Tables>({ dialect })

const peopleAdapter = new KyselyAdapter<Tables, Person>({
  Model: db,
  name: 'people',
  id: 'id',
  dialectType: 'sqlite'
})

describe('Wings kysely Adapter', () => {
  before(async () => {
    await db.schema
      .createTable('people')
      .addColumn('id', 'integer', (col) => col.primaryKey())
      .addColumn('name', 'varchar', (col) => col.notNull())
      .addColumn('age', 'integer')
      .addColumn('created', 'boolean')
      .execute()
  })

  it('instantiated the adapter', async () => {
    assert.ok(peopleAdapter)
  })

  testSuite(peopleAdapter, 'id')

  describe('extended operators', () => {
    let bob: Person
    let alice: Person
    let doug: Person

    before(async () => {
      alice = await peopleAdapter.create({ name: 'Alice' })
      bob = await peopleAdapter.create({ name: 'Bob', age: 25 })
      doug = await peopleAdapter.create({ name: 'Doug', age: 35 })
    })

    after(async () => {
      await peopleAdapter.remove(alice.id)
      await peopleAdapter.remove(bob.id)
      await peopleAdapter.remove(doug.id)
    })

    it('supports $is null', async () => {
      const data = await peopleAdapter.find({
        query: {
          age: {
            $is: null
          }
        }
      })

      assert.strictEqual(data.length, 1)
    })

    it('supports $isnot null', async () => {
      const data = await peopleAdapter.find({
        query: {
          age: {
            $isnot: null
          }
        }
      })

      assert.strictEqual(data.length, 2)
    })

    describe('$like', () => {
      it('$like returns case-sensitive match, starting with text', async () => {
        const data = await peopleAdapter.find({
          query: {
            name: { $like: 'Al%' }
          }
        })

        assert.strictEqual(data.length, 1)
        assert.strictEqual(data[0].name, 'Alice')
      })

      it('$like returns case-sensitive match, ending with text', async () => {
        const data = await peopleAdapter.find({
          query: {
            name: { $like: '%ce' }
          }
        })

        assert.strictEqual(data.length, 1)
        assert.strictEqual(data[0].name, 'Alice')
      })

      it('$like returns case-sensitive match, containing text', async () => {
        const data = await peopleAdapter.find({
          query: {
            name: { $like: '%li%' }
          }
        })

        assert.strictEqual(data.length, 1)
        assert.strictEqual(data[0].name, 'Alice')
      })

      it('$like does not match against different casing, starting with text', async () => {
        const data = await peopleAdapter.find({
          query: {
            name: { $like: 'al%' }
          }
        })

        assert.strictEqual(data.length, 0)
      })

      it('$like does not match against different casing, ending with text', async () => {
        const data = await peopleAdapter.find({
          query: {
            name: { $like: '%CE' }
          }
        })

        assert.strictEqual(data.length, 0)
      })

      it('$like does not matching against different casing, containing text', async () => {
        const data = await peopleAdapter.find({
          query: {
            name: { $like: '%LI%' }
          }
        })

        assert.strictEqual(data.length, 0)
      })
    })

    it('$notlike returns case-sensitive non-matches, starting with', async () => {
      const data = await peopleAdapter.find({
        query: {
          name: { $notlike: 'al%' }
        }
      })

      assert.strictEqual(data.length, 3)
    })

    it('$notlike does not return case-insensitive matches', async () => {
      const data = await peopleAdapter.find({
        query: {
          name: { $notlike: 'Al%' }
        }
      })

      assert.strictEqual(data.length, 2)
    })

    it('supports $not')
  })
})
