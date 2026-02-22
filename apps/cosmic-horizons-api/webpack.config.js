const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  resolve: {
    alias: {
      '@cosmic-horizons/event-models': join(
        __dirname,
        '../../libs/shared/event-models/src/index.ts',
      ),
      '@cosmic-horizons/shared': join(__dirname, '../../libs/shared/src'),
    },
    // ensure modules imported from libs/shared (or other packages) can
    // resolve workspace root dependencies like zod when pnpm uses a
    // flattened node_modules structure.
    modules: [join(__dirname, '../../node_modules'), 'node_modules'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
  ],
};
