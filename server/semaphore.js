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
//this following code is copied from a stack overflow answer


  let sharedPromise = Promise.resolve();
  
  class Sempaphore {
      constructor() {
          let priorP = sharedPromise;
          let resolver;
          
          // create our promise (to be resolved later)
          let newP = new Promise(resolve => {
              resolver = resolve;
          });
          
          // chain our position onto the sharedPromise to force serialization
          // of semaphores based on when the constructor is called
          sharedPromise = sharedPromise.then(() => {
              return newP;
          });
          
          // allow caller to wait on prior promise for its turn in the chain
          this.start = function() {
              return priorP;
          }
          
          // finish our promise to enable next caller in the chain to get notified
          this.end = function() {
              resolver();
          }
      }
  }

module.exports = Semphore;