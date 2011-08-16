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
 * the Mozilla Foundation
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
  Components.manager.addBootstrappedManifestLocation(data.installPath);

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

  Cu.import("resource://syncorro/modules/syncorro.js");
  AboutSyncorro.unload();
  Syncorro.unload();
  Components.manager.removeBootstrappedManifestLocation(data.installPath);
  gResProtocolHandler.setSubstitution(RESOURCE_HOST, null);
}
