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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://syncorro/modules/syncorro.js");

XPCOMUtils.defineLazyGetter(this, "gFormatter", function () {
  return Cc["@mozilla.org/intl/scriptabledateformat;1"]
           .createInstance(Ci.nsIScriptableDateFormat);
});

function formatDate(date) {
  return gFormatter.FormatDate("",
                               Ci.nsIScriptableDateFormat.dateFormatShort,
                               date.getFullYear(),
                               date.getMonth() + 1,
                               date.getDate());
}

function formatTime(date) {
  return gFormatter.FormatTime("",
                               Ci.nsIScriptableDateFormat.timeFormatNoSeconds,
                               date.getHours(),
                               date.getMinutes(),
                               date.getSeconds());
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

const AboutSyncorro = {

  //TODO also need onhashchange
  init: function init() {
    window.addEventListener("hashchange", this.determineView.bind(this),
                            false);
    this.determineView();
  },

  determineView: function determineView() {
    if (window.location.hash.length > 1) {
      let uuid = window.location.hash.slice(1);
      //TODO sanity check for uuid format?
      this.showReport(uuid);
    } else {
      this.showReportList();
    }
  },

  showReportList: function showReportList() {
    Syncorro.listSavedReports(function (reports) {
      document.getElementById("view.report").style.display = "none";
      document.getElementById("list.reports").display = "block";

      let table = document.getElementById("list.reports.table");
      let tbody = document.getElementById("tbody");
      table.removeChild(tbody);
      tbody = document.createElement("tbody");
      tbody.id = "tbody";

      for (let i = 0; i < reports.length; i++) {
        let report = reports[i];
        let row = document.createElement("tr");
        let cell = document.createElement("td");
        row.appendChild(cell);
        let link = document.createElement("a");
        link.id = report.id;
        link.setAttribute("href", "about:syncorro#" + report.id);
        //link.appendChild(document.createTextNode(report.id));
        link.textContent = report.id;
        cell.appendChild(link);

        let date = new Date(report.date);
        cell = document.createElement("td");
        cell.textContent = formatDate(date);
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.textContent = formatTime(date);
        row.appendChild(cell);
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
    });
  },

  clearReports: function clearReports() {
    //TODO
  },

  showReport: function showReport(uuid) {
    Syncorro.getReport(uuid, function (report) {
      if (!report) {
        // Uh-oh. Something went wrong.
        alert("Oh noez, report not foundz.");//XXX TODO
        return;
      }

      let date = new Date(report.timestamp);
      setText("view.report.date", formatDate(date));
      setText("view.report.date", formatTime(date));

      setText("full.report.uuid", report.uuid);

      setText("full.report.app.product", report.app.product);
      setText("full.report.app.version", report.app.version);
      setText("full.report.app.buildID", report.app.buildID);
      setText("full.report.app.locale",  report.app.locale);
      setText("full.report.app.addons",  report.app.addons); //TODO

      setText("full.report.sync.version", report.sync.version);
      setText("full.report.sync.account", report.sync.account);
      setText("full.report.sync.cluster", report.sync.cluster);
      setText("full.report.sync.numClients", report.sync.numClients);
      setText("full.report.sync.hasMobile",  report.sync.hasMobile); //TODO

      setText("full.report.error", JSON.stringify(report.error)); //TODO
      setText("full.report.log", report.log);      

      document.getElementById("list.reports").style.display = "none";
      document.getElementById("view.report").style.display = "block";
    });
  },

  toggle: function toggle(id) {
    //TODO
  }

};
