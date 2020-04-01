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
//Web worker script to manage status messages.

const subscribeid = Date.now();  //create a unique (good enougjt)
const micstate = {};


const eventTake = (e) => {
  try {
    const {channel,client} = JSON.parse(e.data);
    const controlling = client === subscribeid.toString();
    Object.assign(micstate[channel], {client:client, taken: true, controlling: controlling});
    if (channel === this.mic) {
      this.controlling = controlling;
    } 
  } catch (err) {
    console.warn('Error in parsing Event Remove:', err);
    this.colour = 'led-red';
    this.state = 'Error:T';
    this.target = `Error-${this.target}`;  //Just continue where we left off
  }

}


const eventAdd = (e) => {
  try {
    const {channel, name} = JSON.parse(e.data);
    if (this.mic.length === 0) {
      this.mic = channel;
    }
    if (this.micstate[channel] === undefined) {
      this.micstate[channel] = {
        connected: true, 
        taken: false, 
        token: '', 
        client: '',
        controlling: false, 
        name: name,
        mode: 'Monitor',
        recording: false, 
        state : 'Monitor', 
        target : 'Monitor',
        filename: ''
      }
      const micU = channel.charAt(0).toUpperCase() + channel.substring(1);
      if(!this.mics.find(aMic => micU === aMic)) {
        this.mics.push(micU);
      }
    } else Object.assign(this.micstate[channel],{connected: true, name: name});
    if (this.mic === channel) {
      this.micname = name;
      this.connected = true;
    } else this._altMic();  //This will kick state into looking at alternative monitors if we need to
    
  } catch (e) {
    console.warn('Error in parsing Event Add:', e);
    this.colour = 'led-red';
    this.state = 'Error:A';
    this.target = `Error-${this.target}`;  //Just continue where we left off
  }
}


_eventClose() {
  //the server is closing down, so reset everything to wait for it to come up again
  this.target = 'Close';
  this.recording = false;
  this.controlling = false;
  this.connected = false;
  for (const mic in this.micstate) {
    Object.assign(this.micstate[mic], {target: 'Close', State: 'Close', recording: false, contolling: false, connected: false});
    if (this.micstate[mic].ticker !== undefined) this.micstate[mic].ticker.destroy();
    delete this.micstate[mic].ticker;
  }
 }
_eventRelease(e) {
  try {
    const {channel} = JSON.parse(e.data);     
    Object.assign(this.micstate[channel], {taken :false, client: '', token:''});
    if (channel === this.mic) {
      this.controlling = false;
      this.recording = false;
      //We might be awaiting release fron another client entirely, so if we are we can now request control
      this.state = this.connected? (this.state === 'Await R'? 'Req Ctl':'Monitor') : 'No Mic';
    } else {
      //This mic might be awaiting release fron another client entirely, so if we are we can now request control when we select it.
      const nextState = this.micstate[channel].connected ? (this.micstate[channel].state === 'Await R'? 'Req Ctl':'Monitor') : 'No Mic';
      Object.assign(this.micstate[channel],{controlling: false, recording: false, state: nextState});
    }
    if (this.micstate[channel].ticker !== undefined) this.micstate[channel].ticker.destroy();
  } catch (e) {
    console.warn('Error in parsing Event Release:', e);
    this.colour = 'led-red';
    this.state = 'Error:G';
    this.target = `Error-${this.target}`;  //Just continue where we left off
  }
}
_eventRemove(e) {
  try {
    const {channel} = JSON.parse(e.data);
    Object.assign(this.micstate[channel], {taken: false, client: '', token: ''});
    if (channel === this.mic) {
      this.connected = false;
      this.controlling = false;
      this.recording = false;
      this.state = 'No Mic'
    } else {
      Object.assign(this.micstate[channel],{connected: false, taken: false, token: '', available: false, recording: false, state: 'No Mic'});
      this._altMic();
    }
    if (this.micstate[channel].ticker !== undefined) this.micstate[channel].ticker.destroy();
    
  } catch (e) {
    console.warn('Error in parsing Event Remove:', e);
    this.colour = 'led-red';
    this.state = 'Error:D';
    this.target = `Error-${this.target}`;  //Just continue where we left off
  }
}
_eventStatus(e) {
  try {
    const status = JSON.parse(e.data);
    for (const mic in status) {
      if (this.mic.length === 0) {
        this.mic = mic;
      }
      if (this.micstate[mic] === undefined) {
        this.micstate[mic] = {};
        Object.assign(this.micstate[mic],{
          //initial defaults
          mode: 'Monitor',
          controlling: false,
          token: '', 
          recording: false, 
          state : 'No Mic', 
          target : 'Monitor',
          filename: ''
        }, status[mic]);

      } else {
        if (status[mic].name.length === 0) delete status[mic].name; //don't overwrite a name with blank once we have captured it.
        const controlling = status[mic].taken && status[mic].client === this.subscribeid.toString();
        const update = {controlling: controlling};
        if (this.micstate[mic].target === 'Close') {
          //this is the first status message since we closed
          update.target = 'Monitor';
        }
        if (status[mic].connected && !status[mic].taken && this.micstate[mic].state === 'Await R') {
          //we are waiting for a release
          update.state = 'Req Ctl';
        }
        Object.assign(this.micstate[mic], status[mic], update);
        if (!controlling && this.micstate[mic].ticker !== undefined) this.micstate[mic].ticker.destroy(); 

      }
      const micU = mic.charAt(0).toUpperCase() + mic.substring(1);
      if(!this.mics.find(aMic => micU === aMic)) {
        this.mics.push(micU);
      }
      if(this.mic === mic) {
        this.connected = this.micstate[mic].connected;
        this.micname = this.micstate[mic].name;
        this.controlling = this.micstate[mic].controlling;
        if (status[mic].connected && !status[mic].taken  && this.state === 'Await R') this.state = 'Req Ctl';
      }
      this._altMic();
    }

  } catch (e) {
    console.warn('Error in parsing Event Status:', e);
    this.colour = 'led-red';
    this.state = 'Error:S';
    this.target = `Error-${this.target}`;  //Just continue where we left off
  }
}




const eventSrc = new EventSource(`/api/${subscribeid}/status`);
eventSrc.addEventListener('add', eventAdd);
eventSrc.addEventListener('close', eventClose);
eventSrc.addEventListener('release', eventRelease);
eventSrc.addEventListener('remove', eventRemove);
eventSrc.addEventListener('status', eventStatus);
eventSrc.addEventListener('take', eventTake);     
