import { generator, toFile, writeJSON } from '@feathershq/pinion'
import { AdapterContext } from '../adapter'

interface Context extends AdapterContext {}

export const generate = (context: Context) =>
  generator(context).then(
    writeJSON<Context>(
      ({ name, description }) => ({
        name: `@wingshq/${name}`,
        description,
        version: '0.0.0',
        homepage: 'https://wings.codes',
        keywords: ['wings', 'wings-adapter'],
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'git://github.com/wingshq/wings.git',
          directory: `packages/${name}`
        },
        author: {
          name: 'Wings contributors',
          email: 'hello@feathersjs.com',
          url: 'https://feathersjs.com'
        },
        contributors: [],
        bugs: {
          url: 'https://github.com/wingshq/wings/issues'
        },
        engines: {
          node: '>= 20'
        },
        files: ['CHANGELOG.md', 'LICENSE', 'README.md', 'src/**', 'lib/**', 'esm/**'],
        module: './esm/index.js',
        main: './lib/index.js',
        types: './src/index.ts',
        exports: {
          '.': {
            import: './esm/index.js',
            require: './lib/index.js',
            types: './src/index.ts'
          }
        },
        scripts: {
          prepublish: 'npm run compile',
          'compile:lib': 'shx rm -rf lib/ && tsc --module commonjs',
          'compile:esm': 'shx rm -rf esm/ && tsc --module es2020 --outDir esm',
          compile: 'npm run compile:lib && npm run compile:esm',
          test: 'npm run compile && node --require ts-node/register --test test/**.test.ts'
        },
        publishConfig: {
          access: 'public'
        },
        dependencies: {
          '@wingshq/adapter-commons': '^0.0.0'
        },
        devDependencies: {
          '@wingshq/adapter-tests': '^0.0.0'
        }
      }),
      toFile('packages', context.name, 'package.json')
    )
  )
// .then(() => process.chdir(process.cwd(), 'packages', ({ name }) => name))
// .then(install(['@types/node', 'shx', 'ts-node', 'typescript']))
