const { shouldTrackFlakes, numRetries, skipKnownFlakes } = require('../config')

const base = {
  // No flake tracking
  testRunner: 'jest-circus/runner',
}

const flakeTracking = {
  ...base,
  //globalSetup: require.resolve('./setup.global.js'),
  globals: {
    FLAKES: Map,
    RETRY_TIMES: numRetries,
    SKIP_FLAKES: skipKnownFlakes,
  },
  setupFilesAfterEnv: [require.resolve('./setup.js')],
}

const nodeFlakeTracking = shouldTrackFlakes
  ? {
      ...flakeTracking,
      testEnvironment: require.resolve('./environments/node'),
    }
  : {
      ...base,
      testEnvironment: 'node',
    }

const jsdomFlakeTracking = shouldTrackFlakes
  ? {
      ...flakeTracking,
      testEnvironment: require.resolve('./environments/jsdom'),
    }
  : {
      ...base,
      testEnvironment: 'jsdom',
    }

const detoxFlakeTracking = shouldTrackFlakes
  ? {
      ...flakeTracking,
      testEnvironment: require.resolve('./environments/detox'),
    }
  : {
      ...base,
      testEnvironment: 'node',
    }

module.exports = {
  nodeFlakeTracking: nodeFlakeTracking,
  jsdomFlakeTracking: jsdomFlakeTracking,
  detoxFlakeTracking: detoxFlakeTracking,
}