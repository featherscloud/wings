import {
  AdapterInterface,
  AdapterOptions,
  AdapterParams,
  AdapterQuery,
  Id,
  NullableId,
  Paginated
} from '@wingshq/adapter-commons'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { _ } from '@feathersjs/commons'
import { Knex } from 'knex'
import { errorHandler } from './error-handler'

export * from './error-handler'

export interface KnexOptions extends AdapterOptions {
  Model: Knex
  name: string
  schema?: string
}

export type KnexSettings = Omit<KnexOptions, 'id'> & { id?: string }

export interface KnexParams<T> extends AdapterParams<T> {
  Model?: Knex
  name?: string
  schema?: string
  knex?: Knex.QueryBuilder
  transaction?: Knex.Transaction
}

const METHODS = {
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn',
  $or: 'orWhere',
  $and: 'andWhere'
}

const OPERATORS = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $like: 'like',
  $notlike: 'not like',
  $ilike: 'ilike'
}

const RETURNING_CLIENTS = ['postgresql', 'pg', 'oracledb', 'mssql']

export class KnexAdapter<
  Result = unknown,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Data,
  Params extends KnexParams<AdapterQuery<Result>> = KnexParams<AdapterQuery<Result>>
> implements AdapterInterface<Result, Data, PatchData, UpdateData, KnexOptions, Params>
{
  options: KnexOptions

  constructor(settings: KnexSettings) {
    if (!settings || !settings.Model) {
      throw new Error('You must provide a Model (the initialized Knex object)')
    }

    if (typeof settings.name !== 'string') {
      throw new Error('No table name specified.')
    }

    this.options = {
      id: 'id',
      ...settings
    }
  }

  get id() {
    return this.options.id
  }

  get fullName() {
    const { name, schema } = this.getOptions()
    return schema ? `${schema}.${name}` : name
  }

  getOptions(params?: Params): KnexOptions {
    return {
      ...this.options,
      ...params
    }
  }

  getModel(params?: Params) {
    const { Model } = this.getOptions(params)
    return Model
  }

  db(params?: Params) {
    const { Model, name, schema } = this.getOptions(params)

    if (params?.transaction) {
      const trx = params.transaction
      // debug('ran %s with transaction %s', fullName, id)
      return schema ? (trx.withSchema(schema).table(name) as Knex.QueryBuilder) : trx(name)
    }

    return schema ? (Model.withSchema(schema).table(name) as Knex.QueryBuilder) : Model(name)
  }

  knexify(
    knexQuery: Knex.QueryBuilder,
    query: { [key: string]: any } = {},
    parentKey?: string
  ): Knex.QueryBuilder {
    const knexify = this.knexify.bind(this)

    return Object.keys(query || {}).reduce((currentQuery, key) => {
      const value = query[key]

      if (_.isObject(value)) {
        return knexify(currentQuery, value, key)
      }

      const column = parentKey || key
      const method = METHODS[key as keyof typeof METHODS]

      if (method) {
        if (key === '$or' || key === '$and') {
          // This will create a nested query
          currentQuery.where(function (this: any) {
            for (const condition of value) {
              this[method](function (this: Knex.QueryBuilder) {
                knexify(this, condition)
              })
            }
          })

          return currentQuery
        }

        return (currentQuery as any)[method](column, value)
      }

      const operator = OPERATORS[key as keyof typeof OPERATORS] || '='

      return operator === '='
        ? currentQuery.where(column, value)
        : currentQuery.where(column, operator, value)
    }, knexQuery)
  }

  createQuery(params?: Params) {
    const { name, id } = this.getOptions(params)
    const { filters, query } = this.filterQuery(params)
    const builder = this.db(params)

    // $select uses a specific find syntax, so it has to come first.
    if (filters.$select) {
      const select = filters.$select.map((column) =>
        String(column).includes('.') ? column : `${name}.${String(column)}`
      )
      // always select the id field, but make sure we only select it once
      builder.select(...new Set([...select, `${name}.${id}`]))
    } else {
      builder.select(`${name}.*`)
    }

    // build up the knex query out of the query params, include $and and $or filters
    this.knexify(builder, {
      ...query,
      ..._.pick(filters, '$and', '$or')
    })

    // Handle $sort
    if (filters.$sort) {
      return Object.keys(filters.$sort).reduce(
        (currentQuery, key) => currentQuery.orderBy(key, (filters.$sort as any)[key] === 1 ? 'asc' : 'desc'),
        builder
      )
    }

    return builder
  }

  filterQuery(params?: Params) {
    const { $select, $sort, $limit = null, $skip = 0, ...query } = params?.query || {}

    return {
      filters: { $select, $sort, $limit, $skip },
      query
    }
  }

  async _findOrGet(id: NullableId, params?: Params) {
    if (id !== null) {
      const { name, id: idField } = this.getOptions(params)
      const builder = params?.knex ? params.knex.clone() : this.createQuery(params)
      const idQuery = builder.andWhere(`${name}.${idField}`, '=', id).catch(errorHandler)

      return idQuery as Promise<Result[]>
    }

    return this.find({
      ...params,
      paginate: false
    })
  }

  async find(params: Params & { paginate: true }): Promise<Paginated<Result>>
  async find(params?: Params & { paginate?: false }): Promise<Result[]>
  async find(params?: Params & { paginate?: boolean }): Promise<Result[] | Paginated<Result>> {
    const { filters } = this.filterQuery(params)
    const { name, id } = this.getOptions(params)
    const builder = params?.knex ? params.knex.clone() : this.createQuery(params)
    const countBuilder = builder.clone().clearSelect().clearOrder().count(`${name}.${id} as total`)

    // Handle $limit
    if (filters.$limit) {
      builder.limit(filters.$limit)
    }

    // Handle $skip
    if (filters.$skip) {
      builder.offset(filters.$skip)
    }

    // provide default sorting if its not set
    if (!filters.$sort && builder.client.driverName === 'mssql') {
      builder.orderBy(`${name}.${id}`, 'asc')
    }

    const data = filters.$limit === 0 ? [] : await builder.catch(errorHandler)

    if (params?.paginate === true) {
      const total = await countBuilder.then((count) => parseInt(count[0] ? count[0].total : 0))

      return {
        total,
        limit: filters.$limit,
        skip: filters.$skip || 0,
        data
      }
    }

    return data
  }

  async get(id: Id, params?: Params): Promise<Result> {
    const data = await this._findOrGet(id, params)

    if (data.length !== 1) {
      throw new NotFound(`No record found for id '${id}'`)
    }

    return data[0]
  }

  async create(data: Data[], params?: Params): Promise<Result[]>
  async create(data: Data, params?: Params): Promise<Result>
  async create(_data: Data | Data[], params?: Params): Promise<Result[] | Result> {
    const data = _data as any

    if (Array.isArray(data)) {
      return Promise.all(data.map((current: Data) => this.create(current, params)))
    }

    const { client } = this.db(params).client.config
    const returning = RETURNING_CLIENTS.includes(client as string) ? [this.id] : []
    const rows: any = await this.db(params).insert(data, returning).catch(errorHandler)
    const id = data[this.id] || rows[0][this.id] || rows[0]

    if (!id) {
      return rows as Result[]
    }

    return this.get(id, {
      ...params,
      query: _.pick(params?.query || {}, '$select')
    })
  }

  async update(id: Id, _data: UpdateData, params?: Params): Promise<Result> {
    if (id === null || Array.isArray(_data)) {
      throw new BadRequest("You can not replace multiple instances. Did you mean 'patch'?")
    }

    const data = _.omit(_data, this.id)
    const oldData = await this.get(id, params)
    const newObject = Object.keys(oldData).reduce((result: any, key) => {
      if (key !== this.id) {
        // We don't want the id field to be changed
        result[key] = data[key] === undefined ? null : data[key]
      }

      return result
    }, {})

    await this.db(params).update(newObject, '*').where(this.id, id)

    return this.get(id, params)
  }

  async patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  async patch(id: null, data: PatchData, params?: Params): Promise<Result[]>
  async patch(id: Id | null, raw: PatchData, params?: Params): Promise<Result[] | Result> {
    const { name, id: idField } = this.getOptions(params)
    const data = _.omit(raw, this.id)
    const results = await this._findOrGet(id, {
      ...params,
      query: {
        ...params?.query,
        $select: [`${name}.${idField}`]
      }
    })
    const idList = results.map((current: any) => current[idField])
    const updateParams = {
      ...params,
      query: {
        [`${name}.${idField}`]: { $in: idList },
        ...(params?.query?.$select ? { $select: params?.query?.$select } : {})
      }
    }
    const builder = this.createQuery(updateParams)

    await builder.update(data)

    const items = await this._findOrGet(null, updateParams)

    if (id !== null) {
      if (items.length === 1) {
        return items[0]
      } else {
        throw new NotFound(`No record found for id '${id}'`)
      }
    }

    return items
  }

  async remove(id: Id, params?: Params): Promise<Result>
  async remove(id: null, params?: Params): Promise<Result[]>
  async remove(id: Id | null, params?: Params): Promise<Result[] | Result> {
    const items = await this._findOrGet(id, params)
    const { query } = this.filterQuery(params)
    const q = this.db(params)
    const idList = items.map((current: any) => current[this.id])

    ;(query as any)[this.id] = { $in: idList }

    // build up the knex query out of the query params
    this.knexify(q, query)

    await q.del().catch(errorHandler)

    if (id !== null) {
      if (items.length === 1) {
        return items[0]
      }

      throw new NotFound(`No record found for id '${id}'`)
    }

    return items
  }
}
