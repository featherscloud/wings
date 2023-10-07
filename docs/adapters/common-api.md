---
outline: deep
---

# Common API

All database adapters implement a common interface for initialization, pagination, extending and querying. This page describes the common adapter initialization and options, how to enable and use pagination, the details on how specific service methods behave and how to extend an adapter with custom functionality.

## Initialization

### `new <Name>Adapter(options)`

Each adapter exports a `<Name>Adapter` class that can be exported and extended. Here's an example that uses the MemoryAdapter.

```ts
import { MemoryAdapter } from '@wingshq/memory'

const adapter = new NameAdapter()
```

See the other adapters for their specific initialization instructions.

### Options

The following options are available for all database adapters:

- `id {string}` (_optional_) - The name of the id field property (usually set by default to `id` or `_id`).

For database-specific options see each adapter's documentation.

### TypeScript Generics

All adapters are written in TypeScript and support generics. The following generic types are available:

- `Result` - The type of the result returned by the adapter's methods.
- `Data` - The type of the data allowed during `create`. Optional. Defaults to `Partial<Result>`.
- `PatchData` - The type of the data allowed for `patch`. Optional. Defaults to `Partial<Data>`.
- `UpdateData` - The type of the data allowed for `update`. Optional. Defaults to `Data`.

For basic typing, you only need to specify the `Result` type. If create requires a different type, though, you can provide that explicitly. The same goes for the other two generics. For example, this is how you would specify the types for a `Message` service which only accepts the `text` property for `create` :

```ts
import { MemoryAdapter } from '@wingshq/memory'

type Message = {
  id: number
  text: string
}
type MessageData = Pick<Message, 'text'>

const adapter = new MemoryAdapter<Message, MessageData>({})
```

## Adapter Methods

This section describes the methods implemented for all adapters.

### constructor(options)

Initializes a new service. Should call `super(options)` when overridden.

```ts
import { MemoryAdapter } from '@wingshq/memory'

class CustomMemoryAdapter extends MemoryAdapter {
  constructor(options) {
    super(options)
    // custom constructor code
  }
}

const adapter = new CustomMemoryAdapter()
```

### find(params)

`adapter.find(params) -> Promise` returns a list of all records matching the query in `params.query` using the [common querying syntax](./common-query-language.md). Will either return an array with the results or a page object if [pagination is enabled for the query](#pagination).

```ts
// Find all messages for userId 1
const messages = await adapter.find({
  query: { userId: 1 }
})

console.log(messages)

// Find all messages belonging to room 1 or 3
const roomMessages = await adapter.find({
  query: {
    roomId: { $in: [1, 3] }
  }
})

console.log(roomMessages)
```

### get(id, params)

`adapter.get(id, params) -> Promise` retrieves a single record by its unique identifier (the field set in the `id` option during [initialization](#initialization)).

```ts
const message = await adapter.get(1)

console.log(message)
```

### create(data, params)

`adapter.create(data, params) -> Promise` creates a new record with `data`. `data` can also be an array to create multiple records.

```ts
const message = await adapter.create({
  text: 'A test message'
})

console.log(message)

const messages = await adapter.create([
  { text: 'Hi' },
  { text: 'How are you' }
])

console.log(messages)
```

### update(id, data, params)

`adapter.update(id, data, params) -> Promise` completely replaces a single record identified by `id` with `data`. It does not allow replacing multiple records (`id` can't be `null`). `id` cannot be changed.

```ts
const updatedMessage = await adapter.update(1, {
  text: 'Updates message'
})

console.log(updatedMessage)
```

### patch(id, data, params)

`adapter.patch(id, data, params) -> Promise` merges a record identified by `id` with `data`. `id` can be `null` to allow patching multiple records (all records that match `params.query` the same as querying with `.find`). The `id` cannot be changed.

```ts
const patchedMessage = await adapter.patch(1, {
  text: 'A patched message'
})

console.log(patchedMessage)


// Mark all unread messages as read
const data = { read: true }
const params = {
  query: { read: false }
}
const multiPatchedMessages = await adapter.patch(null, data, params)
```

### remove(id, params)

`adapter.remove(id, params) -> Promise` removes a record identified by `id`. `id` can be `null` to allow removing multiple records (all records that match `params.query` the same as querying with `.find`).

```ts
const removedMessage = await adapter.remove(1)

console.log(removedMessage)


// Remove all read messages
const params = {
  query: { read: true }
}
const removedMessages = await adapter.remove(null, params)
```

## Pagination

All database adapters support retrieving "pages" of results. This section will explain the various ways to retrieve paginated results in each request.

### query.$limit and query.$skip

Two special query properties control the page size. Use the `$limit` and `$skip` query properties to control the number of results returned in the array response.

Just as with making queries directly with a database driver, the [find method](#findparams) returns all records that match the provided query. This means that queries without conditions will return all records in the database. In the following example, since neither contains any filtering conditions, the following two queries are equivalent:

```ts
const messages = await adapter.find()
const messages = await adapter.find({ query: {} })

console.log(messages) // --> [/* all messages */]
```

You can retrieve a single page of results by setting `query.$limit` to the number of items you want to retrieve. For example:

```ts
// Get the first 10 messages
const messages = await adapter.find({
  query: {
    $limit: 10
  }
})

console.log(messages) // --> [/* first 10 messages */]
```

And subsequent pages can be retrieved by setting `query.$skip` to the number of items you want to skip. For example:

```ts
// Get the second page of 10 messages
const messages = await adapter.find({
  query: {
    $limit: 10,
    $skip: 10
  }
})

console.log(messages) // --> [/* second 10 messages */]
```

### params.paginate

Use `params.paginate = true` to return a pagination object instead of an array. The object will have the following shape:

```ts
interface Paginated<T> {
  data: T[]
  total: number
  limit: number
  skip: number
}
```

Here's more detail about each property:

- `data` will be the array of records that match the query conditions, including `$skip` and `$limit`.
- `total` will be the total number of records that match the query conditions (ignoring `$skip` and `$limit`).
- `limit` will match the `$limit` from the query.
- `skip` will match the `$skip` from the query.

The `$limit` and `$skip` in the query behave the same as for queries without `parmas.paginate`: Making a request with no conditions will return all records in the database. For example, the following two queries are equivalent:

```ts
const messages = await adapter.find({
  paginate: true,
  query: {}
})
const messages = await adapter.find({
  paginate: true,
})

console.log(messages) // --> { total: 1411, limit: null, skip: 0, data: [/* all 1411 messages */] }
```

Note the following about queries made without `$limit` and `$skip`:

- The response will return all of the records in the database that match the conditions. Since none were provided in the above examples, the response included all 1411 records.
- Since no `$limit` is set, the response's `limit` will be `null`.
- Since no `$skip` was set, the response's `skip` will be `0`.

<BlockQuote type="info" label="note">

When using `params.paginate` an extra request is made to count the total number of records that match the query conditions. As always for performance, make sure all queries match an index.

For most datasets the extra count query is not an issue. For decently large datasets, consider the following strategy to avoid the extra count query:

- Perform a separate `find` with `query.$limit` set to `0`, which will perform a count request for the query.
- Use the same query to `find` with `$limit` and `$skip` set to the desired page size.
- Do not enable `params.paginate` for the request.

For extremely large datasets, consider not showing the total number of records in the UI to avoid the need for a count query.

</BlockQuote>

### $limit: 0 to count

With `paginate: true`, You can set `query.$limit` to `0` to perform a count of the total number of records that match the query conditions. Count queries always return a `Paginated` object. For example:

```ts
// Get the total number of messages
const messages = await adapter.find({
  query: { $limit: 0 },
  paginate: true
})

console.log(messages) // --> { total: 1411, limit: 0, skip: 0, data: [] }
```

<BlockQuote type="info" label="note">

If you forget to set `paginate: true` when using `$limit: 0`, the query will return an empty array.

</BlockQuote>

## Extending Adapters

You can customize adapters by extending the base class. Here's an example that extends the `MemoryAdapter`:

```ts
import { MemoryAdapter } from '@wingshq/memory'

class CustomMemoryAdapter extends MemoryAdapter {
  // Add a custom method
  async customMethod() {
    // ...
  }
}

const adapter = new CustomMemoryAdapter()

// Use the custom method
adapter.customMethod()
```
