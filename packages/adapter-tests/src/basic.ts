import { describe, it } from 'node:test'
import assert from 'assert'
import { AdapterInterface } from '@wingshq/adapter-commons'
import { AdapterBasicTest, Person } from './declarations'

export default function <Service extends AdapterInterface<Person>>(
  test: AdapterBasicTest,
  service: Service,
  idProp: string
) {
  describe('Basic Functionality', () => {
    it('.id', () => {
      assert.strictEqual(service.id, idProp, 'id property is set to expected name')
    })

    test('.options', () => {
      assert.ok(service.options, 'Options are available in service.options')
    })
  })
}
