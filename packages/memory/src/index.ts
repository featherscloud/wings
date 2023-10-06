import { BadRequest, NotFound } from '@feathersjs/errors'
import { _ } from '@feathersjs/commons'
import sift from 'sift'
import {
  AdapterInterface,
  AdapterOptions,
  AdapterParams,
  Id,
  Paginated,
  select,
  sorter
} from '@wingshq/adapter-commons'

export interface MemoryStore<T> {
  [key: string]: T
}

export interface MemoryOptions<T = any> extends AdapterOptions {
  Model?: MemoryStore<T>
  startId?: number
  matcher?: (query: any) => any
  sorter?: (sort: any) => any
}

const _select = (data: any, params: any, ...args: string[]) => {
  const base = select(params, ...args)

  return base(JSON.parse(JSON.stringify(data)))
}

export interface MemoryParams<T> extends AdapterParams<T> {
  Model?: MemoryStore<T>
}

export class MemoryAdapter<
  Result = unknown,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Data,
  Params extends MemoryParams<Result> = MemoryParams<Result>
> implements AdapterInterface<Result, Data, PatchData, UpdateData, MemoryOptions<Result>, Params>
{
  options: MemoryOptions<Result>
  Model: MemoryStore<Result>
  _uId: number

  constructor(options: Partial<MemoryOptions<Result>> = {}) {
    this.options = {
      id: 'id',
      matcher: sift,
      sorter,
      Model: {},
      startId: 0,
      ...options
    }
    this._uId = this.options.startId
    this.Model = { ...this.options.Model }
  }

  get id() {
    return this.options.id
  }

  getQuery(params?: Params) {
    const { $skip, $sort, $limit, $select, ...query } = params?.query || {}

    return {
      query,
      filters: { $skip, $sort, $limit, $select }
    }
  }

  async find(params: Params & { paginate: true }): Promise<Paginated<Result>>
  async find(params?: Params & { paginate?: false }): Promise<Result[]>
  async find(params?: Params & { paginate?: boolean }): Promise<Result[] | Paginated<Result>> {
    const { query, filters } = this.getQuery(params)
    const { Model = this.Model } = params || {}

    let values = _.values(Model)
    const total = values.length
    const hasSkip = filters.$skip !== undefined
    const hasSort = filters.$sort !== undefined
    const hasLimit = filters.$limit !== undefined
    const hasQuery = _.keys(query).length > 0

    if (hasSort) {
      values.sort(this.options.sorter(filters.$sort))
    }

    if (hasQuery || hasLimit || hasSkip) {
      let skipped = 0
      const matcher = this.options.matcher(query)
      const matched = []

      for (let index = 0, length = values.length; index < length; index++) {
        const value = values[index]

        if (hasQuery && !matcher(value, index, values)) {
          continue
        }

        if (hasSkip && filters.$skip > skipped) {
          skipped++
          continue
        }

        matched.push(value)

        if (hasLimit && filters.$limit === matched.length) {
          break
        }
      }

      values = matched
    }

    values = values.map((value) => _select(value, params, this.id))

    const result: Paginated<Result> = {
      total: hasQuery ? values.length : total,
      limit: filters.$limit,
      skip: filters.$skip || 0,
      data: filters.$limit === 0 ? [] : values
    }

    if (!params?.paginate) {
      return result.data
    }

    return result
  }

  get(id: Id, params?: Params): Promise<Result> {
    const { query } = this.getQuery(params)
    const { Model = this.Model } = params || {}

    if (id in Model) {
      const value = Model[id]

      if (this.options.matcher(query)(value)) {
        return _select(value, params, this.id)
      }
    }

    throw new NotFound(`No record found for id '${id}'`)
  }

  create(data: Data[], params?: Params): Promise<Result[]>
  create(data: Data, params?: Params): Promise<Result>
  create(data: Data | Data[], params?: Params): Promise<Result[]> | Promise<Result> {
    if (Array.isArray(data)) {
      return Promise.all(data.map((current) => this.create(current, params)))
    }

    const { Model = this.Model } = params || {}
    const id = (data as any)[this.id] || this._uId++
    const current = {
      ...data,
      [this.id]: id
    } as Result

    return _select((Model[id] = current), params, this.id)
  }

  async update(id: Id, data: UpdateData, params?: Params): Promise<Result> {
    if (id === null || Array.isArray(data)) {
      throw new BadRequest("You can not replace multiple instances. Did you mean 'patch'?")
    }

    const { Model = this.Model } = params || {}
    const oldEntry = await this.get(id)
    // We don't want our id to change type if it can be coerced
    const oldId = (oldEntry as any)[this.id]

    // eslint-disable-next-line eqeqeq
    id = oldId == id ? oldId : id

    Model[id] = _.extend({}, data, { [this.id]: id })

    return this.get(id, params)
  }

  async patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  async patch(id: null, data: PatchData, params?: Params): Promise<Result[]>
  async patch(id: Id | null, data: PatchData, params?: Params): Promise<Result[] | Result> {
    const { query } = this.getQuery(params)
    const { Model = this.Model } = params || {}
    const patchEntry = (entry: Result) => {
      const currentId = (entry as any)[this.id]

      Model[currentId] = _.extend(Model[currentId], _.omit(data, this.id))

      return _select(Model[currentId], params, this.id)
    }

    if (id === null) {
      const entries = await this.find({
        ...params,
        paginate: false,
        query
      })

      return entries.map(patchEntry)
    }

    return patchEntry(await this.get(id, params)) // Will throw an error if not found
  }

  async remove(id: Id, params?: Params): Promise<Result>
  async remove(id: null, params?: Params): Promise<Result[]>
  async remove(id: Id | null, params?: Params): Promise<Result[] | Result> {
    const { query } = this.getQuery(params)
    const { Model = this.Model } = params || {}

    if (id === null) {
      const entries = await this.find({
        ...params,
        paginate: false,
        query
      })

      return Promise.all(entries.map((current: any) => this.remove(current[this.id] as Id, params)))
    }

    const entry = await this.get(id, params)

    delete Model[id]

    return entry
  }
}
