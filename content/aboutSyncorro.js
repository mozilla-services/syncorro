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

function setList(id, array) {
  let cell = document.getElementById(id);
  cell.removeChild(cell.firstChild);
  let list = document.createElement("ul");
  for (let i = 0; i < array.length; i++) {
    let li = document.createElement("li");
    li.textContent = array[i];
    list.appendChild(li);
  }
  cell.appendChild(list);
}

const AboutSyncorro = {

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
      document.body.classList.add('list-view');

      if (!reports.length) {
        document.body.classList.add('no-reports');
        return;
      }
      document.body.classList.remove('no-reports');

      let table = document.getElementById("list-reports-table");
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
        link.id = "report-" + report.id;
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
    Syncorro.clearReports(function() {
      document.body.classList.add('list-view');
      document.body.classList.add('no-reports');
    });
  },

  showReport: function showReport(uuid) {
    Syncorro.getReport(uuid, function (report) {
      if (!report) {
        // Uh-oh. Something went wrong.
        document.body.classList.add('list-view');
        document.body.classList.add('no-reports');
        return;
      }

      document.body.classList.remove('list-view');

      let date = new Date(report.timestamp);
      setText("view-report-date", formatDate(date));
      setText("view-report-time", formatTime(date));

      setText("full-report-uuid", report.uuid);

      setText("full-report-app-product", report.app.product);
      setText("full-report-app-version", report.app.version);
      setText("full-report-app-buildID", report.app.buildID);
      setText("full-report-app-locale",  report.app.locale);
      setList("full-report-app-addons",  report.app.addons);

      setText("full-report-sync-version", report.sync.version);
      setText("full-report-sync-account", report.sync.account);
      setText("full-report-sync-cluster", report.sync.cluster);
      setList("full-report-sync-engines", report.sync.engines);
      setText("full-report-sync-numClients", report.sync.numClients);
      setText("full-report-sync-hasMobile",  report.sync.hasMobile); //TODO

      setText("full-report-error", JSON.stringify(report.error)); //TODO
      setText("full-report-log", report.log);

      if (report.submitted) {
        document.getElementById("view-report").classList.add('report-submitted');
      } else {
        document.getElementById("view-report").classList.remove('report-submitted')
      }

      //TODO
      //show("view-report-solutionFound", false);
    });
  },

  details: function details(el) {
    while (el) {
      if (el.nodeName == 'details') {
        if (el.hasAttribute('open')) {
          el.removeAttribute('open');
        } else {
          el.setAttribute('open', '');
        }
        break;
      }
      el = el.parentNode;
    }
  }

};
