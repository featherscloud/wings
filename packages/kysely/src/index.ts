import {
  AdapterInterface,
  AdapterOptions,
  AdapterParams,
  AdapterQuery,
  Id,
  Paginated,
  QueryProperty
} from '@wingshq/adapter-commons'
import { _ } from '@feathersjs/commons'
import { BadRequest, NotFound } from '@feathersjs/errors'

import type {
  ComparisonOperatorExpression,
  DeleteQueryBuilder,
  DeleteResult,
  InsertQueryBuilder,
  InsertResult,
  Kysely,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  UpdateResult,
  Transaction,
  TableExpression
} from 'kysely'
import { errorHandler } from './error-handler'

// See https://kysely-org.github.io/kysely/variables/OPERATORS.html
const OPERATORS: Record<string, ComparisonOperatorExpression> = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $in: 'in',
  $nin: 'not in',
  $like: 'like',
  $notlike: 'not like',
  $ilike: 'ilike',
  $ne: '!=',
  $is: 'is',
  $isnot: 'is not'
}

type DeleteOrInsertBuilder =
  | DeleteQueryBuilder<any, string, DeleteResult>
  | InsertQueryBuilder<any, string, InsertResult>
  | UpdateQueryBuilder<any, string, string, UpdateResult>

export interface KyselyOptions<Tables> extends AdapterOptions {
  Model: Kysely<Tables>
  /**
   * The table name
   */
  name: TableExpression<Tables, keyof Tables>
  dialectType?: 'sqlite'
}

export type KyselyQueryProperty<Q> = {
  $like?: `%${string}%` | `%${string}` | `${string}%`
} & QueryProperty<Q>

export type KyselyQueryProperties<T> = {
  [k in keyof T]?: T[k] | KyselyQueryProperty<T[k]>
}

export type KyselyQuery<T> = KyselyQueryProperties<T> &
  Partial<Pick<AdapterQuery<T>, '$limit' | '$skip' | '$sort' | '$select'>> & {
    $or?: KyselyQueryProperties<T>[]
    $and?: KyselyQueryProperties<T>[]
  }

export interface KyselyParams<T, Tables> extends AdapterParams<KyselyQuery<T>> {
  Model?: Kysely<Tables>
  transaction?: Transaction<Tables>
}

export class KyselyAdapter<
  Tables = unknown,
  Result = unknown,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Data,
  Params extends KyselyParams<Result, Tables> = KyselyParams<Result, Tables>
> implements AdapterInterface<Result, Data, PatchData, UpdateData, KyselyOptions<Tables>, Params>
{
  constructor(public options: KyselyOptions<Tables>) {
    if (!options || !options.Model) {
      throw new Error('You must provide a Model (the Kysely db object)')
    }

    if (typeof options.name !== 'string') {
      throw new Error('No table name specified.')
    }

    this.options = {
      id: 'id',
      ...options
    }
  }

  get id() {
    return this.options.id
  }

  getQuery(params?: Params) {
    const { $skip, $sort, $limit, $select, ...query } = params?.query || {}

    return {
      query: this.convertValues(query) as KyselyQuery<Result>,
      filters: { $skip, $sort, $limit, $select }
    }
  }

  createQuery(options: KyselyOptions<Tables>, filters: any, query: any) {
    const q = this.startSelectQuery(options, filters)
    const qWhere = this.applyWhere(q, query)
    // if limit isn't provided but skip is, set limit to 10. Really, people should be specific in their query limit
    const qLimit = filters.$limit ? qWhere.limit(filters.$limit) : filters.$skip ? qWhere.limit(10) : qWhere
    const qSkip = filters.$skip ? qLimit.offset(filters.$skip) : qLimit
    const qSorted = this.applySort(qSkip as any, filters)
    return qSorted
  }

  startSelectQuery(options: KyselyOptions<Tables>, filters: any) {
    const { name, id: idField, Model } = options
    const q = Model.selectFrom(name)
    return filters.$select ? q.select(filters.$select.concat(idField)) : q.selectAll()
  }

  createCountQuery(params: Params) {
    const { query } = this.getQuery(params) // Extract only the query part from the parameters
    const { Model = this.options.Model } = params || {}

    // Start a new select query
    const q = Model.selectFrom(this.options.name as any)

    // Apply the WHERE conditions based on the query parameters
    const qWhere = this.applyWhere(q, query)

    // Select only the count of 'id', not all columns
    const countParams = Model.fn.count(this.id as any).as('total')
    return qWhere.select(countParams)
  }

  applyWhere<Q extends Record<string, any>>(q: Q, query: KyselyQuery<Result>) {
    // loop through params and call the where filters
    return Object.entries(query).reduce((q, [key, value]: any) => {
      if (['$and', '$or'].includes(key)) {
        return q.where((eb: any) => {
          return this.handleAndOr(eb, key, value)
        })
      } else if (_.isObject(value)) {
        // loop through OPERATORS and apply them
        const qOperators = Object.entries(OPERATORS).reduce((q, [operator, op]) => {
          if (value && Object.prototype.hasOwnProperty.call(value, operator)) {
            return q.where(key, op, value[operator])
          }
          return q
        }, q)
        return qOperators
      } else {
        return q.where(key, '=', value)
      }
    }, q)
  }

  handleAndOr(qb: any, key: string, value: KyselyQueryProperties<Result>[]) {
    const method = qb[key.replace('$', '')]
    const subs = value.map((subParams: KyselyQuery<Result>) => {
      return this.handleSubQuery(qb, subParams)
    })
    return method(subs)
  }

  handleSubQuery(eb: any, query: KyselyQuery<Result>): any {
    return eb.and(
      Object.entries(query).map(([key, value]: any) => {
        if (['$and', '$or'].includes(key)) {
          return this.handleAndOr(eb, key, value)
        } else if (_.isObject(value)) {
          // loop through OPERATORS and apply them
          return eb.and(
            Object.entries(OPERATORS)
              .filter(([operator, _op]) => {
                return value && Object.prototype.hasOwnProperty.call(value, operator)
              })
              .map(([operator, op]) => {
                const val = value[operator]
                return eb(key, op, val)
              })
          )
        } else {
          return eb(key, '=', value)
        }
      })
    )
  }

  applySort<Q extends SelectQueryBuilder<any, string, Record<string, any>>>(q: Q, filters: any) {
    return Object.entries(filters.$sort || {}).reduce(
      (q, [key, value]) => {
        return q.orderBy(key, value === 1 ? 'asc' : 'desc')
      },
      q as SelectQueryBuilder<any, string, Record<string, any>>
    )
  }

  /**
   * Add a returning statement alias for each key (bypasses bug in sqlite)
   * @param q kysely query builder
   * @param data data which is expected to be returned
   */
  applyReturning<Q extends DeleteOrInsertBuilder>(q: Q, keys: string[]) {
    return keys.reduce((q: any, key) => {
      return q.returning(`${key} as ${key}`)
    }, q.returningAll())
  }

  convertValues<D>(data: D) {
    if (this.options.dialectType !== 'sqlite') return data

    // convert booleans to 0 or 1 for SQLite
    return Object.entries(data as Record<string, any>).reduce((data, [key, value]) => {
      if (typeof value === 'boolean') return { ...data, [key]: value ? 1 : 0 }

      return data
    }, data)
  }

  async find(params: Params & { paginate: true }): Promise<Paginated<Result>>
  async find(params?: Params & { paginate?: false }): Promise<Result[]>
  async find(params?: Params & { paginate?: boolean }): Promise<Result[] | Paginated<Result>> {
    const { filters, query } = this.getQuery(params)
    const q = this.createQuery(this.options, filters, query)

    try {
      if (params?.paginate) {
        const countQuery: any = this.createCountQuery(params)
        const [queryResult, countQueryResult] = await Promise.all([q.execute(), countQuery.execute()])

        const data = filters.$limit === 0 ? [] : queryResult
        const total = Number.parseInt(countQueryResult[0].total)

        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data: data as Result[]
        }
      }
      const data = filters.$limit === 0 ? [] : await q.execute()
      return data as Result[]
    } catch (error) {
      throw errorHandler(error, params)
    }
  }

  async get(id: Id, params?: Params): Promise<Result> {
    const { filters, query } = this.getQuery(params) as any

    if (!id && id !== null && !query[this.id] && query[this.id] !== null)
      throw new NotFound(`No record found for id ${id}`)

    const idInQuery = query?.[this.id]
    if (id != null && idInQuery != null && id !== idInQuery) throw new NotFound()

    const q = this.startSelectQuery(this.options, filters)
    const qWhere = this.applyWhere(q, { [this.id]: id, ...query })
    try {
      const item = await qWhere.executeTakeFirst()

      if (!item) throw new NotFound(`No record found for ${this.id} '${id}'`)

      return item as Result
    } catch (error) {
      throw errorHandler(error, params)
    }
  }

  async create(data: Data[], params?: Params): Promise<Result[]>
  async create(data: Data, params?: Params): Promise<Result>
  async create(data: Data | Data[], params?: Params): Promise<Result[] | Result> {
    const idField: any = this.id
    const { Model = this.options.Model } = params || {}
    const { name } = this.options
    const { filters } = this.getQuery(params)
    const isArray = Array.isArray(data)
    const $select: any = filters.$select?.length ? filters.$select.concat(idField) : []

    const convertedData: any = isArray ? data.map((i) => this.convertValues(i)) : this.convertValues(data)
    const q = Model.insertInto(name as any).values(convertedData as any)

    const keys = isArray ? Object.keys(convertedData[0]) : Object.keys(convertedData)

    const qReturning = this.applyReturning(q, keys)

    const request = isArray ? qReturning.execute() : qReturning.executeTakeFirst()

    try {
      const response = await request
      const toReturn = filters.$select?.length
        ? isArray
          ? (response as Result[]).map((i: any) => _.pick(i, ...$select))
          : _.pick(response, ...$select)
        : response

      return toReturn as Result | Result[]
    } catch (error) {
      throw errorHandler(error, params)
    }
  }

  async update(id: Id, _data: UpdateData, params?: Params): Promise<Result> {
    if (id === null || Array.isArray(_data))
      throw new BadRequest("You can not replace multiple instances. Did you mean 'patch'?")

    const query: any = (params || {}).query
    const idInQuery = query?.[this.id]
    if (id != null && idInQuery != null && id !== idInQuery) throw new NotFound()

    const data = _.omit(_data, this.id)
    const oldData = await this.get(id, params)
    // New data changes all fields except id
    const newObject = Object.keys(oldData as any).reduce((result: any, key) => {
      if (key !== this.id) result[key] = data[key] === undefined ? null : data[key]

      return result
    }, {})

    const result = await this.patch(id, newObject, params)

    return result as Result
  }

  async patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  async patch(id: null, data: PatchData, params?: Params): Promise<Result[]>
  async patch(id: Id | null, _data: PatchData, params?: Params): Promise<Result[] | Result> {
    const asMulti = id === null
    const { name } = this.options
    const { filters, query } = this.getQuery(params) as any
    const $select = filters.$select?.length ? filters.$select.concat(this.id as any) : []
    const { Model = this.options.Model } = params || {}

    if (id != null && query[this.id] != null) throw new NotFound()

    const q = Model.updateTable(name as any).set(_.omit(_data, this.id))
    const qWhere = this.applyWhere(q, asMulti ? query : id == null ? query : { [this.id]: id, ...query })
    const toSelect = filters.$select?.length ? filters.$select : Object.keys(_data as any)
    const qReturning = this.applyReturning(qWhere, toSelect.concat(this.id))

    const request = asMulti ? qReturning.execute() : qReturning.executeTakeFirst()
    try {
      const response = await request

      if (!asMulti && !response) throw new NotFound(`No record found for ${this.id} '${id}'`)

      const toReturn = filters.$select?.length
        ? Array.isArray(response)
          ? response.map((i: any) => _.pick(i, ...$select))
          : _.pick(response, ...$select)
        : response

      return toReturn as Result | Result[]
    } catch (error) {
      throw errorHandler(error, params)
    }
  }

  async remove(id: Id, params?: Params): Promise<Result>
  async remove(id: null, params?: Params): Promise<Result[]>
  async remove(id: Id | null, params?: Params): Promise<Result[] | Result> {
    const originalData =
      id === null ? await this.find({ ...params, paginate: false }) : await this.get(id, params)
    const { name } = this.options
    const { Model = this.options.Model } = params || {}

    const q = Model.deleteFrom(name as any)
    const convertedQuery = this.convertValues(id === null ? params.query : { [this.id]: id })
    const qWhere = this.applyWhere(q as any, convertedQuery as any)
    const request = id === null ? qWhere.execute() : qWhere.executeTakeFirst()
    try {
      const result = await request

      if (!result) throw new NotFound(`No record found for id '${id}'`)

      return originalData as Result | Result[]
    } catch (error) {
      throw errorHandler(error, params)
    }
  }
}
