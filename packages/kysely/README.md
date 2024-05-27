# @wingshq/kysely

[![CI](https://github.com/wingshq/kysely/workflows/CI/badge.svg)](https://github.com/wingshq/wings/actions?query=workflow%3ACI)
[![Download Status](https://img.shields.io/npm/dm/@wingshq/kysely.svg?style=flat-square)](https://www.npmjs.com/package/@wingshq/kysely)
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

> A Wings adapter for Kysely

## Installation

```bash
$ npm install --save @wingshq/kysely
```

## Documentation

See [Wings kysely Adapter API documentation](https://wings.codes/adapters/kysely.html) for more details.

## License

Copyright (c) 2024 [Wings contributors](https://github.com/wingshq/wings/graphs/contributors)

Licensed under the [MIT license](LICENSE).


## Full Text Search

The `kysely` adapter supports full-text search (FTS) using the `$search` operator.  This operator allows you to perform full-text search queries on text columns in your database.  Here's an example of searching the `description_search` column for the term "search term". In this case, the `description_search` is a `tsvector` column that contains the vectorized content of the `description` column. See the section on "Preparing for Full Text Search" for more details on how to set up a `tsvector` column for FTS.

```ts
// $search operator in a nested object
const query = {
  other_field: 'value',
  description_search: {
    $search: 'search term',
    $language: 'english',
    $mode: 'full' | 'plain' | 'phrase' | 'web',
    $rank: -1 | 1
  },
};
```

The `$search` operator can be used together with these operators to create more complex queries:

- `$language` - The language to use for the full-text search.  The default is 'english'.
- `$mode` - The mode to use for the full-text search.  The default is 'full'.
- `$rank` - The rank threshold for the search.  The default is 0.

### Full-Text Search Modes

There are four modes for full-text search in Postgres.  The mode can be specified using the `$mode` option inside the `$search` query object.

- `full` - The "full" mode uses `to_tsquery('english', 'search term')`. This mode is the most flexible and performs a full-text search on the input text. It supports the full range of features provided by the full-text search engine, including stemming, ranking, and other advanced features.
- `plain` - The "plain" mode uses `plainto_tsquery('english', 'search term')`. It's useful for simple, unformatted text queries where you want to search for all the words provided. The input text is parsed into tokens, and those tokens are combined using the & (AND) operator, meaning all tokens must be present in the document for a match.
- `phrase` - The "phrase" mode uses `phraseto_tsquery('english', 'search term')`. This mode is useful when you want to search for an exact phrase in the input text. The input text is treated as a single token, and the search engine looks for that exact token in the document.
- `web` - The "websearch" mode uses `websearch_to_tsquery('english', 'search term')`. This mode is designed to work well with web search queries, where the input text is parsed into tokens and combined using the | (OR) operator, meaning any of the tokens can be present in the document for a match.

Each of these search modes serves different use cases, from the simplest (`plain`) for general word-based searches to the more complex and flexible (`full`) for boolean logic and (`web`) for web-like search expressions. These modes cater to a wide range of search needs, from basic to advanced, enabling PostgreSQL's Full Text Search to be highly versatile and powerful.

### Postgres Full Text Search

#### Preparing for Full Text Search

While Postgres can support dynamically doing FTS across multiple columns, this adapter only supports doing it the "correct" way, which is on an existing, indexed, `tsvector` column.

Suppose you have a text column in the database named `description`, and now you'd like to search it. To maximize performance, you should create a `tsvector` column and populate it with the "vectorized" content from the `description` column.

1. **Create the `tsvector` column**

You can add a `tsvector` column named `description_search` like this:

```SQL
ALTER TABLE articles ADD COLUMN "description_search" tsvector;
```

2. **Populate the column with initial data.**

Now populate the column with the content you want to search.  This example converts only the `description` column to a `tsvector` column.

```SQL
-- populate the tsvector column with the content from the description column
UPDATE articles 
SET description_search = to_tsvector('english', "description");
```

If you have some other TEXT column, for example `notes`, and you want to search both `description` and `notes`, you can concatenate them as shown in the next example.  Note that in Postgres the `||` operator is used to concatenate strings, similar to JavaScript's `+` operator.

```SQL
-- Update the tsvector column with content from both description and notes columns
UPDATE articles
SET description_search = to_tsvector('english', coalesce(description, '') || ' ' || coalesce(notes, ''));
```

This query combines description and notes into a single string, which is then converted into a tsvector. The `coalesce` function ensures that if either column is NULL, it's treated as an empty string, preventing errors during concatenation.

3. **Create an index on the `tsvector` column**

```SQL
-- create an index on the tsvector column
CREATE INDEX articles_description_search_idx ON articles USING gin(description_search);
```

In the above example, `gin` create a "Generalized Inverted Index", which is a type of index specifically designed to efficiently handle data types that can contain multiple values within a single field, such as arrays, jsonb, and tsvector types used in full text search.

The "inverted" nature of the index means that it stores a mapping from elements (like words in a tsvector) to their locations in the table. This is opposite to how a traditional index works, which maps from rows in a table to the values they contain. This structure is highly efficient for queries that need to check for the presence of elements within these complex data types.

### Step 4: Create a Trigger to Keep the `tsvector` Column Up-to-Date

To ensure the `tsvector` column (`description_search`) is automatically updated whenever the `description` column is inserted into or updated, follow these steps:

First, define a trigger function that updates the `tsvector` column using only the `description` column:

```SQL
CREATE OR REPLACE FUNCTION articles_description_update_trigger() RETURNS trigger AS $$
BEGIN
  NEW.description_search := to_tsvector('pg_catalog.english', NEW.description);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

This function takes the new value of the `description` column, vectorizes it using the English configuration, and assigns it to the `description_search` column.

Next, create the trigger using this function:

```SQL
CREATE TRIGGER articles_description_search_update
BEFORE INSERT OR UPDATE OF description ON articles
FOR EACH ROW EXECUTE FUNCTION articles_description_update_trigger();
```

This trigger fires before each insert or update operation on the `articles` table specifically for the `description` column. It ensures that the `description_search` tsvector column is kept up-to-date with the latest content of the `description` column, thereby maintaining the efficiency and accuracy of your full-text search capabilities.

If you have a combined `tsvector` column that includes multiple columns, you can create a similar trigger function and trigger for that column.  Here's how you'd handle the scenario where you have a `description_search` column that includes both the `description` and `notes` columns:

```SQL
CREATE OR REPLACE FUNCTION articles_description_notes_update_trigger() RETURNS trigger AS $$
BEGIN
  NEW.description_search := to_tsvector('english', coalesce(NEW.description, '') || ' ' || coalesce(NEW.notes, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

And the trigger function would look like this:

```SQL
DROP TRIGGER IF EXISTS articles_description_search_update ON articles;

CREATE TRIGGER articles_description_notes_search_update
BEFORE INSERT OR UPDATE OF description, notes ON articles
FOR EACH ROW EXECUTE FUNCTION articles_description_notes_update_trigger();
```

This revised trigger ensures that any insert or update affecting `description` or `notes` will update the `description_search` column, thus keeping your Full Text Search capability accurate and efficient across both text fields.

By following the above steps, you enable Full Text Search across multiple text columns in your PostgreSQL database, enhancing the searchability and accessibility of your data.


#### FTS Language support

When performing Full-Text Search (FTS), if you want to support multiple languages, you can repeat the process in the previous section using a different column and different language.  For example, to support both English and Spanish, you could create two columns, `description_search_en` and `description_search_es`, and populate them with the English and Spanish content, respectively.

You can check which languages are supported by running the following SQL command:

```SQL
SELECT * FROM pg_ts_cfg;
```

The output of the query `SELECT cfgname FROM pg_ts_config;` in PostgreSQL lists the names of available text search configurations, which correspond to the supported languages and configurations for full-text search. 

In a standard installation of a recent PostgreSQL version, you might expect to see entries such as:

- `simple` - basic tokenization without the complexities of linguistic processing
- `danish`
- `dutch`
- `english`
- `finnish`
- `french`
- `german`
- `hungarian`
- `italian`
- `norwegian`
- `portuguese`
- `russian`
- `spanish`
- `swedish`
- `turkish`

This list reflects common language configurations available for text processing, allowing for language-specific processing like stemming and stop word elimination. Note that the actual list can vary based on your PostgreSQL setup and any extensions or custom configurations that have been applied.

##### The `simple` configuration

The `simple` configuration is a basic text search configuration that does not perform any linguistic processing. It is useful for simple text search operations where you do not need to consider language-specific rules or stemming. The `simple` configuration is a good choice for cases where you want to search text without the overhead of more complex linguistic processing. The `simple` configuration splits the text into tokens based on whitespace and punctuation, treating the tokens as lexemes without further modification.