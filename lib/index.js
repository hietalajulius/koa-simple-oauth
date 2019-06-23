'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _middleware = require('./middleware');

var _middleware2 = _interopRequireDefault(_middleware);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const defaultConfig = {
    onSuccess: (ctx, status = 200, data = null) => {
        ctx.status = status;
        ctx.body = typeof data === 'object' ? (0, _stringify2.default)(data) : data;
    },
    onError: (ctx, status, message) => {
        ctx.status = status;
        ctx.body = message;
    }
};

exports.default = (_ref, router) => {
    let {
        routes: {
            login = '/login',
            authorized = '/authorized',
            whoami = '/whoami',
            logout = '/logout'
        } = {}
    } = _ref,
        config = (0, _objectWithoutProperties3.default)(_ref, ['routes']);

    // Create middleware
    const middleware = (0, _middleware2.default)((0, _assign2.default)({}, defaultConfig, config));

    // Return the raw middleware if no router is present
    if (!router) {
        return middleware;
    }

    // Register middleware and return any results
    return {
        login: router.get(login, middleware.login),
        authorized: router.get(authorized, middleware.authorized),
        whoami: router.get(whoami, middleware.whoami),
        logout: router.get(logout, middleware.logout),
        isLoggedIn: middleware.isLoggedIn,
        requireLogin: middleware.requireLogin
    };
};