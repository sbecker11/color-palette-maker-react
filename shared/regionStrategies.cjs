/**
 * Region detection strategy constants. Shared by client and server.
 */

const VALID_STRATEGIES = ['default', 'adaptive', 'otsu', 'canny', 'color', 'watershed'];

const STRATEGIES_WITH_PARAMS = ['adaptive', 'canny', 'color', 'watershed'];

module.exports = { VALID_STRATEGIES, STRATEGIES_WITH_PARAMS };
