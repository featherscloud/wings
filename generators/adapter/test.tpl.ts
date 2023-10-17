import { generator, renderTemplate, toFile } from '@feathershq/pinion'
import { AdapterContext } from '../adapter'

interface Context extends AdapterContext {}

const template = ({ uppername, name }: Context) => /** ts */ `import { describe, it } from 'node:test'
import assert from 'assert'
import { adapterTests, Person } from '@wingshq/adapter-tests'

import { ${uppername}Adapter } from '../src'

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

describe('Wings ${name} Adapter', () => {
  const adapter = new ${uppername}Adapter<Person>()

  it('instantiated the adapter', () => {
    assert.ok(adapter)
  })
  
  testSuite(adapter, 'id')
})
`

export const generate = (context: Context) =>
  generator(context).then(
    renderTemplate(template, toFile<Context>(context.packagePath, 'test', 'index.test.ts'))
  )
