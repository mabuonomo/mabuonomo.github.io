const path = require('path');
const Dotenv = require('dotenv-webpack');
const TerserPlugin = require('terser-webpack-plugin');

const isProd = process.env.NODE_ENV === 'prod';

let defaultConfig = {
  watch: !isProd,
  entry: {
    botkit: './src/botkit.ts',
  },
  output: {
    library: 'Botkit',
    libraryTarget: 'assign',
    path: path.resolve(__dirname, `dist/${process.env.NODE_ENV}`),
    filename: `[name].js`,
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: 'ts-loader',
            options: { allowTsInNodeModules: true },
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          'style-loader',
          // Translates CSS into CommonJS
          'css-loader',
          // Compiles Sass to CSS
          'sass-loader',
        ],
      },
    ],
  },
  resolve: {
    alias: {
      node_modules: path.join(__dirname, 'node_modules'),
    },
    extensions: ['.ts', '.tsx', '.js'],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_debugger: isProd,
          },
          output: {
            comments: false,
          },
        },
      }),
    ],
  },
};

module.exports = [defaultConfig];
