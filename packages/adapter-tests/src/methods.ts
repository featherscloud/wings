import { describe, beforeEach, afterEach } from 'node:test'
import assert from 'assert'
import { AdapterMethodsTest, Person } from './declarations'
import { AdapterInterface, Id } from '@wingshq/adapter-commons'

export default function <Service extends AdapterInterface<Person>>(
  test: AdapterMethodsTest,
  service: Service,
  idProp: string
) {
  describe(' Methods', () => {
    let doug: Person

    beforeEach(async () => {
      doug = await service.create({
        name: 'Doug',
        age: 32
      })
    })

    afterEach(async () => {
      try {
        await service.remove(doug[idProp])
      } catch (error: any) {}
    })

    describe('get', () => {
      test('.get', async () => {
        const data = await service.get(doug[idProp])

        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id matches`)
        assert.strictEqual(data.name, 'Doug', 'data.name matches')
        assert.strictEqual(data.age, 32, 'data.age matches')
      })

      test('.get + $select', async () => {
        const data = await service.get(doug[idProp], {
          query: { $select: ['name'] }
        })

        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id property matches`)
        assert.strictEqual(data.name, 'Doug', 'data.name matches')
        assert.ok(!data.age, 'data.age is falsy')
      })

      test('.get + id + query', async () => {
        try {
          await service.get(doug[idProp], {
            query: { name: 'Tester' }
          })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }
      })

      test('.get + NotFound', async () => {
        try {
          await service.get('568225fbfe21222432e836ff')
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Error is a NotFound Feathers error')
        }
      })

      test('.get + id + query id', async () => {
        const alice = await service.create({
          name: 'Alice',
          age: 12
        })

        try {
          await service.get(doug[idProp], {
            query: { [idProp]: alice[idProp] }
          })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }

        await service.remove(alice[idProp])
      })
    })

    describe('find', () => {
      test('.find', async () => {
        const data = await service.find()

        assert.ok(Array.isArray(data), 'Data is an array')
        assert.strictEqual(data.length, 1, 'Got one entry')
      })
    })

    describe('remove', () => {
      test('.remove', async () => {
        const data = await service.remove(doug[idProp] as string)

        assert.strictEqual(data.name, 'Doug', 'data.name matches')
      })

      test('.remove + $select', async () => {
        const data = await service.remove(doug[idProp] as string, {
          query: { $select: ['name'] }
        })

        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id property matches`)
        assert.strictEqual(data.name, 'Doug', 'data.name matches')
        assert.ok(!data.age, 'data.age is falsy')
      })

      test('.remove + id + query', async () => {
        try {
          await service.remove(doug[idProp], {
            query: { name: 'Tester' }
          })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }
      })

      test('.remove + multi', async () => {
        await service.create({ name: 'Dave', age: 29, created: true })
        await service.create({
          name: 'David',
          age: 3,
          created: true
        })

        const data = await service.remove(null, {
          query: { created: true }
        })

        assert.strictEqual(data.length, 2)

        const names = data.map((person: any) => person.name)

        assert.ok(names.includes('Dave'), 'Dave removed')
        assert.ok(names.includes('David'), 'David removed')
      })

      test('.remove + multi no pagination', async () => {
        try {
          await service.remove(doug[idProp])
        } catch (error: any) {}

        const count = 14

        try {
          const emptyItems = await service.find({ paginate: false })
          assert.strictEqual(emptyItems.length, 0, 'no items before')

          const createdItems = await service.create(
            Array.from(Array(count)).map((_, i) => ({
              name: `name-${i}`,
              age: 3,
              created: true
            }))
          )
          assert.strictEqual(createdItems.length, count, `created ${count} items`)

          const foundItems = await service.find({ paginate: false })
          assert.strictEqual(foundItems.length, count, `created ${count} items`)

          const $limit = 10
          const foundPaginatedItems = await service.find({
            paginate: true,
            query: {
              $limit
            }
          })
          assert.strictEqual(foundPaginatedItems.data.length, $limit, 'items paginated and limited')

          const allItems = await service.remove(null, {
            query: { created: true }
          })

          assert.strictEqual(allItems.length, count, `removed all ${count} items`)
        } finally {
          await service.remove(null, {
            query: { created: true }
          })
        }
      })

      test('.remove + id + query id', async () => {
        const alice = await service.create({
          name: 'Alice',
          age: 12
        })

        try {
          await service.remove(doug[idProp], {
            query: { [idProp]: alice[idProp] }
          })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }

        await service.remove(alice[idProp])
      })
    })

    describe('update', () => {
      test('.update', async () => {
        const originalData = { [idProp]: doug[idProp], name: 'Dougler', age: 10 }
        const originalCopy = Object.assign({}, originalData)

        const data = await service.update(doug[idProp], originalData)

        assert.deepStrictEqual(originalData, originalCopy, 'data was not modified')
        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id matches`)
        assert.strictEqual(data.name, 'Dougler', 'data.name matches')
        assert.strictEqual(data.age, 10, 'data.age is updated')
      })

      test('.update + $select', async () => {
        const originalData = {
          [idProp]: doug[idProp],
          name: 'Dougler',
          age: 10
        }

        const data = await service.update(doug[idProp], originalData, {
          query: { $select: ['name'] }
        })

        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id property matches`)
        assert.strictEqual(data.name, 'Dougler', 'data.name matches')
        assert.ok(!data.age, 'data.age is falsy')
      })

      test('.update + id + query', async () => {
        try {
          await service.update(
            doug[idProp],
            {
              name: 'Dougler',
              age: 0
            },
            {
              query: { name: 'Tester' }
            }
          )
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }
      })

      test('.update + NotFound', async () => {
        try {
          await service.update('568225fbfe21222432e836ff', {
            name: 'NotFound',
            age: 0
          })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Error is a NotFound Feathers error')
        }
      })

      test('.update + query + NotFound', async () => {
        const dave = await service.create({ name: 'Dave' })
        try {
          await service.update(dave[idProp], { name: 'UpdatedDave', age: 0 }, { query: { name: 'NotDave' } })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Error is a NotFound Feathers error')
        }
        await service.remove(dave[idProp])
      })

      test('.update + id + query id', async () => {
        const alice = await service.create({
          name: 'Alice',
          age: 12
        })

        try {
          await service.update(
            doug[idProp],
            {
              name: 'Dougler',
              age: 33
            },
            {
              query: { [idProp]: alice[idProp] }
            }
          )
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }

        await service.remove(alice[idProp])
      })
    })

    describe('patch', () => {
      test('.patch', async () => {
        const originalData = { [idProp]: doug[idProp], name: 'PatchDoug' }
        const originalCopy = Object.assign({}, originalData)
        const id = doug[idProp] as Id

        const data = await service.patch(id, originalData)

        assert.deepStrictEqual(originalData, originalCopy, 'original data was not modified')
        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id matches`)
        assert.strictEqual(data.name, 'PatchDoug', 'data.name matches')
        assert.strictEqual(data.age, 32, 'data.age matches')
      })

      test('.patch + $select', async () => {
        const originalData = { [idProp]: doug[idProp], name: 'PatchDoug' }
        const id = doug[idProp] as Id

        const data = await service.patch(id, originalData, {
          query: { $select: ['name'] }
        })

        assert.strictEqual(data[idProp].toString(), doug[idProp].toString(), `${idProp} id property matches`)
        assert.strictEqual(data.name, 'PatchDoug', 'data.name matches')
        assert.ok(!data.age, 'data.age is falsy')
      })

      test('.patch + id + query', async () => {
        try {
          await service.patch(
            doug[idProp],
            {
              name: 'id patched doug'
            },
            {
              query: { name: 'Tester' }
            }
          )
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }
      })

      test('.patch multiple', async () => {
        const params = {
          query: { created: true }
        }
        const dave = await service.create({
          name: 'Dave',
          age: 29,
          created: true
        })
        const david = await service.create({
          name: 'David',
          age: 3,
          created: true
        })

        const data = await service.patch(
          null,
          {
            age: 2
          },
          params
        )

        assert.strictEqual(data.length, 2, 'returned two entries')
        assert.strictEqual(data[0].age, 2, 'First entry age was updated')
        assert.strictEqual(data[1].age, 2, 'Second entry age was updated')

        await service.remove(dave[idProp])
        await service.remove(david[idProp])
      })

      test('.patch multiple no pagination', async () => {
        try {
          await service.remove(doug[idProp])
        } catch (error: any) {}

        const count = 14
        let ids: any[]

        try {
          const emptyItems = await service.find()
          assert.strictEqual(emptyItems.length, 0, 'no items before')

          const createdItems = await service.create(
            Array.from(Array(count)).map((_, i) => ({
              name: `name-${i}`,
              age: 3,
              created: true
            }))
          )
          assert.strictEqual(createdItems.length, count, `created ${count} items`)
          ids = createdItems.map((item: any) => item[idProp])

          const foundItems = await service.find({ paginate: false })
          assert.strictEqual(foundItems.length, count, `created ${count} items`)

          const $limit = 10
          const foundPaginatedItems = await service.find({
            paginate: true,
            query: {
              $limit
            }
          })
          assert.strictEqual(foundPaginatedItems.data.length, $limit, 'got paginated data with limit')

          const allItems = await service.patch(null, { age: 4 }, { query: { created: true } })

          assert.strictEqual(allItems.length, count, `patched all ${count} items`)
        } finally {
          if (ids) {
            await Promise.all(ids.map((id) => service.remove(id)))
          }
        }
      })

      test('.patch multi query same', async () => {
        const params = {
          query: { age: { $lt: 10 } }
        }
        const dave = await service.create({
          name: 'Dave',
          age: 8,
          created: true
        })
        const david = await service.create({
          name: 'David',
          age: 4,
          created: true
        })

        const data = await service.patch(
          null,
          {
            age: 2
          },
          params
        )

        assert.strictEqual(data.length, 2, 'returned two entries')
        assert.strictEqual(data[0].age, 2, 'First entry age was updated')
        assert.strictEqual(data[1].age, 2, 'Second entry age was updated')

        await service.remove(dave[idProp])
        await service.remove(david[idProp])
      })

      test('.patch multi query changed', async () => {
        const params = {
          query: { age: 10 }
        }
        const dave = await service.create({
          name: 'Dave',
          age: 10,
          created: true
        })
        const david = await service.create({
          name: 'David',
          age: 10,
          created: true
        })

        const data = await service.patch(
          null,
          {
            age: 2
          },
          params
        )

        assert.strictEqual(data.length, 2, 'returned two entries')
        assert.strictEqual(data[0].age, 2, 'First entry age was updated')
        assert.strictEqual(data[1].age, 2, 'Second entry age was updated')

        await service.remove(dave[idProp])
        await service.remove(david[idProp])
      })

      test('.patch + NotFound', async () => {
        try {
          await service.patch('568225fbfe21222432e836ff', {
            name: 'PatchDoug'
          })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Error is a NotFound Feathers error')
        }
      })

      test('.patch + query + NotFound', async () => {
        const dave = await service.create({ name: 'Dave' })
        try {
          await service.patch(dave[idProp], { name: 'PatchedDave' }, { query: { name: 'NotDave' } })
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Error is a NotFound Feathers error')
        }
        await service.remove(dave[idProp])
      })

      test('.patch + id + query id', async () => {
        const alice = await service.create({
          name: 'Alice',
          age: 12
        })

        try {
          await service.patch(
            doug[idProp],
            {
              age: 33
            },
            {
              query: { [idProp]: alice[idProp] }
            }
          )
          throw new Error('Should never get here')
        } catch (error: any) {
          assert.strictEqual(error.name, 'NotFound', 'Got a NotFound Feathers error')
        }

        await service.remove(alice[idProp])
      })
    })

    describe('create', () => {
      test('.create', async () => {
        const originalData = {
          name: 'Bill',
          age: 40
        }
        const originalCopy = Object.assign({}, originalData)

        const data = await service.create(originalData)

        assert.deepStrictEqual(originalData, originalCopy, 'original data was not modified')
        assert.ok(data instanceof Object, 'data is an object')
        assert.strictEqual(data.name, 'Bill', 'data.name matches')

        await service.remove(data[idProp])
      })

      test('.create ignores query', async () => {
        const originalData = {
          name: 'Billy',
          age: 42
        }
        const data = await service.create(originalData, {
          query: {
            name: 'Dave'
          }
        })

        assert.strictEqual(data.name, 'Billy', 'data.name matches')

        await service.remove(data[idProp])
      })

      test('.create + $select', async () => {
        const originalData = {
          name: 'William',
          age: 23
        }

        const data = await service.create(originalData, {
          query: { $select: ['name'] }
        })

        assert.ok(idProp in data, 'data has id')
        assert.strictEqual(data.name, 'William', 'data.name matches')
        assert.ok(!data.age, 'data.age is falsy')

        await service.remove(data[idProp])
      })

      test('.create multi', async () => {
        const items = [
          {
            name: 'Gerald',
            age: 18
          },
          {
            name: 'Herald',
            age: 18
          }
        ]

        const data = await service.create(items)

        assert.ok(Array.isArray(data), 'data is an array')
        assert.ok(typeof data[0][idProp] !== 'undefined', 'id is set')
        assert.strictEqual(data[0].name, 'Gerald', 'first name matches')
        assert.ok(typeof data[1][idProp] !== 'undefined', 'id is set')
        assert.strictEqual(data[1].name, 'Herald', 'second name macthes')

        await service.remove(data[0][idProp])
        await service.remove(data[1][idProp])
      })
    })
  })
}
