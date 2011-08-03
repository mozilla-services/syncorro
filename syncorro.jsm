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

Cu.import("resource://services-sync/status.js");
Cu.import("resource://services-sync/service.js");
Cu.import("resource://services-sync/constants.js");
Cu.import("resource://services-sync/clients.js");
Cu.import("resource://services-sync/log4moz.js");
Cu.import("resource://services-sync/rest.js");
Cu.import("resource://services-sync/util.js");

Cu.import("resource://gre/modules/AddonManager.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "gUUIDService",
                                   "@mozilla.org/uuid-generator;",
                                   "nsIUUIDGenerator");

XPCOMUtils.defineLazyGetter(this, "SyncorroPrefs", function () {
  return new Preferences("extensions.syncorro.");
});

/**
 * XXXXX
 */
const Syncorro = {

  /**
   * XXXXX
   */
  currentSession: null,

  /**
   * XXXXX
   */
  sessionStartedWithLogin: false,

  init: function init() {
    Services.obs.addObserver(this, "weave:service:sync:finish", false);
    Services.obs.addObserver(this, "weave:service:sync:error", false);
    Services.obs.addObserver(this, "weave:service:login:error", false);

    let formatter = new Log4Moz.BasicFormatter();
    let appender = new Log4Moz.StorageStreamAppender(formatter);
    appender.level = Log4Moz.Level.Trace;

    let root = Log4Moz.repository.getLogger("Sync");
    root.addAppender(appender);
    this._appender = appender;
  },

  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "weave:service:login:start":
        this.currentSession = new SyncorroSession();
        this.sessionStartedWithLogin = true;
        return;

      case "weave:service:sync:start":
        if (this.sessionStartedWithLogin) {
          this.sessionStartedWithLogin = false;
          return;
        }
        //TODO if this.currentSession exists, something's wrong...
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
        if (Status.sync == STATUS_OK && !SyncorroPrefs.get("reportOnSuccess")) {
          // Sync was successful. Nothing to see here.
          this.resetSessionAndLog();
          return;
        }
        // Fall through to error reporting
      case "weave:service:login:error":
      case "weave:service:sync:error":
        let previousSession = this.currentSession;
        let logStream = resetSessionAndLog();
        if (subject) {
          previousSession.trackError(subject, data);
        }
        if (previousSession.errors.length ||
            SyncorroPrefs.get("reportOnSuccess")) {
          this.saveAndSubmitReport(previousSession, logStream);
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
   * XXXX
   */
  saveAndSubmitReport: function saveAndSubmitReport(session, logStream) {
    session.generateReport(function (report) {
      report.log = NetUtil.readInputStreamToString(logStream,
                                                   logStream.available());

      // Write the report to disk.
      let file = FileUtils.getFile("ProfD",
                                   ["weave", "syncorro", report.uuid + ".txt"]);
      let outStream = FileUtils.openFileOutputStream(file);
      let inStream = TODO; //XXX
      NetUtil.asyncCopy(inStream, outStream, function () {
        //TODO
      });

      // Upload the report to the server.
      let uri = TODO; //XXX
      let request = new RESTRequest(uri).put(report, function (error) {
        //TODO
      });
    }.bind(this));
  }

};


/**
 * Session that tracks errors and other incidents during a sync.
 * 
 * We create one of these per sync.
 */
function SyncorroSession() {
  this.uuid = gUUIDService.generateUUID().toString();
  this.errors = [];
}
SyncorroSession.prototype = {

  /**
   * Track an error that occurred during a sync.
   * 
   * @param error
   *        The error/exception object.
   * @param engine [optional]
   *        The engine that the error occurred in.
   */
  trackError: function trackError(error, engine) {
    this.errors.push({
      localTimestamp: Date.now(),
      engine: engine,
      error: error //TODO
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
    let clients_stats = Clients.stats;
    this._getEnabledAddonIDs(function (addon_ids) {
      callback({
        id: this.uuid,
        app: {
          product: Services.appinfo.ID,
          version: Services.appinfo.version,
          buildID: Services.appinfo.platformBuildID,
          locale: "en_US", //TODO
          addons: addon_ids
        },
        sync: {
          version: WEAVE_VERSION,
          account: Service.username,
          cluster: Service.clusterURL,
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
