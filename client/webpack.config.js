const path = require("path")

const HtmlWebpackPlugin = require("html-webpack-plugin")
const CleanWebpackPlugin = require("clean-webpack-plugin")
const merge = require("webpack-merge")

const srcDir = path.resolve(__dirname, "src")
const distDir = path.resolve(__dirname, "dist")
const isLocal = env => env === "local"

module.exports = env => {
  const config = isLocal(env) ? localConfiguration : productionConfiguration
  return merge(commonConfiguration(env), config)
}

const localConfiguration = {
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    open: true,
    publicPath: "/",
    contentBase: distDir,
    compress: true,
    port: 8888,
    overlay: true,
    hot: true,
    watchOptions: {
      poll: true,
    },
    proxy: [{
      context: ["/api"],
      secure: false,
      changeOrigin: true,
      target: `https://radiator.${process.env.DOMAIN_NAME}`,
    }],
  },
}


// https://webpack.js.org/guides/production
const productionConfiguration = {
  mode: "production",
  devtool: "nosources-source-map",
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all'
        }
      }
    }
  },
  plugins: [
    new CleanWebpackPlugin(),
  ],
}

const commonConfiguration = env => {
  return {
    entry: {
      client: `${srcDir}/client.jsx`,
    },
    output: {
      filename: isLocal(env) ? "bundle.js" : "bundle.[contenthash].js",
      path: distDir
    },
    module: {
      rules: [
        {
          test: /\.jsx?/,
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: [
                  "@babel/preset-env",
                  "@babel/preset-react",
                ]
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            "css-loader",
          ],
          exclude: /node_modules/
        },
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: `${srcDir}/index.html`,
      })
    ],
  }
}
