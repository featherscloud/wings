import { describe, it } from 'node:test'
import assert from 'assert'
import { adapterTests, Person } from '@wingshq/adapter-tests'

import { MemoryAdapter } from '../src'

const testSuite = adapterTests([
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

describe('Wings Memory Adapter', () => {
  const service = new MemoryAdapter<Person>()
  const customIdService = new MemoryAdapter<Person>({
    id: 'customid'
  })

  type Animal = {
    id: number
    type: string
    age: number
  }

  it('update with string id works', async () => {
    const person = await service.create({
      name: 'Tester',
      age: 33
    })

    const updatedPerson = await service.update(person.id.toString(), person)

    assert.strictEqual(typeof updatedPerson.id, 'number')

    await service.remove(person.id!.toString())
  })

  it('patch record with prop also in query', async () => {
    const animals = new MemoryAdapter<Animal>()
    await animals.create([
      {
        type: 'cat',
        age: 30
      },
      {
        type: 'dog',
        age: 10
      }
    ])

    const [updated] = await animals.patch(null, { age: 40 }, { query: { age: 30 } })

    assert.strictEqual(updated.age, 40)

    await animals.remove(null, {})
  })

  it('allows to pass custom find and sort matcher', async () => {
    let sorterCalled = false
    let matcherCalled = false

    const service = new MemoryAdapter<Person>({
      matcher() {
        matcherCalled = true
        return function () {
          return true
        }
      },

      sorter() {
        sorterCalled = true
        return function () {
          return 0
        }
      }
    })

    await service.find({
      query: { something: 1, $sort: { something: 1 } }
    })

    assert.ok(sorterCalled, 'sorter called')
    assert.ok(matcherCalled, 'matcher called')
  })

  it('does not modify the original data', async () => {
    const person = await service.create({
      name: 'Delete tester',
      age: 33
    })

    delete (person as any).age

    const otherPerson = await service.get(person.id!)

    assert.strictEqual(otherPerson.age, 33)

    await service.remove(person.id!)
  })

  it('update with null throws error', async () => {
    await assert.rejects(() => service.update(null as any, {}), {
      message: "You can not replace multiple instances. Did you mean 'patch'?"
    })
  })

  it('use $select as only query property', async () => {
    const person = await service.create({
      name: 'Tester',
      age: 42
    })

    try {
      const results = await service.find({
        query: {
          $select: ['name']
        }
      })

      assert.deepStrictEqual(results[0], { id: person.id, name: 'Tester' })
    } finally {
      await service.remove(person.id!)
    }
  })

  it('using $limit still returns correct total', async () => {
    for (let i = 0; i < 10; i++) {
      await service.create({
        name: `Tester ${i}`,
        age: 19
      })
      await service.create({
        name: `Tester ${i}`,
        age: 20
      })
    }

    try {
      const results = await service.find({
        paginate: true,
        query: {
          $skip: 3,
          $limit: 5,
          age: 19
        }
      })

      assert.strictEqual(results.total, 10)
      assert.strictEqual(results.skip, 3)
      assert.strictEqual(results.limit, 5)
    } finally {
      await service.remove(null, {
        query: {
          age: {
            $in: [19, 20]
          }
        }
      })
    }
  })

  testSuite(service as any, 'id')
  testSuite(customIdService as any, 'customid')
})
