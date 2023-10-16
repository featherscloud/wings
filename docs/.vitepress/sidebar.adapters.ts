export const adaptersSidebar = [
	{ text: 'Adapters Overview', link: '/adapters/' },
	{ text: 'Database Adapter Consulting', link: '/adapters/consulting' },
	{
		text: 'Common API',
		items: [
			{ text: 'Adapter Classes', link: '/adapters/common-api' },
			{ text: 'Query Syntax', link: '/adapters/common-query-syntax' },
		]
	},
	{
		text: 'Database Adapters',
		items: [
			{ text: 'Cassandra', link: '/adapters/cassandra' },
			{ text: 'Elastic Search', link: '/adapters/elastic-search' },
			{ text: 'Knex', link: '/adapters/knex' },
			{ text: 'Kysely', link: '/adapters/kysely' },
			{ text: 'Memory', link: '/adapters/memory' },
			{ text: 'Mongoose', link: '/adapters/mongoose' },
			{ text: 'MongoDB', link: '/adapters/mongodb' },
			{ text: 'NeDB', link: '/adapters/nedb' },
			{ text: 'Objection', link: '/adapters/objection' },
			{ text: 'Prisma', link: '/adapters/prisma' },
			{ text: 'RethinkDB', link: '/adapters/rethinkdb' },
			{ text: 'Sequelize', link: '/adapters/sequelize' }
		],
	},
	{
		text: 'Mail Adapters',
		items: [
			{ text: 'Mailer', link: '/adapters/mailer' },
			{ text: 'Postmark', link: '/adapters/postmark' },
		],
	},
	{
		text: 'API Adapters',
		items: [
			{ text: 'LocalStorage', link: '/adapters/localstorage' },
			{ text: 'MessageBird', link: '/adapters/messagebird' },
			{ text: 'Stripe', link: '/adapters/stripe' },
			{ text: 'Unsplash', link: '/adapters/unsplash' },
		],
	},
	{
		text: 'Community Adapters',
		items: [
			{
				text: 'Community Maintained',
				link: '/adapters/community-maintained',
			},
		],
	},
]
