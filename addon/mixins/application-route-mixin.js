import Ember from 'ember';
import ApplicationRouteMixin from 'ember-simple-auth/mixins/application-route-mixin';

const {
  Mixin,
  computed,
  computed: {
    notEmpty
  },
  get,
  getWithDefault,
  set,
  RSVP,
  inject: {
    service
  },
  run
} = Ember;

export default Mixin.create(ApplicationRouteMixin, {
  session: service(),
  auth0: service(),

  sessionAuthenticated() {
    this._setupFutureEvents();
    this._super(...arguments);
  },

  /**
   * Hook that gets called after the jwt has expired
   * but before we notify the rest of the system.
   * Great place to add cleanup to expire any third-party
   * tokens or other cleanup.
   *
   * IMPORTANT: You must return a promise, else logout
   * will not continue.
   *
   * @return {Promise}
   */
  beforeSessionExpired() {
    return RSVP.resolve();
  },

  /**
   * This has to be overridden because the default behavior prevents
   * auth0 to logout correctly.
   */
  sessionInvalidated() {
    this._clearJobs();
    get(this, 'auth0').navigateToLogoutURL();
  },

  beforeModel() {
    this._setupFutureEvents();
    let promise = RSVP.resolve(this._super(...arguments));

    if (get(this, 'hasImpersonationData')) {
      promise = promise.then(() => this._authenticateAsImpersonator());
    }

    return promise;
  },

  hasImpersonationData: notEmpty('_impersonationData'),

  _authenticateAsImpersonator() {
    const impersonationData = get(this, '_impersonationData');
    if (impersonationData && impersonationData.idToken) {
      return get(this, 'session').authenticate('authenticator:auth0-impersonation', impersonationData);
    }
  },

  _impersonationData: computed(function() {
    const auth0 = get(this, 'auth0').getAuth0Instance();
    return auth0.parseHash(window.location.hash);
  }),

  _setupFutureEvents() {
    this._scheduleExpire();
  },

  _scheduleExpire() {
    run.cancel(get(this, '_expireJob'));
    const expireInMilli = get(this, '_jwtRemainingTimeInSeconds') * 1000;
    const job = run.later(this, this._processSessionExpired, expireInMilli);
    set(this, '_expireJob', job);
  },

  /**
   * The current JWT's expire time
   * @return {Number in seconds}
   */
  _expiresAt: computed('session.data.authenticated.idTokenPayload.exp', {
    get() {
      return getWithDefault(this, 'session.data.authenticated.idTokenPayload.exp', 0);
    }
  }),

  _jwtRemainingTimeInSeconds: computed('_expiresAt', {
    get() {
      let expiration = get(this, '_expiresAt') - (Date.now() / 1000);

      if (expiration < 0) {
        return 0;
      }

      return expiration;
    }
  }),

  _clearJobs() {
    run.cancel(get(this, '_expireJob'));
  },

  _processSessionExpired() {
    this.beforeSessionExpired().then(() => {
      let session = get(this, 'session');

      if (get(session, 'isAuthenticated')) {
        session.invalidate();
      }
    });
  },
});
