/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    This file is part of Recorder.

    Recorder is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Recorder is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Recorder.  If not, see <http://www.gnu.org/licenses/>.
*/
export default class Ticker {
  static counter = 0;
  constructor(frequency) {
    this.counter = ++Ticker.counter;
    this.frequency = frequency;
    this.donePromise = new Promise((resolve,reject) => {
      this.resolver = resolve;
      this.rejector = reject;
    });
    this.interval = setInterval(() => {
      this.resolver();
      this.donePromise = new Promise((resolve,reject) => {
        this.resolver = resolve;
        this.rejector = reject;
      });
    }, frequency);
  }
  get nextTick() {
    return this.donePromise;
  }
  destroy() {
    clearInterval(this.interval);
    this.rejector('close');  //kicks off anyone waiting for this
  }
};