'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _randomstring = require('randomstring');

var _randomstring2 = _interopRequireDefault(_randomstring);

var _simpleOauth = require('simple-oauth2');

var _simpleOauth2 = _interopRequireDefault(_simpleOauth);

var _nodeFetch = require('node-fetch');

var _nodeFetch2 = _interopRequireDefault(_nodeFetch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = ({
    clientId,
    clientSecret,
    url,
    redirectUrl,
    userUrl,
    userMethod = 'GET',
    getUser = data => data.user,
    oauthOptions = {},
    redirectSuccessUrl,
    redirectErrorUrl,
    disableErrorReason = false,
    onSuccess = () => {},
    onError = () => {},
    logError = () => {}
}) => {
    // Initialize OAuth
    const oauth2 = _simpleOauth2.default.create((0, _extends3.default)({}, oauthOptions, {
        client: (0, _extends3.default)({
            id: clientId,
            secret: clientSecret
        }, oauthOptions.client),
        auth: (0, _extends3.default)({
            tokenHost: url
        }, oauthOptions.auth)
    }));

    // Define redirect error helper
    const redirectError = (ctx, reason) => ctx.redirect(disableErrorReason ? redirectErrorUrl : `${redirectErrorUrl}?error=${reason}`);

    // Login endpoint
    const login = (() => {
        var _ref = (0, _asyncToGenerator3.default)(function* (ctx) {
            try {
                // Generate state
                const state = _randomstring2.default.generate(32);
                ctx.session.state = state;

                // Store the redirect URL
                if (ctx.query.redirect) {
                    ctx.session.redirect = ctx.query.redirect;
                } else {
                    ctx.session.redirect = redirectSuccessUrl;
                }

                // Redirect to OAuth provider
                let params = {
                    redirect_uri: redirectUrl,
                    state: state
                };
                const scope = ctx.query.scope ? ctx.query.scope.split('+') : undefined;
                if (scope) {
                    params = (0, _extends3.default)({}, params, { scope });
                }
                const url = oauth2.authorizationCode.authorizeURL(params);
                ctx.redirect(url);
            } catch (err) {
                logError(err);
                return redirectError(ctx, 'unknown');
            }
        });

        return function login(_x) {
            return _ref.apply(this, arguments);
        };
    })();

    // Authorized endpoint
    const authorized = (() => {
        var _ref2 = (0, _asyncToGenerator3.default)(function* (ctx) {
            try {
                if (!ctx.query.code || !ctx.query.state || ctx.query.state !== ctx.session.state) {
                    const err = new Error('Invalid code or state');
                    logError(err);
                    return redirectError(ctx, 'invalid_code_or_state');
                }

                // Request access token
                const result = yield oauth2.authorizationCode.getToken({
                    redirect_uri: redirectUrl,
                    code: ctx.query.code
                });
                const accessToken = oauth2.accessToken.create(result);

                // Fetch user details
                const response = yield (0, _nodeFetch2.default)(`${userUrl}`, {
                    method: userMethod
                });
                if (response.ok) {
                    // Parse response
                    const data = yield response.json();

                    // Extract the user data from the reponse
                    const user = getUser(data);
                    if (!user || typeof user === 'string') {
                        const reason = typeof user === 'string' ? user : 'invalid_user';
                        const err = new Error(`Failed to extract user: ${reason}`);
                        logError(err, response);
                        return redirectError(ctx, reason);
                    }

                    // Login was successful, redirect to the original URL
                    ctx.session.user = user;
                    ctx.session.token = accessToken.token;
                    return ctx.redirect(ctx.session.redirect);
                } else {
                    // Login failed, redirect to the error page
                    const err = new Error('Failed to fetch user');
                    logError(err, response);
                    return redirectError(ctx, 'user_fetch_failed');
                }
            } catch (err) {
                logError(err);
                return redirectError(ctx, 'unknown');
            }
        });

        return function authorized(_x2) {
            return _ref2.apply(this, arguments);
        };
    })();

    const refreshToken = (() => {
        var _ref3 = (0, _asyncToGenerator3.default)(function* (ctx) {
            const tokenObject = oauth2.accessToken.create(ctx.session.token);
            const refreshToken = yield tokenObject.refresh({ client_id: clientId, client_secret: clientSecret });
            const response = yield (0, _nodeFetch2.default)(`${userUrl}`, {
                method: userMethod
            });
            const data = yield response.json();
            const user = getUser(data);
            ctx.session.user = user;
            ctx.session.token = refreshToken.token;
        });

        return function refreshToken(_x3) {
            return _ref3.apply(this, arguments);
        };
    })();

    // Whoami endpoint
    const whoami = (() => {
        var _ref4 = (0, _asyncToGenerator3.default)(function* (ctx) {
            try {
                // Check if the user is logged in and the token is still valid
                if (ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user) {
                    return onSuccess(ctx, ctx.session.user);
                } else {
                    const err = new Error('Not logged in');
                    logError(err);
                    return onError(ctx, 401, 'Not logged in', err);
                }
            } catch (err) {
                logError(err);
                return onError(ctx, 500, 'An unexpected error occurred', err);
            }
        });

        return function whoami(_x4) {
            return _ref4.apply(this, arguments);
        };
    })();

    // Logout endpoint
    const logout = (() => {
        var _ref5 = (0, _asyncToGenerator3.default)(function* (ctx) {
            try {
                // Delete stored access token and user details
                ctx.session.token = null;
                ctx.session.user = null;
                return onSuccess(ctx, null, 204);
            } catch (err) {
                logError(err);
                return onError(ctx, 500, 'An unexpected error occurred', err);
            }
        });

        return function logout(_x5) {
            return _ref5.apply(this, arguments);
        };
    })();

    // Is logged in middleware
    const isLoggedIn = (() => {
        var _ref6 = (0, _asyncToGenerator3.default)(function* (ctx, next) {
            ctx.state.isLoggedIn = function () {
                return ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user;
            };
            yield next();
        });

        return function isLoggedIn(_x6, _x7) {
            return _ref6.apply(this, arguments);
        };
    })();

    // Require login middleware
    const requireLogin = (() => {
        var _ref7 = (0, _asyncToGenerator3.default)(function* (ctx, next) {
            // Check if the user is logged in and the token is still valid
            if (ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user) {
                yield next();
            } else if (ctx.session.token && new Date() > new Date(ctx.session.token.expires_at) && ctx.session.user) {
                try {
                    yield refreshToken(ctx);
                    yield next();
                } catch (err) {
                    logError(err);
                    return onError(ctx, 500, 'Unable to refresh token, log in again', err);
                }
            } else {
                const err = new Error('Not logged in');
                logError(err);
                return onError(ctx, 401, 'Not logged in', err);
            }
        });

        return function requireLogin(_x8, _x9) {
            return _ref7.apply(this, arguments);
        };
    })();

    return {
        login,
        authorized,
        whoami,
        logout,
        isLoggedIn,
        requireLogin,
        refreshToken
    };
};