import { generator, renderTemplate, toFile } from '@feathershq/pinion'
import { AdapterContext } from '../adapter'

interface Context extends AdapterContext {}

const template = ({ uppername }: Context) => `
import { AdapterInterface, AdapterOptions, AdapterParams, Id, Paginated } from '@wingshq/adapter-commons'

export interface ${uppername}Options extends AdapterOptions {}

export interface ${uppername}Params extends AdapterParams {}

export class ${uppername}Adapter<
  Result = unknown,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Data,
  Params extends ${uppername}Params = ${uppername}Params
> implements AdapterInterface<Result, Data, PatchData, UpdateData, ${uppername}Options, Params>
{
  constructor(public options: ${uppername}Options) {
  }

  get id() {
    return this.options.id
  }

  async find(params: Params & { paginate: true }): Promise<Paginated<Result>>
  async find(params?: Params & { paginate?: false }): Promise<Result[]>
  async find(params?: Params & { paginate?: boolean }): Promise<Result[] | Paginated<Result>> {
    const data: Result[] = []

    if (params?.paginate) {
      return {
        total: 0,
        limit: 0,
        skip: 0,
        data
      }
    }

    return data
  }

  async get(id: Id, params?: Params): Promise<Result> {
   return { id }
  }

  create(data: Data[], params?: Params): Promise<Result[]>
  create(data: Data, params?: Params): Promise<Result>
  create(data: Data | Data[], params?: Params): Promise<Result[]> | Promise<Result> {
    if (Array.isArray(data)) {
      return Promise.all(data.map((current) => this.create(current, params)))
    }

    return data
  }

  async update(id: Id, data: UpdateData, params?: Params): Promise<Result> {
    return data
  }

  async patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  async patch(id: null, data: PatchData, params?: Params): Promise<Result[]>
  async patch(id: Id | null, data: PatchData, params?: Params): Promise<Result[] | Result> {
    return data
  }

  async remove(id: Id, params?: Params): Promise<Result>
  async remove(id: null, params?: Params): Promise<Result[]>
  async remove(id: Id | null, params?: Params): Promise<Result[] | Result> {
    return {}
  }
}
`

export const generate = (context: Context) =>
  generator(context).then(renderTemplate(template, toFile(context.packagePath, 'src', 'index.ts')))
