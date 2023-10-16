import { generator, renderTemplate, toFile } from '@feathershq/pinion'
import { AdapterContext } from '../adapter'

const template = ({ name, description }: AdapterContext) => `# @wingshq/${name}

[![CI](https://github.com/wingshq/${name}/workflows/CI/badge.svg)](https://github.com/wingshq/wings/actions?query=workflow%3ACI)
[![Download Status](https://img.shields.io/npm/dm/@wingshq/${name}.svg?style=flat-square)](https://www.npmjs.com/package/@wingshq/${name})
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

> ${description}

## Installation

\`\`\`bash
$ npm install --save @wingshq/${name}
\`\`\`

## Documentation

See [Wings ${name} Adapter API documentation](https://wings.codes/adapters/${name}.html) for more details.

## License

Copyright (c) ${new Date().getFullYear()} [Wings contributors](https://github.com/wingshq/wings/graphs/contributors)

Licensed under the [MIT license](LICENSE).
`

export const generate = (context: AdapterContext) =>
  generator(context).then(renderTemplate(template, toFile(context.packagePath, 'README.md')))
