var tootConfig, mastodonRequest, mastodonAppCreate, mastodonLogIn, mastodonGetAccessToken;

function validCredentials() {
    return mastodonRequest('GET', 'accounts/verify_credentials', false)
        .then(function(re) {
            return re;
        });
}

function loggedIn(username, domain, vis) {
    document.getElementById('username').innerText = username;
    document.getElementById('domain').innerText = domain;
    document.getElementById('vis').innerText = vis;
    document.getElementById('vis-form').addEventListener('submit', setVis);
    document.getElementById('logout-button').addEventListener('click', logOut);
    document.getElementById('not-logged-in').style.display = 'none';
    document.getElementById('logged-in').style.display = 'block';
    document.getElementById('pending-login').style.display = 'none';
}

function notLoggedIn() {
    document.getElementById('not-logged-in').style.display = 'block';
    document.getElementById('logged-in').style.display = 'none';
    document.getElementById('login-form').addEventListener('submit', logIn);
}

function pendingLogin() {
    document.getElementById('not-logged-in').style.display = 'none';
    document.getElementById('pending-login').style.display = 'block';
    document.getElementById('refresh-button').addEventListener('click', refreshPage);
}

function errorStatus(text) {
    var alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.innerText = text;
    document.getElementById('alerts').appendChild(alert);
}

function setVis(event) {
    event.preventDefault();

    var f = this;

    tootConfig.visibility = f.visibility.value;
    chrome.storage.local.set({'settings': tootConfig});
    chrome.storage.local.get('settings', function(res) {
    tootConfig = res.settings;
    validCredentials()
    .then(function(u) {
        if (u.username) {
            loggedIn(u.username, tootConfig.domain, tootConfig.visibility);
        } else {
            errorStatus(
                'An unexpected error occurred: access token created, but unable to verify credentials.'
            );
        }
    })
    });
}

function logOut() {
    delete tootConfig.access_token;
    chrome.storage.local.set({'settings': tootConfig});
    notLoggedIn();
    fillForm();
}

function fillForm() {
    var form = document.getElementById('login-form');
    for (var setting in tootConfig) {
        if (form[setting]) {
            form[setting] = tootConfig[setting];
        }
    }
}

function refreshPage() {
    location.reload();
}

function logIn(event) {
    event.preventDefault();

    var f = this;

    tootConfig.domain = f.domain.value;
    tootConfig.secure = f.secure.value;

    var host = (f.secure.value ? 'https' : 'http') + '://' + f.domain.value + '/*';

    if (chrome.permissions) { // Firefox doesn't support optional permissions,
                              // so we request global permissions in the manifest.
        chrome.permissions.contains({ origins: [host] }, function(result) {
            if (result) {
                getCredentials(f);
            } else {
                chrome.permissions.request({
                    origins: [host]
                }, function(granted) {
                    if (granted) {
                        getCredentials(f);
                    } else {
                        errorStatus(
                            `Tooter was denied permissions required to talk to the Mastodon instance at ${host}`
                            );
                    }
                });
            }
        });
    } else {
        getCredentials(f);
    }
}

function getCredentials(f) {
    mastodonAppCreate()
    .then(function(response) {
        if (response) {
            tootConfig.client_id = response.client_id;
            tootConfig.client_secret = response.client_secret;
            chrome.storage.local.set({'settings': tootConfig});
            pendingLogin();
            mastodonLogIn(response.client_id, response.client_secret);
        } else {
            errorStatus(
                'Unable to create a Mastodon app - check your domain settings.'
            );
        }
    })
    .catch(function(error) {
        errorStatus(
            'Unable to create a Mastodon app: ' + error
        );
    });
}

function authCallback(callback_url) {
    var code = callback_url.match(/code=([^&]*)/);
    if (code[1]) {
        code = code[1];
    } else {
        document.getElementById('status').innerText = 'Error: callback was called without an authoriation code.';
    }
    mastodonGetAccessToken(code)
    .then(function(response) {
        if (response.access_token) {
            tootConfig.access_token = response.access_token;
            tootConfig.visibility = 'public';
            chrome.storage.local.set({'settings': tootConfig});
            validCredentials()
            .then(function(u) {
                if (u.username) {
                    loggedIn(u.username, tootConfig.domain, tootConfig.visibility);
                } else {
                    errorStatus(
                        'An unexpected error occurred: access token created, but unable to verify credentials.'
                    );
                }
            })
            .catch(function(error) {
                errorStatus(
                    'An unexpected error occurred: access token created, but unable to verify credentials: ' + error
                );
            });
        }
    })
    .catch(function(error) {
        errorStatus(
        'Unable to verify email or password: ' + error
        );
    });
}

chrome.storage.local.get('settings', function(res) {
    tootConfig = res.settings;
    if (tootConfig) {
        if (tootConfig.access_token) {
            validCredentials()
            .then(function(u) {
                if (u.username) {
                    loggedIn(u.username, tootConfig.domain, tootConfig.visibility);
                } else {
                    errorStatus('Unable to login with saved details.');
                    notLoggedIn();
                    fillForm();
                }
            })
            .catch(function(error) {
                errorStatus(`Unable to login: ${error}.`);
                notLoggedIn();
                fillForm();
            });
        } else {
            notLoggedIn();
            fillForm();
        }
    } else {
        tootConfig = {};
        notLoggedIn();
    }
});
