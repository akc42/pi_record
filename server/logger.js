/*
  Copyright (c) 2016 Alan Chandler, all rights reserved

  This file is part of PASv5, an implementation of the Patient Administration
  System used to support Accuvision's Laser Eye Clinics.*

  PASv5 is licenced to Accuvision (and its successors in interest) free of royality payments
  and in perpetuity in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
  implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. Accuvision
  may modify, or employ an outside party to modify, any of the software provided that
  this modified software is only used as part of Accuvision's internal business processes.

  The software may be run on either Accuvision's own computers or on external computing
  facilities provided by a third party, provided that the software remains soley for use
  by Accuvision (or by potential or existing customers in interacting with Accuvision).
*/

(function() {
  'use strict';

  const chalk = require('chalk');
  const COLOURS = {
    app: chalk.magenta,
    api: chalk.green,
    error: chalk.white.bgRed,
    url: chalk.white.bgMagenta,
    rec: chalk.cyan,
    log: chalk.yellowBright,
    err: chalk.redBright
  };

  function logger(level, message, client) {
    let logLine = '';
    if (process.env.REC_NOLOG === undefined) {
      if (process.env.REC_LOGNODATE === undefined) logLine += new Date().toISOString() + ': ';
      if (client) {
        logLine += COLOURS['api'](client + ': ');
      }
      logLine += COLOURS[level](message);
      //eslint-disable-next-line no-console
      console.log(logLine.trim());

    }
  }

  module.exports = logger;
})();
