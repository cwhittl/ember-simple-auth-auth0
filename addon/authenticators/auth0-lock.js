import Ember from 'ember';
import BaseAuthenticator from 'ember-simple-auth/authenticators/base';
import createSessionDataObject from '../utils/create-session-data-object';

const {
  RSVP,
  get,
  inject: {
    service
  },
  isEmpty,
  getProperties,
  deprecate
} = Ember;

const assign = Ember.assign || Ember.merge;

export default BaseAuthenticator.extend({
  auth0: service(),
  authenticate(options) {
    let defaultOptions = {
      autoclose: true,
      auth: {
        redirect: false,
        params: {
          scope: 'openid'
        }
      }
    };

    options = assign(defaultOptions, options);

    return new RSVP.Promise((resolve, reject) => {
      const lock = get(this, 'auth0').getAuth0LockInstance(options);
      lock.on('unrecoverable_error', reject);
      lock.on('authorization_error', reject);
      lock.on('authenticated', (authenticatedData) => {
        lock.getProfile(authenticatedData.idToken, (error, profile) => {
          if (error) {
            return reject(error);
          }

          resolve(createSessionDataObject(profile, authenticatedData));
        });
      });

      lock.show();
    });
  },

  restore(data) {
    const {
      jwt,
      exp,
    } = getProperties(data, 'jwt', 'exp');

    deprecate(
      'Should use "idToken" as the key for the authorization token instead of "jwt" key on the session data',
      isEmpty(jwt), {
        id: 'ember-simple-auth-auth0.authenticators.auth0-lock.restore',
        until: 'v3.0.0',
      });

    deprecate(
      'Should use "idTokenPayload.exp" as the key for the expiration time instead of "exp" key on the session data',
      isEmpty(exp), {
        id: 'ember-simple-auth-auth0.authenticators.auth0-lock.restore',
        until: 'v3.0.0',
      });

    return RSVP.resolve(data);
  },

  invalidate() {
    get(this, 'auth0').navigateToLogoutURL();
    return this._super(...arguments);
  },
});
