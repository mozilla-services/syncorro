/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. 
 *
 * Contributor(s):
 *   Philipp von Weitershausen <philipp@weitershausen.de>
 *   Mime Cuvalo <mime@mozilla.com>
 *
 */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const RESOURCE_HOST = "syncorro";
const DEFAULT_PREFS = {
  "reportOnSuccess": false,
  "serverURL": "http://localhost:9200/syncorro/report/"
};

XPCOMUtils.defineLazyGetter(this, "gResProtocolHandler", function () {
  return Services.io.getProtocolHandler("resource")
                 .QueryInterface(Ci.nsIResProtocolHandler);
});

function startup(data, reason) {
  // Register the resource:// and chrome:// aliases.
  gResProtocolHandler.setSubstitution(RESOURCE_HOST, data.resourceURI);

  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0) {
    Components.manager.addBootstrappedManifestLocation(data.installPath);
  }

  Cu.import("resource://syncorro/modules/syncorro.js");
  for (let [name, value] in Iterator(DEFAULT_PREFS)) {
    SyncorroDefaultPrefs.set(name, value);
  }
  Syncorro.init();
  AboutSyncorro.register();
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  AboutSyncorro.unload();
  Syncorro.unload();

  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0) {
    Components.manager.removeBootstrappedManifestLocation(data.installPath);
  }

  Cu.unload("resource://syncorro/modules/syncorro.js");
  gResProtocolHandler.setSubstitution(RESOURCE_HOST, null);
}
