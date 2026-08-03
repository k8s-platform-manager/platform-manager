// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	site: 'https://k8s-platform-manager.github.io',
	base: '/platform-manager',
	integrations: [
		mermaid({
			theme: 'neutral',
			autoTheme: true,
		}),
		starlight({
			title: 'Platform Manager',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/k8s-platform-manager/platform-manager',
				},
			],
			sidebar: [
				{
					label: 'Requests for Comments',
					items: [{ autogenerate: { directory: 'rfcs' } }],
				},
			],
		}),
	],
});
