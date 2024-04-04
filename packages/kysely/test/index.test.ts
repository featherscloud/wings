import { describe, it, before } from 'node:test'
import assert from 'assert'
import { adapterTests, Person } from '@wingshq/adapter-tests'
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { KyselyAdapter } from '../src'

const dialect = new SqliteDialect({
  database: new SQLite(':memory:')
})

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
})
