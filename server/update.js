/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    This file is part of Program.

    Program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    2020 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Program.  If not, see <http://www.gnu.org/licenses/>.
*/

(async function () {
  'use strict';


  const fs = require('fs');

  function update(filename, str, token) {
    return new Promise((resolve, reject) => {
      fs.readFile(filename, 'utf8', (error, result) => {
        if (error && error.code !== 'ENOENT') {
          reject(error);
        } else {
          let madeChange = false;
          let lines;
          if (result) {
            lines = result.toString().split("\n");
            while (lines[lines.length - 1] === '') {
              lines.pop(); //get rid of dummy lines at the end
            }
            let found = false;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].substring(0, str.length) === str) {
                if (lines[i] !== str + token.toString()) {
                  lines[i] = str + token.toString(); //replace with our new token
                  madeChange = true;
                }
                found = true;
                break;
              }
            }
            if (!found) {
              lines.push(str + token.toString()); //not found so append
              lines.push(''); //just add this so file ends just after the last entry
              madeChange = true;
            }
          } else {
            lines = [];
            lines.push(str + token.toString());
            lines.push(''); //just add this so file ends just after the last entry
            madeChange = true;
          }
          if (madeChange) {
            fs.writeFile(filename, lines.join("\n"), error => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        }
      });
    });
  }
  module.exports = update;
}) ();
