export interface PaginationOptions {
  default?: number
  max?: number
}

export type PaginationParams = false | PaginationOptions

export type Id = number | string
export type NullableId = Id | null

export interface Query {
  [key: string]: any
}

/**
 * The object returned from `.find` call by standard database adapters
 */
export interface Paginated<T> {
  total: number
  limit: number
  skip: number
  data: T[]
}

export interface AdapterServiceOptions {
  /**
   * The name of the id property
   */
  id?: string
  /**
   * Pagination settings for this service
   */
  paginate?: PaginationParams
}

export interface AdapterQuery extends Query {
  $limit?: number
  $skip?: number
  $select?: string[]
  $sort?: { [key: string]: 1 | -1 }
}

/**
 * Additional `params` that can be passed to an adapter service method call.
 */
export interface AdapterParams<A extends Partial<AdapterServiceOptions> = Partial<AdapterServiceOptions>> {
  adapter?: A
  paginate?: PaginationParams
}

export interface AdapterService<
  Params,
  Result,
  Data = Partial<Result>,
  PatchData = Partial<Data>,
  UpdateData = Data
> {
  find(params?: Params): Promise<Paginated<Result>>
  find(params?: Params & { paginate: false }): Promise<Result[]>

  get(id: Id, params?: Params): Promise<Result>

  create(data: Data[], params?: Params): Promise<Result[]>
  create(data: Data, params?: Params): Promise<Result>

  update(id: Id, data: UpdateData, params?: Params): Promise<Result>

  patch(id: NullableId, data: PatchData, params?: Params): Promise<Result | Result[]>
  patch(id: Id, data: PatchData, params?: Params): Promise<Result>
  patch(id: null, data: PatchData, params?: Params): Promise<Result[]>

  remove(id: NullableId, params?: Params): Promise<Result | Result[]>
  remove(id: Id, params?: Params): Promise<Result>
  remove(id: null, params?: Params): Promise<Result[]>
}
