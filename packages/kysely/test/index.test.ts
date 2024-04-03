import { describe, it } from 'node:test'
import assert from 'assert'
import { adapterTests, Person } from '@wingshq/adapter-tests'
import { Kysely } from 'kysely'

import { KyselyAdapter } from '../src'

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

interface Person {
  id: number
  name: string
  age: number
}

interface Tables {
  people: Person
}

const db = new Kysely<Tables>({
  client: 'sqlite3',
  connection: {
    filename: ':memory:'
  },
  useNullAsDefault: true
})

console.log(db)

describe('Wings kysely Adapter', () => {
  const peopleAdapter = new KyselyAdapter<Tables, Person>({ Model: db, name: 'people', id: 'id' })

  peopleAdapter.find({ query: { name: { $like: '%foo' } } })

  it('instantiated the adapter', () => {
    assert.ok(peopleAdapter)
  })

  testSuite(peopleAdapter, 'id')
})
