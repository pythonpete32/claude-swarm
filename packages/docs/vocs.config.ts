import { defineConfig } from 'vocs'

export default defineConfig({
  // Basic Metadata
  title: 'Claude Swarm',
  titleTemplate: '%s – Claude Swarm Documentation',
  description: 'Multi-agent development environment for git worktrees, tmux sessions, and development workflows',
  baseUrl: 'https://claude-swarm.dev',
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
          text: 'Introduction',
          link: '/',
        },
        {
          text: 'Quick Start',
          link: '/getting-started',
        },
        {
          text: 'Installation',
          link: '/installation',
        },
      ],
    },
    {
      text: 'Core Concepts',
      items: [
        {
          text: 'Architecture Overview',
          link: '/concepts/architecture',
        },
        {
          text: 'Worktree Management',
          link: '/concepts/worktrees',
        },
        {
          text: 'Agent Isolation',
          link: '/concepts/agents',
        },
        {
          text: 'Tmux Integration',
          link: '/concepts/tmux',
        },
      ],
    },
    {
      text: 'CLI Reference',
      collapsed: false,
      items: [
        {
          text: 'Commands Overview',
          link: '/cli/overview',
        },
        {
          text: 'Project Setup',
          link: '/cli/setup',
        },
        {
          text: 'Task Management',
          link: '/cli/tasks',
        },
        {
          text: 'Cleanup Operations',
          link: '/cli/cleanup',
        },
      ],
    },
    {
      text: 'API Reference',
      collapsed: true,
      items: [
        {
          text: 'Core Modules',
          link: '/api/core',
        },
        {
          text: 'Workflows',
          link: '/api/workflows',
        },
        {
          text: 'Configuration',
          link: '/api/config',
        },
        {
          text: 'Error Handling',
          link: '/api/errors',
        },
      ],
    },
    {
      text: 'Guides',
      items: [
        {
          text: 'Custom Workflows',
          link: '/guides/custom-workflows',
        },
        {
          text: 'Testing Strategies',
          link: '/guides/testing',
        },
        {
          text: 'Extending Core',
          link: '/guides/extending',
        },
      ],
    },
    {
      text: 'Contributing',
      items: [
        {
          text: 'Development Setup',
          link: '/contributing/setup',
        },
        {
          text: 'Code Style',
          link: '/contributing/style',
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
      link: 'https://discord.gg/claude-swarm',
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
    '/': 'https://vocs.dev/api/og?logo=%logo&title=Claude%20Swarm&description=Multi-agent%20development%20environment',
    '/getting-started': 'https://vocs.dev/api/og?logo=%logo&title=Getting%20Started&description=Quick%20start%20guide%20for%20Claude%20Swarm',
    '/api/*': 'https://vocs.dev/api/og?logo=%logo&title=API%20Reference&description=%title',
    '/concepts/*': 'https://vocs.dev/api/og?logo=%logo&title=Core%20Concepts&description=%title',
  },

  // Font Configuration for better typography
  font: {
    google: 'Inter',
  },

  // Banner for important announcements
  banner: {
    dismissable: true,
    backgroundColor: '#3b82f6',
    content: '🚀 Claude Swarm v2.0 is now in beta! Try the new multi-agent workflows.',
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