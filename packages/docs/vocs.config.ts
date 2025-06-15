import { defineConfig } from 'vocs'

export default defineConfig({
  // Basic Metadata
  title: 'Claude Codex',
  titleTemplate: '%s – Claude Codex Documentation',
  description: 'Local AI Agent Orchestration Platform for Software Development - Transform developers into orchestrators of AI agent teams',
  baseUrl: 'https://claude-codex.dev',
  rootDir: 'docs',

  // Branding
  logoUrl: '/logo.svg',
  iconUrl: '/favicon.ico',

  // Navigation Structure
  sidebar: [
    {
      text: 'Getting Started',
      items: [
        {
          text: 'What is Claude Codex?',
          link: '/what-is-claude-codex',
        },
        {
          text: 'Installation',
          link: '/installation',
        },
        {
          text: 'Quick Start',
          link: '/getting-started',
        },
      ],
    },
    {
      text: 'User Guide',
      items: [
        {
          text: 'Overview',
          link: '/user-guide',
        },
      ],
    },
    {
      text: 'Agent Types',
      items: [
        {
          text: 'Overview',
          link: '/agents',
        },
        {
          text: 'Planning Agents',
          link: '/agents/planning',
        },
      ],
    },
    {
      text: 'Workflows',
      items: [
        {
          text: 'Overview',
          link: '/workflows',
        },
        {
          text: 'Development Workflow',
          link: '/workflows/development',
        },
      ],
    },
    {
      text: 'Architecture',
      items: [
        {
          text: 'Overview',
          link: '/concepts',
        },
        {
          text: 'System Architecture',
          link: '/concepts/architecture',
        },
      ],
    },
    {
      text: 'API Reference',
      collapsed: true,
      items: [
        {
          text: 'Overview',
          link: '/api',
        },
        {
          text: 'Core API',
          link: '/api/core',
        },
      ],
    },
    {
      text: 'Troubleshooting',
      items: [
        {
          text: 'Common Issues',
          link: '/troubleshooting/common-issues',
        },
      ],
    },
    {
      text: 'Contributing',
      items: [
        {
          text: 'Overview',
          link: '/contributing',
        },
        {
          text: 'Documentation',
          link: '/contributing/docs',
        },
      ],
    },
  ],

  topNav: [
    { 
      text: 'Documentation', 
      link: '/getting-started', 
      match: '/(?!(playground|blog)).*' 
    },
    { 
      text: 'Playground', 
      link: '/playground' 
    },
    { 
      text: 'Blog', 
      link: '/blog' 
    },
  ],

  // Social Links
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/pythonpete32/claude-swarm',
    },
    {
      icon: 'discord',
      link: 'https://discord.gg/claude-codex',
    },
  ],

  // Theming
  theme: {
    accentColor: {
      light: '#3b82f6',
      dark: '#60a5fa',
    },
    colorScheme: 'system',
  },

  // Search Configuration
  search: {
    boostDocument(documentId) {
      // Boost core documentation pages
      if (documentId.includes('/concepts/') || documentId.includes('/getting-started')) {
        return 2
      }
      // Boost API reference less
      if (documentId.includes('/api/')) {
        return 0.5
      }
      return 1
    }
  },

  // OG Images - Dynamic generation for better social sharing
  ogImageUrl: {
    '/': 'https://vocs.dev/api/og?logo=%logo&title=Claude%20Codex&description=Local%20AI%20Agent%20Orchestration%20Platform',
    '/getting-started': 'https://vocs.dev/api/og?logo=%logo&title=Getting%20Started&description=Quick%20start%20guide%20for%20Claude%20Codex',
    '/api/*': 'https://vocs.dev/api/og?logo=%logo&title=API%20Reference&description=%title',
    '/concepts/*': 'https://vocs.dev/api/og?logo=%logo&title=Architecture&description=%title',
  },

  // Font Configuration for better typography
  font: {
    google: 'Inter',
  },

  // Banner for important announcements
  banner: {
    dismissable: true,
    backgroundColor: '#3b82f6',
    content: '🤖 Claude Codex: Transform from code writer to AI team orchestrator!',
  },

  // Sponsors section (can be populated later)
  sponsors: [
    // {
    //   name: 'Your Company',
    //   src: '/sponsors/company-logo.png',
    //   href: 'https://company.com',
    // },
  ],

  // Vite configuration for advanced features
  vite: {
    build: { 
      minify: 'esbuild', // Use esbuild instead of terser for better performance
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  },

  // TypeScript Twoslash for better code examples
  twoslash: {
    compilerOptions: {
      strict: true,
      target: 99, // ES2022
      module: 99, // ESNext
      moduleResolution: 100, // bundler
    },
  },
})