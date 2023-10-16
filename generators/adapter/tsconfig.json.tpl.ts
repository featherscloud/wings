import { generator, toFile, writeJSON } from '@feathershq/pinion'
import { AdapterContext } from '../adapter'

export const generate = (context: AdapterContext) =>
  generator(context).then(
    writeJSON(
      {
        extends: '../../tsconfig',
        include: ['src/**/*.ts'],
        compilerOptions: {
          outDir: 'lib'
        }
      },
      toFile(context.packagePath, 'tsconfig.json')
    )
  )
