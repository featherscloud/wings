import { defineConfig } from 'vitepress'
import { adaptersSidebar } from './sidebar.adapters'
import { databasesSidebar } from './sidebar.databases'
import { frameworksSidebar } from './sidebar.frameworks'

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: 'Wings',
	description: 'Connect to your data',
	themeConfig: {
		logo: '/wings-phoenix.svg',
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: 'Adapters', link: '/adapters/' },
			{ text: 'Databases', link: '/databases/' },
			{ text: 'Frameworks', link: '/frameworks/' },
		],

		sidebar: {
			'/adapters/': adaptersSidebar,
			'/databases/': databasesSidebar,
			'/frameworks/': frameworksSidebar,
		},

		socialLinks: [{ icon: 'github', link: 'https://github.com/vuejs/vitepress' }],
	},
})
