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

import {
  type ComparisonOperatorExpression,
  type DeleteQueryBuilder,
  type DeleteResult,
  type InsertQueryBuilder,
  type InsertResult,
  type Kysely,
  type SelectQueryBuilder,
  type UpdateQueryBuilder,
  type UpdateResult,
  type Transaction,
  type TableExpression,
  type ReferenceExpression,
  sql
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
  $ne: '!=',
  $is: 'is',
  $isnot: 'is not',
  $regexp: 'regexp', // MySQL

  // PostgreSQL
  $ilike: 'ilike', // Postgres
  $notilike: 'not ilike', // Postgres
  $regex: '~',
  $iregex: '~*',
  $nregex: '!~',
  $niregex: '!~*',
  $search: '@@'
}

const searchOperators = ['$search', '$language', '$mode', '$rank']

export type SearchMode = 'full' | 'plain' | 'phrase' | 'web'

export type QuerySearchObject = {
  $search: string
  $language?: string
  $mode?: SearchMode
  $rank?: 0 | 1
}

// const CUSTOM_OPERATORS = {
//   $options: 'imnpqx'
// }

type DeleteOrInsertBuilder =
  | DeleteQueryBuilder<any, string, DeleteResult>
  | InsertQueryBuilder<any, string, InsertResult>
  | UpdateQueryBuilder<any, string, string, UpdateResult>

/**
 * Check if a string is a valid regex option for Postgres
 */
export function isValidPostgresRegexOption(option: string): boolean {
  return /^[imnpqx]*$/.test(option) && new Set(option).size === option.length
}

export interface KyselyOptions<Tables> extends AdapterOptions {
  Model: Kysely<Tables>
  /**
   * The table name
   */
  name: TableExpression<Tables, keyof Tables>
  dialectType?: 'sqlite'
  /**
   * The default full-text search settings for Postgres
   */
  search?: {
    /**
     * The language to use for the search. Defaults to 'english'
     */
    language?: string
    /**
     * The search mode to use. Defaults to 'web' Can be one of 'full', 'plain', 'phrase', or 'web'
     */
    mode?: SearchMode
    /**
     * Whether to include the rank in the `find` result and automatically sort results by rank. Defaults to true
     */
    rankByDefault?: boolean
    /**
     * The field to use for ranking. Defaults to 'rank'
     */
    rankField?: string
  }
}

export type LikeOperator = `${string}%` | `%${string}` | `%${string}%`

export type KyselyQueryProperty<Q> = {
  $like?: LikeOperator
  $notlike?: LikeOperator
  $ilike?: LikeOperator
  $notilike?: LikeOperator
  $is?: null
  $isnot?: null
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
  // Tables = unknown,
  Tables = { users: { id: number; name: string } },
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

    const searchOptions = {
      language: 'english',
      mode: 'web' as SearchMode,
      rankByDefault: true,
      rankField: 'rank',
      ...options.search
    }

    this.options = {
      id: 'id',
      ...options,
      search: searchOptions
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

  /**
   * Searches the Feathers query object for the first field with a $search operator.
   * If a second field with a $search operator is found, an error is thrown. Although Postgres
   * supports multiple fields with $search operators, this adapter does not.
   */
  getFirstSearchField(query: KyselyQuery<Result> = {}): string {
    let foundSearchField: string | null = null

    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null && '$search' in value) {
        if (foundSearchField) {
          const errorMessage =
            'More than one field with $search operator found. Only one is currently supported.'
          throw new BadRequest(errorMessage)
        }
        foundSearchField = key
      }
    }
    if (foundSearchField) {
      return foundSearchField
    }
    return null
  }

  /**
   * For full text search with Postgres, returns the name of the function to use based on the search mode.
   */
  getSearchFunction(query: QuerySearchObject) {
    const functionsByMode = {
      full: 'to_tsquery',
      plain: 'plainto_tsquery',
      phrase: 'phraseto_tsquery',
      web: 'websearch_to_tsquery'
    }
    const mode = query.$mode || this.options.search.mode
    const searchFunction = functionsByMode[mode]
    if (!searchFunction) {
      throw new BadRequest(`Invalid search mode: ${mode}`)
    }
    return searchFunction
  }

  /**
   * For full text search with Postgres, returns the language to use based on the query.
   */
  getSearchLanguage(query: QuerySearchObject) {
    return query.$language || this.options.search.language
  }

  /**
   * For full-text search, returns the name of the field to use for ranking based on the query.
   */
  getRankField(query: QuerySearchObject) {
    const shouldRank = Object.hasOwnProperty.call(query, '$rank') || this.options.search.rankByDefault
    return shouldRank ? this.options.search.rankField : null
  }

  createQuery(options: KyselyOptions<Tables>, filters: any, query: KyselyQuery<Result> = {}) {
    const q = this.startSelectQuery(options, filters)
    const qWhere = this.applyWhere(q as any, query)
    // if limit isn't provided but skip is, set limit to 10. Really, people should be specific in their query limit
    const qLimit = filters.$limit ? qWhere.limit(filters.$limit) : filters.$skip ? qWhere.limit(10) : qWhere
    const qSkip = filters.$skip ? qLimit.offset(filters.$skip) : qLimit
    const qSorted = this.applySort(qSkip as any, filters, query)
    return qSorted
  }

  startSelectQuery(options: KyselyOptions<Tables>, filters: any, query: KyselyQuery<Result> = {}) {
    const { name, id: idField, Model } = options
    const q = Model.selectFrom(name)

    // check if the query contains a $search operator
    const searchField = this.getFirstSearchField(query)
    const searchObj: QuerySearchObject = searchField ? (query as any)[searchField] : {}

    // if $select is provided, include the id field, otherwise select '*' for all fields
    const $select = filters.$select ? filters.$select.concat(idField) : ['*']

    // if $search is provided, and '*' is not already in the select statement, push the searchField to the select statement
    if (searchField && !$select.includes('*')) $select.push(searchField)

    // if $search is provided with $rank, include a virtual rank field in the select statement
    const rankField = this.getRankField(searchObj)
    if (rankField) {
      const searchFn = this.getSearchFunction(searchObj)
      const language = this.getSearchLanguage(searchObj)
      $select.push(
        sql<
          [{ rank: number }]
        >`ts_rank(${searchField}, ${searchFn}(${language}, ${searchObj.$search})) as ${rankField}`
      )
    }

    return filters.$select ? q.select(filters.$select.concat(idField)) : q.selectAll()
  }

  createCountQuery(params: Params) {
    const { query } = this.getQuery(params) // Extract only the query part from the parameters
    const { Model = this.options.Model } = params || {}

    // Start a new select query
    const q = Model.selectFrom(this.options.name)

    // Apply the WHERE conditions based on the query parameters
    const qWhere = this.applyWhere(q as any, query)

    // Select only the count of 'id', not all columns
    const countParams = Model.fn.count(this.id as any).as('total')
    return qWhere.select(countParams)
  }

  applyWhere<Q extends SelectQueryBuilder<Tables, keyof Tables, any>, KQ extends KyselyQuery<Result>>(
    q: Q,
    query: KQ
  ) {
    let result: SelectQueryBuilder<Tables, keyof Tables, any> = q

    const keys = Object.keys(query)
    for (let i = 0; i < keys.length; i++) {
      // lho = left hand operand
      const lho = keys[i] as ReferenceExpression<Tables, keyof Tables>
      const value = query[lho as keyof KQ] as any
      if (['$and', '$or'].includes(lho as string)) {
        result = result.where((eb: any) => {
          return this.handleAndOr(eb, lho as string, value)
        })
      } else if (_.isObject(value)) {
        // handle $search
        if (value.$search) {
          const searchObj = value as QuerySearchObject
          const searchField = lho as string
          const searchFn = this.getSearchFunction(searchObj)
          const language = this.getSearchLanguage(searchObj)

          result = result.where(
            sql`${searchField}`,
            '@@',
            sql`${searchFn}(${language}, ${searchObj.$search})`
          )
        }
        // handle non-search operators
        else {
          const entries = Object.entries(value)
          for (let j = 0; j < entries.length; j++) {
            const entryArr = entries[j]
            const $op = entryArr[0] // dollar-prefixed feathers query operator
            const rho = entryArr[1] // right hand operand
            const op = OPERATORS[$op] as ComparisonOperatorExpression // kysely operator
            if (op) {
              result = result.where(lho, op, rho)
            } else {
              const message = `Unknown query operator ${$op}. Valid operators are ${Object.keys(OPERATORS)}`
              throw new BadRequest(message)
            }
          }
        }
      } else {
        result = result.where(lho, '=', value)
      }
    }

    return result
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
          // TODO: Add support for $search in $and and $or
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

  applySort<Q extends SelectQueryBuilder<any, string, Record<string, any>>>(
    q: Q,
    filters: any = {},
    query: KyselyQuery<Result> = {}
  ) {
    const searchField = this.getFirstSearchField(query)
    const searchObject = searchField ? (query as any)[searchField] : {}
    const rankField = searchObject ? this.getRankField(searchObject) : null

    // if full text search is enabled, sort by descending rank, then any other provided sort fields
    const sortEntries = Object.entries(filters.$sort || {})
    if (rankField) {
      sortEntries.unshift([rankField, -1])
    }

    return sortEntries.reduce(
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
      const sql = await q.compile()
      console.log(sql)

      const data = filters.$limit === 0 ? [] : await q.execute()
      Object.assign(data, { sql })
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
    const qWhere = this.applyWhere(q as any, { [this.id]: id, ...query })
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
    const queryForRequest = asMulti ? query : id == null ? query : { [this.id]: id, ...query }
    const qWhere = this.applyWhere(q as any, queryForRequest as any)
    const toSelect = filters.$select?.length ? filters.$select : Object.keys(_data as any)
    const qReturning = this.applyReturning(qWhere as any, toSelect.concat(this.id))

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
