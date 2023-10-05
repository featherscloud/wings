export const adaptersSidebar = [
	{ text: 'Adapters Overview', link: '/adapters/' },
	{ text: 'Database Adapter Consulting', link: '/adapters/consulting' },
	{
		text: 'Database Adapters',
		items: [
			{ text: 'Sequelize', link: '/adapters/sequelize' },
			{ text: 'Knex', link: '/adapters/knex' },
			{ text: 'Kysely', link: '/adapters/kysely' },
			{ text: 'Cassandra', link: '/adapters/cassandra' },
			{ text: 'Memory', link: '/adapters/memory' },
			{ text: 'Elastic Search', link: '/adapters/elastic-search' },
			{ text: 'RethinkDB', link: '/adapters/rethinkdb' },
			{ text: 'NeDB', link: '/adapters/nedb' },
			{ text: 'Objection', link: '/adapters/objection' },
			{ text: 'Prisma', link: '/adapters/prisma' },
			{ text: 'Mongoose', link: '/adapters/mongoose' },
			{ text: 'MongoDB', link: '/adapters/mongodb' },
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
