/* eslint-disable no-console */
import { describe, it, afterAll as after } from 'vitest'
import basicTests from './basic'
import { AdapterTestName, Person } from './declarations'
import methodTests from './methods'
import syntaxTests from './syntax'
import { AdapterInterface } from '@wingshq/adapter-commons'

export const adapterTests =
  (testNames: AdapterTestName[]) =>
  <Service extends AdapterInterface<Person>>(service: Service, idProp: string) => {
    const skippedTests: AdapterTestName[] = []
    const allTests: AdapterTestName[] = []

    const test = (name: AdapterTestName, runner: any) => {
      const skip = !testNames.includes(name)
      const its = skip ? it.skip : it

      if (skip) {
        skippedTests.push(name)
      }

      allTests.push(name)

      its(name, runner)
    }

    describe(`Adapter tests for '${
      service?.constructor?.name || 'unknown'
    }' service with '${idProp}' id property`, () => {
      after(() => {
        testNames.forEach((name) => {
          if (!allTests.includes(name)) {
            console.error(`WARNING: '${name}' test is not part of the test suite`)
          }
        })
        if (skippedTests.length) {
          console.log(
            `\nSkipped the following ${skippedTests.length} Feathers adapter test(s) out of ${allTests.length} total:`
          )
          console.log(JSON.stringify(skippedTests, null, '  '))
        }
      })

      basicTests(test, service, idProp)
      methodTests(test, service, idProp)
      syntaxTests(test, service, idProp)
    })
  }

export * from './declarations'
