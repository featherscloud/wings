---
outline: deep
---

# Querying

All official database adapter support a common way for querying, sorting, limiting and selecting `find` and `get` method calls as part of `params.query`. Querying also applies `update`, `patch` and `remove` method calls.

<BlockQuote label="Note">

Depending on your framework, for queries made via REST URLs all query values will arrive strings and may need to be converted to the correct type.

</BlockQuote>

## Filters

Filters are special properties (starting with a `$`) added at the top level of a query. They can determine page settings, the properties to select and more.

### $limit

`$limit` will return only the number of results you specify:

```js
// Retrieves the first two unread messages
adapter.find({
  query: {
    $limit: 2,
    read: false
  }
})
```

<BlockQuote>

Perform a count query by setting `query.$limit` to `0`. This will only run a (fast) count query against the database and return a page object with the `total` and an empty `data` array.

</BlockQuote>

### $skip

`$skip` will skip the specified number of results:

```js
// Retrieves the next two unread messages
adapter.find({
  query: {
    $limit: 2,
    $skip: 2,
    read: false
  }
})
```

### $sort

`$sort` will sort based on the object you provide. It can contain a list of properties by which to sort mapped to the order (`1` ascending, `-1` descending).

```js
// Find the 10 newest messages
adapter.find({
  query: {
    $limit: 10,
    $sort: {
      createdAt: -1
    }
  }
})
```

### $select

`$select` allows to pick which fields to include in the result. This will work for any method.

```js
// Only return the `text` and `userId` field in a message
adapter.find({
  query: {
    $select: ['text', 'userId']
  }
})

adapter.get(1, {
  query: {
    $select: ['text']
  }
})
```

### $or

Find all records that match any of the given criteria.

```js
// Find all messages that are not marked as archived
// or any message from room 2
adapter.find({
  query: {
    $or: [{ archived: { $ne: true } }, { roomId: 2 }]
  }
})
```

### $and

Find all records that match all of the given criteria.

```js
// Find all messages that are not marked as archived and in room 2
adapter.find({
  query: {
    $and: [{ archived: { $ne: true } }, { roomId: 2 }]
  }
})
```

## Operators

Operators either query a property for a specific value or determine nested special properties (starting with a `$`) that allow querying the property for certain conditions. When multiple operators are set, all conditions have to apply for a property to match.

### Equality

All fields that do not contain special query parameters are compared directly for equality.

```js
// Find all unread messages in room #2
adapter.find({
  query: {
    read: false,
    roomId: 2
  }
})
```

### $in, $nin

Find all records where the property does (`$in`) or does not (`$nin`) match any of the given values.

```js
// Find all messages in room 2 or 5
adapter.find({
  query: {
    roomId: {
      $in: [2, 5]
    }
  }
})
```

### $lt, $lte

Find all records where the value is less (`$lt`) or less and equal (`$lte`) to a given value.

```js
// Find all messages older than a day
const DAY_MS = 24 * 60 * 60 * 1000

adapter.find({
  query: {
    createdAt: {
      $lt: new Date().getTime() - DAY_MS
    }
  }
})
```

```text
GET /messages?createdAt[$lt]=1479664146607
```

### $gt, $gte

Find all records where the value is more (`$gt`) or more and equal (`$gte`) to a given value.

```js
// Find all messages within the last day
const DAY_MS = 24 * 60 * 60 * 1000

adapter.find({
  query: {
    createdAt: {
      $gt: new Date().getTime() - DAY_MS
    }
  }
})
```

### $ne

Find all records that do not equal the given property value.

```js
// Find all messages that are not marked as archived
adapter.find({
  query: {
    archived: {
      $ne: true
    }
  }
})
```

## Search

Searching is not part of the common querying syntax since it is very specific to the database you are using. For built in databases, see the [SQL search](./knex.md#search) and [MongoDb search](./mongodb.md#search) documentation. If you are using a community-supported adapter, its documentation may contain additional information on how to implement search.