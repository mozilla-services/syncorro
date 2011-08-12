/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Syncorro.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp von Weitershausen <philipp@weitershausen.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://services-sync/main.js");
Cu.import("resource://services-sync/log4moz.js");
Cu.import("resource://services-sync/rest.js");
Cu.import("resource://services-sync/util.js");
Cu.import("resource://services-sync/engines/clients.js");
Cu.import("resource://services-sync/ext/Preferences.js");

Cu.import("resource://gre/modules/AddonManager.jsm");

const EXPORTED_SYMBOLS = ["Syncorro", "SyncorroPrefs", "SyncorroDefaultPrefs"];
const PREF_BRANCH = "extensions.syncorro.";
const SyncorroPrefs = new Preferences(PREF_BRANCH);
const SyncorroDefaultPrefs = new Preferences({branch: PREF_BRANCH,
                                              defaultBranch: true});

XPCOMUtils.defineLazyServiceGetter(this, "gUUIDService",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");

/**
 * Watch Sync for errors and other incidents and generate, save and upload
 * reports.
 */
const Syncorro = {

  /**
   * The current SyncorroSession object or null if there isn't a sync
   * going on right now.
   */
  currentSession: null,

  /**
   * Flag to indicate whether the sync started with logging in or whether
   * we were already logged in.
   */
  sessionStartedWithLogin: false,

  /**
   * Initialize. Call this once at startup.
   */
  init: function init() {
    if (Weave.Status.ready) {
      this._init();
    } else {
      Svc.Obs.add("weave:service:ready", this);
    }
  },

  _log: Log4Moz.repository.getLogger("Sync.Syncorro"),

  _init: function _init() {
    Svc.Obs.add("weave:service:sync:finish", this);
    Svc.Obs.add("weave:service:sync:error", this);
    Svc.Obs.add("weave:service:login:error", this);

    let formatter = new Log4Moz.BasicFormatter();
    let appender = new Log4Moz.StorageStreamAppender(formatter);
    appender.level = Log4Moz.Level.Trace;

    let root = Log4Moz.repository.getLogger("Sync");
    root.addAppender(appender);
    this._appender = appender;

    this._log.level = Log4Moz.Level[Svc.Prefs.get("log.logger.service.main")];
    this._log.info("Syncorro initialized.");
  },

  /**
   * Be a good restartless add-on and also support unload.
   */
  unload: function unload() {
    Svc.Obs.remove("weave:service:sync:finish", this);
    Svc.Obs.remove("weave:service:sync:error", this);
    Svc.Obs.remove("weave:service:login:error", this);

    let root = Log4Moz.repository.getLogger("Sync");
    root.removeAppender(this._appender);
  },

  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "weave:service:ready":
        this._init();
        return;

      case "weave:service:login:start":
        this._log.trace("Starting a new session at login.");
        this.currentSession = new SyncorroSession();
        this.sessionStartedWithLogin = true;
        return;

      case "weave:service:sync:start":
        if (this.sessionStartedWithLogin) {
          this._log.trace("Session already started at login.");
          this.sessionStartedWithLogin = false;
          return;
        }
        //TODO if this.currentSession exists, something's wrong...
        this._log.trace("Starting a new session.");
        this.currentSession = new SyncorroSession();
        return;

      case "weave:engine:sync:applied":
        if (subject.newFailed) {
          //TODO track ze error
        }
        return;

      case "weave:engine:sync:error":
        this.currentSession.trackError(subject, data);
        return;

      case "weave:service:sync:finish":
        if (Weave.Status.sync == STATUS_OK &&
            !SyncorroPrefs.get("reportOnSuccess")) {
          // Sync was successful. Nothing to see here.
          this._log.trace("Successful sync, nothing to do.");
          this.resetSessionAndLog();
          return;
        }
        // Fall through to error reporting
      case "weave:service:login:error":
      case "weave:service:sync:error":
        let previousSession = this.currentSession;
        let logStream = this.resetSessionAndLog();
        if (subject) {
          previousSession.trackError(subject, data);
        }
        if (previousSession.errors.length ||
            SyncorroPrefs.get("reportOnSuccess")) {
          this._log.trace("Submitting report " + report.uuid);
          this.submitReport(previousSession, logStream, function (report) {
            Svc.Obs.notify("syncorro:report:submitted", report);
            //TODO we might want a safety belt to ensure we save the
            // report locally if the request times out...
            this.saveReport(report, function() {
              Svc.Obs.notify("syncorro:report:saved", report);
            });
          }.bind(this));
        }
        return;
    }
  },

  /**
   * Reset the Syncorro session and the in-memory log.
   * 
   * @return an nsIInputStream that contains the log output.
   */
  resetSessionAndLog: function resetSessionAndLog() {
    let stream = this._appender.getInputStream();
    this._appender.reset();
    this.currentSession = null;
    return stream;
  },

  /**
   * Submit report to server. Also saves report to disk.
   */
  submitReport: function submitReport(session, logStream, callback) {
    session.generateReport(function (report) {
      report.log = NetUtil.readInputStreamToString(logStream,
                                                   logStream.available());

      // Upload the report to the server.
      let uri = SyncorroPrefs.get("serverURL") + report.uuid;
      let request = new RESTRequest(uri).put(report, function (error) {
        if (error) {
          this._log.debug("Failed to upload report " + report.uuid +
                          ". Got error: " + Utils.exceptionStr(error));
        } else if (request.response.status != 200) {
          this._log.debug("Failed to uplaod report " + report.uuid + 
                          ". Got HTTP: " + request.response.status);
        } else {
          try {
            report.response = JSON.stringify(request.response.body);
          } catch (ex) {
            this._log.debug("Server responded with invalid JSON: " +
                            request.response.body);
          }
          // Yay, success!
          report.submitted = true;
          this._log.debug("Report successfully submitted: " + report.uuid);
        }
        callback(report);
      }.bind(this));
    }.bind(this));
  },

  /**
   * Save report to disk.
   */
  saveReport: function saveReport(report, callback) {
    // Write the report to disk.
    Utils.jsonSave("syncorro/" + report.uuid, this, report, function () {
      this._log.debug("Saved report " + report.uuid);
      callback(report);
    });
  },

};


/**
 * Session that tracks errors and other incidents during a sync.
 * 
 * We create one of these per sync.
 */
function SyncorroSession() {
  this.uuid = gUUIDService.generateUUID().toString().slice(1, -1);
  this.errors = [];
  this._log.level = Log4Moz.Level[Svc.Prefs.get("log.logger.service.main")];
}
SyncorroSession.prototype = {

  _log: Log4Moz.repository.getLogger("Sync.Syncorro"),

  /**
   * Track an error that occurred during a sync.
   * 
   * @param error
   *        The error/exception object.
   * @param engine [optional]
   *        The engine that the error occurred in.
   */
  trackError: function trackError(error, engine) {
    this._log.trace("Tracking error: " + Utils.exceptionStr(error));
    this.errors.push({
      localTimestamp: Date.now(),
      engine: engine,
      error: error //TODO this might not stringify as well as we think it might
    });
  },

  _getEnabledAddonIDs: function _getEnabledAddonIDs(callback) {
    AddonManager.getAllAddons(function (addons) {
      let addon_ids = [];
      for (let i = 0; i < addons.length; i++) {
        let addon = addons[i];
        if (addon.isActive) {
          addon_ids.push(addon.id);
        }
      }
      callback(addon_ids);
    });
  },

  /**
   * Generate a Syncorro report.
   */
  generateReport: function generateReport(callback) {
    this._log.trace("Generating report...");
    let clients_stats = Clients.stats;
    this._getEnabledAddonIDs(function (addon_ids) {
      callback({
        uuid: this.uuid,
        app: {
          product: Services.appinfo.ID,
          version: Services.appinfo.version,
          buildID: Services.appinfo.platformBuildID,
          locale: "en_US", //TODO
          addons: addon_ids
        },
        sync: {
          version: Weave.WEAVE_VERSION,
          account: Weave.Service.username,
          cluster: Weave.Service.clusterURL,
          engines: [engine.name for each (engine in Engines.getEnabled())],
          numClients: clients_stats.numClients,
          hasMobile: clients_stats.hasMobile
        },
        errors: this.errors,
        log: null  // this will be filled in by somebody else
      });
    }.bind(this));
  }

};
