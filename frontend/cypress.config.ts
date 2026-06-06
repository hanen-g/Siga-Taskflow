import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
      // Skip global styles.scss (uses @/ alias that webpack dev server does not resolve by default).
      // Login brings its own login.css; enough for component isolation tests.
      options: {
        projectConfig: {
          root: '',
          sourceRoot: 'src',
          buildOptions: {
            outputPath: 'dist/cypress-out',
            index: 'cypress/support/component-index.html',
            styles: [],
            scripts: [],
          },
        },
      },
    },
    specPattern: 'cypress/component/**/*.cy.ts',
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
});
