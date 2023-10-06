import { describe, it } from 'node:test'
import { strict as assert } from 'assert'
import { adapterTests } from '../src'

const testSuite = adapterTests([
  '.get',
  '.get',
  '.get + $select',
  '.get + id + query',
  '.get + NotFound',
  '.find',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.remove + multi no pagination',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multiple no pagination',
  '.patch multi query changed',
  '.patch multi query same',
  '.patch + NotFound',
  '.create',
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
  '.find + paginate + params',
  '.get + id + query id',
  '.remove + id + query id',
  '.update + id + query id',
  '.patch + id + query id'
])

describe('Feathers Memory Service', () => {
  it('loads the test suite', () => {
    assert.ok(typeof testSuite === 'function')
  })

  it('exports as CommonJS', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    assert.equal(typeof require('../lib').adapterTests, 'function')
  })
})
