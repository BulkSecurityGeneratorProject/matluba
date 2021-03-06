'use strict';

/* Services */

shopstuffsApp.factory('LanguageService', function ($http, $translate, LANGUAGES) {
        return {
            getBy: function(language) {
                if (language == undefined) {
                    language = $translate.storage().get('NG_TRANSLATE_LANG_KEY');
                }
                if(language==undefined) {
                    language = 'en';
                }

                var promise =  $http.get('/i18n/' + language + '.json').then(function(response) {
                    return LANGUAGES;
                });
                return promise;
            }
        };
    });

shopstuffsApp.factory('Register', function ($resource) {
        return $resource('app/rest/register', {}, {
        });
    });

shopstuffsApp.factory('Activate', function ($resource) {
        return $resource('app/rest/activate', {}, {
            'get': { method: 'GET', params: {}, isArray: false}
        });
    });

shopstuffsApp.factory('Account', function ($resource) {
        return $resource('app/rest/account', {}, {
        });
    });

shopstuffsApp.factory('Password', function ($resource) {
        return $resource('app/rest/account/change_password', {}, {
        });
    });

shopstuffsApp.factory('Sessions', function ($resource) {
        return $resource('app/rest/account/sessions/:series', {}, {
            'get': { method: 'GET', isArray: true}
        });
    });

shopstuffsApp.factory('MetricsService',function ($resource) {
        return $resource('metrics/metrics', {}, {
            'get': { method: 'GET'}
        });
    });

shopstuffsApp.factory('ThreadDumpService', function ($http) {
        return {
            dump: function() {
                var promise = $http.get('dump').then(function(response){
                    return response.data;
                });
                return promise;
            }
        };
    });

shopstuffsApp.factory('HealthCheckService', function ($rootScope, $http) {
        return {
            check: function() {
                var promise = $http.get('health').then(function(response){
                    return response.data;
                });
                return promise;
            }
        };
    });

shopstuffsApp.factory('LogsService', function ($resource) {
        return $resource('app/rest/logs', {}, {
            'findAll': { method: 'GET', isArray: true},
            'changeLevel':  { method: 'PUT'}
        });
    });

shopstuffsApp.factory('AuditsService', function ($http) {
        return {
            findAll: function() {
                var promise = $http.get('app/rest/audits/all').then(function (response) {
                    return response.data;
                });
                return promise;
            },
            findByDates: function(fromDate, toDate) {
                var promise = $http.get('app/rest/audits/byDates', {params: {fromDate: fromDate, toDate: toDate}}).then(function (response) {
                    return response.data;
                });
                return promise;
            }
        }
    });
shopstuffsApp.factory('AppStorage', [ '$window', function ($window) {
        var appStorages = {};
        var api = undefined;

        if ($window.localStorage) {
            api = {
                set: function (name, value) {
                    $window.localStorage.setItem(name, JSON.stringify(value));
                },
                get: function (name) {
                    var str = $window.localStorage.getItem(name);
                    var val = {};
                    try {
                        val = str ? JSON.parse(str) : {};
                    }
                    catch (e) {
                        console.log('Parse error for localStorage ' + name);
                    }
                    return val;
                },
                clear: function () {
                    $window.localStorage.clear();
                }
            };
        }
        // possibly support other

        if (!api) {
            throw new Error('Could not find suitable storage');
        }

        return function (appName, property, scope) {
            if (appName === undefined) {
                throw new Error('appName is required');
            }

            var appStorage = appStorages[appName];

            var update = function () {
                api.set(appName, appStorage);
            };

            var clear = function () {
                api.clear(appName);
            };

            if (!appStorage) {
                appStorage = api.get(appName);
                appStorages[appName] = appStorage;
                update();
            }

            var bind = function (property, scope) {
                scope[property] = appStorage;
                scope.$watch(property, function () {
                    update();
                }, true);
            };

            if (property !== undefined && scope !== undefined) {
                bind(property, scope);
            }

            return {
                get: function (name) {
                    return appStorage[name];
                },
                set: function (name, value) {
                    appStorage[name] = value;
                    update();
                },
                clear: clear
            };
        };
} ]);
shopstuffsApp.factory('Session', function (AppStorage) {
    this.create = function (login, firstName, lastName, email, userRoles) {
        this.login = login;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.userRoles = userRoles;
//        AppStorage.set('session', this);
    };
    this.invalidate = function () {
        this.login = null;
        this.firstName = null;
        this.lastName = null;
        this.email = null;
        this.userRoles = null;
//        AppStorage.set('session', null);
    };
//    this.get = function () {
//        var session = AppStorage.get('session');
//
//        return  session;
//    };
    return this;
});

shopstuffsApp.factory('AuthenticationSharedService', function ($rootScope, $http, authService, Session, Account, Base64Service, AccessToken) {
        return {
            login: function (param) {
                var data = "username=" + param.username + "&password=" + param.password + "&grant_type=password&scope=read%20write&client_secret=mySecretOAuthSecret&client_id=shopstuffsapp";
                $http.post('oauth/token', data, {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                        "Authorization": "Basic " + Base64Service.encode("shopstuffsapp" + ':' + "mySecretOAuthSecret")
                    },
                    ignoreAuthModule: 'ignoreAuthModule'
                }).success(function (data, status, headers, config) {
                    httpHeaders.common['Authorization'] = 'Bearer ' + data.access_token;
                    AccessToken.set(data);

                    Account.get(function(data) {
                        Session.create(data.login, data.firstName, data.lastName, data.email, data.roles);
                        $rootScope.account = Session;
                        authService.loginConfirmed(data);
                    });
                }).error(function (data, status, headers, config) {
                    $rootScope.authenticationError = true;
                    Session.invalidate();
                });
            },
            valid: function (authorizedRoles) {
                if(AccessToken.get() !== null) {
                    httpHeaders.common['Authorization'] = 'Bearer ' + AccessToken.get();
                }

                $http.get('protected/authentication_check.gif', {
                    ignoreAuthModule: 'ignoreAuthModule'
                }).success(function (data, status, headers, config) {
                    if (!Session.login || AccessToken.get() != undefined) {
                        if (AccessToken.get() == undefined || AccessToken.expired()) {
                            $rootScope.authenticated = false;
                            return;
                        }
                        Account.get(function(data) {
                            Session.create(data.login, data.firstName, data.lastName, data.email, data.roles);
                            $rootScope.account = Session;
                            if (!$rootScope.isAuthorized(authorizedRoles)) {
                                event.preventDefault();
                                // user is not allowed
                                $rootScope.$broadcast("event:auth-notAuthorized");
                            }

                            $rootScope.authenticated = true;
                        });
                    }
                    $rootScope.authenticated = !!Session.login;
                }).error(function (data, status, headers, config) {
                    $rootScope.authenticated = false;
                });
            },
            isAuthorized: function (authorizedRoles) {
                if (!angular.isArray(authorizedRoles)) {
                    if (authorizedRoles == '*') {
                        return true;
                    }

                    authorizedRoles = [authorizedRoles];
                }

                var isAuthorized = false;
                angular.forEach(authorizedRoles, function(authorizedRole) {
                    var authorized = (!!Session.login &&
                        Session.userRoles.indexOf(authorizedRole) !== -1);

                    if (authorized || authorizedRole == '*') {
                        isAuthorized = true;
                    }
                });

                return isAuthorized;
            },
            logout: function () {
                $rootScope.authenticationError = false;
                $rootScope.authenticated = false;
                $rootScope.account = null;
                AccessToken.remove();

                $http.get('app/logout');
                Session.invalidate();
                delete httpHeaders.common['Authorization'];
                authService.loginCancelled();
            }
        };
    });
