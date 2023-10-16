---
outline: deep
---

# Memory Adapter

<Badges package-name="@wingshq/memory" />

`@wingshq/memory` is an adapter for in-memory data storage which works on all platforms. It is normally not used to store data on a production server but can be useful for data that isn't persistent and to e.g. cache data in browser or React Native applications.

```bash
npm install --save @wingshq/memory
```

<!--@include: ../snippets/note-common-adapter.md -->

## API

### Usage

```ts
import { MemoryAdapter } from '@wingshq/memory'

type Message = {
  id: number
  text: string
}
type MessageData = Pick<Message, 'text'>

const adapter = new MemoryAdapter<Message, MessageData>({})
```

### Options

The following options are available:

- `id` (_optional_, default: `'id'`) - The name of the id field property.
- `startId` (_optional_, default: `0`) - An id number to start with that will be incremented for every new record (unless it is already set).
- `Model` (_optional_) - An object with id to item assignments to pre-initialize the data store
- `matcher` (_optional_) - A function that returns true if the item matches the query. The default `matcher` is [sift](https://npmjs.com/package/sift).
- `sorter` (_optional_) - A function that sorts the items. The default `sorter` works as specified in the [common query syntax](./common-query-syntax).
