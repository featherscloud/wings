import type { Callable, PinionContext } from '@feathershq/pinion'
import { generator, prompt, runGenerators, toFile } from '@feathershq/pinion'

export interface AdapterContext extends PinionContext {
  name: string
  uppername: string
  description: string
  packagePath: Callable<string, AdapterContext>
}

export const generate = (context: AdapterContext) =>
  generator(context)
    .then(
      prompt<AdapterContext>([
        {
          type: 'input',
          name: 'name',
          message: 'What is the name of the adapter?'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Write a short description'
        }
      ])
    )
    .then((ctx) => {
      return {
        ...ctx,
        uppername: ctx.name.charAt(0).toUpperCase() + ctx.name.slice(1),
        packagePath: toFile('packages', ctx.name)
      }
    })
    .then(runGenerators(__dirname, 'adapter'))
