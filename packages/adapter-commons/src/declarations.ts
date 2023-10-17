export type Id = number | string
export type NullableId = Id | null

/**
 * The object returned from `.find` call by standard database adapters
 */
export interface Paginated<T> {
  total: number
  limit: number
  skip: number
  data: T[]
}

export interface AdapterOptions {
  /**
   * The name of the id property
   */
  id: string
}

/**
 * The standard interface for an adapter query
 */
export type AdapterQuery<O> = {
  $limit?: number
  $skip?: number
  $select?: (keyof O)[]
  $sort?: { [k in keyof O]?: 1 | -1 }
  $or?: QueryProperties<O>[] | readonly QueryProperties<O>[]
  $and?: QueryProperties<O>[] | readonly QueryProperties<O>[]
} & QueryProperties<O>

/**
 * Standard properties for querying an individual property
 */
export type QueryProperty<T> = {
  $in?: T[]
  $nin?: T[]
  $lt?: T
  $lte?: T
  $gt?: T
  $gte?: T
  $ne?: T
}

/**
 * Standard interface for querying multiple properties
 */
export type QueryProperties<O> = {
  [k in keyof O]?: O[k] | QueryProperty<O[k]>
}

/**
 * Additional `params` that can be passed to an adapter service method call.
 */
export interface AdapterParams<Q> {
  query?: Q
}

export interface AdapterInterface<
  Result = unknown,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Result,
  Options extends AdapterOptions = AdapterOptions,
  Params = AdapterParams<any>
> {
  id: string
  options: Options

  find(params?: Params & { paginate?: false }): Promise<Result[]>
  find(params: Params & { paginate: true }): Promise<Paginated<Result>>

  get(id: Id, params?: Params): Promise<Result>

  create(data: Data[], params?: Params): Promise<Result[]>
  create(data: Data, params?: Params): Promise<Result>

  update(id: Id, data: UpdateData, params?: Params): Promise<Result>

  patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  patch(id: null, data: PatchData, params?: Params): Promise<Result[]>

  remove(id: Id, params?: Params): Promise<Result>
  remove(id: null, params?: Params): Promise<Result[]>
}
