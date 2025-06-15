import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Claude Codex',
  description: 'Multi-agent development environment',
  sidebar: [
    {
      text: 'Introduction',
      link: '/introduction',
    },
    {
      text: 'Getting Started',
      link: '/getting-started',
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        {
          text: 'Core',
          link: '/api/core',
        },
        {
          text: 'CLI',
          link: '/api/cli',
        },
      ],
    },
  ],
})