const path = require('path');

module.exports = {
    entry: './functions/server.js',
    target: 'node',
    mode: 'production',
    output: {
        path: path.resolve(__dirname, 'functions-build'),
        filename: 'server.js',
        libraryTarget: 'commonjs2'
    },
    resolve: {
        fallback: {
            "buffer": require.resolve("buffer/"),
            "stream": require.resolve("stream-browserify")
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: 'babel-loader',
                exclude: /node_modules/
            }
        ]
    }
};
