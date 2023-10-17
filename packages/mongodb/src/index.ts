import {
  ObjectId,
  Collection,
  FindOptions,
  BulkWriteOptions,
  InsertOneOptions,
  DeleteOptions,
  CountDocumentsOptions,
  ReplaceOptions,
  Document,
  MongoError,
  Filter
} from 'mongodb'
import {
  AdapterInterface,
  AdapterOptions,
  AdapterParams,
  AdapterQuery,
  Id,
  Paginated,
  select
} from '@wingshq/adapter-commons'
import { _ } from '@feathersjs/commons'
import { BadRequest, GeneralError, NotFound } from '@feathersjs/errors'

export interface MongodbOptions extends AdapterOptions {
  Model: Collection | Promise<Collection>
  disableObjectify?: boolean
  useEstimatedDocumentCount?: boolean
}

export type MongodbSettings = Partial<Omit<MongodbOptions, 'Model'>> & Pick<MongodbOptions, 'Model'>

export type MongodbQuery<T> = Filter<T> & Pick<AdapterQuery<T>, '$select' | '$sort' | '$limit' | '$skip'>

export interface MongodbParams<T> extends AdapterParams<MongodbQuery<T>> {
  Model?: Collection | Promise<Collection>
  pipeline?: Document[]
  mongodb?:
    | BulkWriteOptions
    | FindOptions
    | InsertOneOptions
    | DeleteOptions
    | CountDocumentsOptions
    | ReplaceOptions
}

export type AdapterId = Id | ObjectId

export type NullableAdapterId = AdapterId | null

export function errorHandler(error: MongoError): any {
  // See https://github.com/mongodb/mongo/blob/master/docs/errors.md
  if (error && error.name && error.name.startsWith('Mongo')) {
    throw new GeneralError(error, {
      name: error.name,
      code: error.code
    })
  }

  throw error
}

export class MongodbAdapter<
  Result = unknown,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Data,
  Params extends MongodbParams<Result> = MongodbParams<Result>
> implements AdapterInterface<Result, Data, PatchData, UpdateData, MongodbOptions, Params>
{
  options: MongodbOptions

  constructor(settings: MongodbSettings) {
    this.options = {
      id: '_id',
      ...settings
    }
  }

  get id() {
    return this.options.id
  }

  getModel(params?: Params) {
    return Promise.resolve(params?.Model || this.options.Model)
  }

  getObjectId(id: AdapterId) {
    if (this.options.disableObjectify) {
      return id
    }

    if (this.id === '_id' && ObjectId.isValid(id)) {
      id = new ObjectId(id.toString())
    }

    return id
  }

  filterQuery(id: NullableAdapterId, params?: Params) {
    const { $select, $sort, $limit, $skip = 0, ..._query } = (params?.query || {}) as AdapterQuery<Result>
    const query = _query as { [key: string]: any }

    if (id !== null) {
      query.$and = (query.$and || []).concat({
        [this.id]: this.getObjectId(id)
      })
    }

    if (query[this.id]) {
      query[this.id] = this.getObjectId(query[this.id])
    }

    return {
      filters: { $select, $sort, $limit, $skip },
      query
    }
  }

  async findRaw(params?: Params) {
    const { filters, query } = this.filterQuery(null, params)
    const model = await this.getModel(params)
    const q = model.find(query, { ...params?.mongodb })

    if (filters.$select !== undefined) {
      q.project(this.getSelect(filters.$select))
    }

    if (filters.$sort !== undefined) {
      q.sort(filters.$sort)
    }

    if (filters.$skip !== undefined) {
      q.skip(filters.$skip)
    }

    if (filters.$limit !== undefined) {
      q.limit(filters.$limit)
    }

    return q
  }

  async aggregateRaw(params?: Params) {
    const model = await this.getModel(params)
    const pipeline = params?.pipeline || []
    const index = pipeline.findIndex((stage: Document) => stage.$feathers)
    const before = index >= 0 ? pipeline.slice(0, index) : []
    const feathersPipeline = this.makeFeathersPipeline(params)
    const after = index >= 0 ? pipeline.slice(index + 1) : pipeline

    return model.aggregate([...before, ...feathersPipeline, ...after])
  }

  makeFeathersPipeline(params?: Params) {
    const { filters, query } = this.filterQuery(null, params)
    const pipeline: Document[] = [{ $match: query }]

    if (filters.$select !== undefined) {
      pipeline.push({ $project: this.getSelect(filters.$select) })
    }

    if (filters.$sort !== undefined) {
      pipeline.push({ $sort: filters.$sort })
    }

    if (filters.$skip !== undefined) {
      pipeline.push({ $skip: filters.$skip })
    }

    if (filters.$limit !== undefined) {
      pipeline.push({ $limit: filters.$limit })
    }
    return pipeline
  }

  getSelect(_select: (keyof Result)[] | { [key: string]: number }) {
    const select = Array.isArray(_select)
      ? _select.reduce<{ [key: string]: number }>(
          (value, name) => ({
            ...value,
            [name]: 1
          }),
          {}
        )
      : _select

    if (!select[this.id]) {
      return {
        ...select,
        [this.id]: 1
      }
    }

    return select
  }

  async _findOrGet(id: NullableAdapterId, params?: Params) {
    return id === null ? await this.find(params) : await this.get(id, params)
  }

  normalizeId<D>(id: NullableAdapterId, data: D): D {
    if (this.id === '_id') {
      // Default Mongo IDs cannot be updated. The Mongo library handles
      // this automatically.
      return _.omit(data, this.id)
    } else if (id !== null) {
      // If not using the default Mongo _id field set the ID to its
      // previous value. This prevents orphaned documents.
      return {
        ...data,
        [this.id]: id
      }
    }
    return data
  }

  async find(params: Params & { paginate: true }): Promise<Paginated<Result>>
  async find(params?: Params & { paginate?: false }): Promise<Result[]>
  async find(params?: Params & { paginate?: boolean }): Promise<Result[] | Paginated<Result>> {
    const { filters, query } = this.filterQuery(null, params)
    const useAggregation = !params?.mongodb && filters.$limit !== 0
    const countDocuments = async () => {
      if (params?.paginate) {
        const model = await this.getModel(params)
        if (this.options.useEstimatedDocumentCount && typeof model.estimatedDocumentCount === 'function') {
          return model.estimatedDocumentCount()
        } else {
          return model.countDocuments(query, { ...params?.mongodb })
        }
      }
      return Promise.resolve(0)
    }

    const [request, total] = await Promise.all([
      useAggregation ? this.aggregateRaw(params) : this.findRaw(params),
      countDocuments()
    ])
    const data = filters.$limit === 0 ? [] : ((await request.toArray()) as any as Result[])

    if (params?.paginate) {
      return {
        total,
        limit: filters.$limit !== undefined ? filters.$limit : null,
        skip: filters.$skip || 0,
        data
      }
    }

    return data
  }

  async get(id: AdapterId, params?: Params): Promise<Result> {
    const {
      query,
      filters: { $select }
    } = this.filterQuery(id, params)
    const projection = $select
      ? {
          projection: {
            ...this.getSelect($select),
            [this.id]: 1
          }
        }
      : {}
    const findOptions: FindOptions = {
      ...params?.mongodb,
      ...projection
    }

    return this.getModel(params)
      .then((model) => model.findOne(query, findOptions))
      .then((data) => {
        if (data == null) {
          throw new NotFound(`No record found for id '${id}'`)
        }

        return data
      })
      .catch(errorHandler)
  }

  async create(data: Data[], params?: Params): Promise<Result[]>
  async create(data: Data, params?: Params): Promise<Result>
  async create(data: Data | Data[], params?: Params): Promise<Result[] | Result> {
    const writeOptions = params?.mongodb
    const model = await this.getModel(params)
    const setId = (item: any) => {
      const entry = Object.assign({}, item)

      // Generate a MongoId if we use a custom id
      if (this.id !== '_id' && typeof entry[this.id] === 'undefined') {
        return {
          [this.id]: new ObjectId().toHexString(),
          ...entry
        }
      }

      return entry
    }

    const promise = Array.isArray(data)
      ? model
          .insertMany(data.map(setId), writeOptions)
          .then(async (result) =>
            model.find({ _id: { $in: Object.values(result.insertedIds) } }, params?.mongodb).toArray()
          )
      : model
          .insertOne(setId(data), writeOptions)
          .then(async (result) => model.findOne({ _id: result.insertedId }, params?.mongodb))

    return promise.then(select(params, this.id)).catch(errorHandler)
  }

  async update(id: Id, data: UpdateData, params?: Params): Promise<Result> {
    if (id === null || Array.isArray(data)) {
      throw new BadRequest("You can not replace multiple instances. Did you mean 'patch'?")
    }

    const model = await this.getModel(params)
    const { query } = this.filterQuery(id, params)
    const replaceOptions = { ...params?.mongodb }

    await model.replaceOne(query, this.normalizeId(id, data), replaceOptions)

    return this._findOrGet(id, params).catch(errorHandler)
  }

  async patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  async patch(id: null, data: PatchData, params?: Params): Promise<Result[]>
  async patch(id: Id | null, _data: PatchData, params?: Params): Promise<Result[] | Result> {
    const data = this.normalizeId(id, _data)
    const model = await this.getModel(params)
    const {
      query,
      filters: { $select }
    } = this.filterQuery(id, params)
    const updateOptions = { ...params?.mongodb }
    const modifier = Object.keys(data).reduce((current, key) => {
      const value = (data as any)[key]

      if (key.charAt(0) !== '$') {
        current.$set = {
          ...current.$set,
          [key]: value
        }
      } else {
        current[key] = value
      }

      return current
    }, {} as any)
    const originalIds = await this._findOrGet(id, {
      ...params,
      query: {
        ...query,
        $select: [this.id]
      },
      paginate: false
    })
    const items = Array.isArray(originalIds) ? originalIds : [originalIds]
    const idList = items.map((item: any) => item[this.id])
    const findParams = {
      ...params,
      paginate: false,
      query: {
        [this.id]: { $in: idList },
        $select
      }
    }

    await model.updateMany(query, modifier, updateOptions)

    return this._findOrGet(id, findParams).catch(errorHandler)
  }

  async remove(id: Id, params?: Params): Promise<Result>
  async remove(id: null, params?: Params): Promise<Result[]>
  async remove(id: Id | null, params?: Params): Promise<Result[] | Result> {
    const model = await this.getModel(params)
    const {
      query,
      filters: { $select }
    } = this.filterQuery(id, params)
    const deleteOptions = { ...params?.mongodb }
    const findParams = {
      ...params,
      paginate: false,
      query: {
        ...query,
        $select
      }
    }

    return this._findOrGet(id, findParams)
      .then(async (items) => {
        await model.deleteMany(query, deleteOptions)
        return items
      })
      .catch(errorHandler)
  }
}
