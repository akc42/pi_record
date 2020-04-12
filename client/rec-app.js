/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    This file is part of Recorder.

    Recorder is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    2020 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Recorder.  If not, see <http://www.gnu.org/licenses/>.
*/



import { LitElement, html } from '../lit/lit-element.js';

import Ticker from './tickker.js';
import remoteLog from './remotelog.js';

import './rec-volume.js';
import './rec-led.js';
import './rec-lcd.js';
import './rec-record-button.js';
import './round-switch.js';
import './rec-reset-button.js';


class RecApp extends LitElement {

  static get properties() {
    return {
      mics: {type: Array},  //names of mics that we can select (Capitalised)
      mic : {type: String},  //name of mike selected (lower case)
      micname: {type: String}, //Full name of selected Mic (as received)
      modes: {type: Array},   //Available Modes ('Monitor' and 'Control')
      mode: {type: String},   // Currently Selected Mode
      connected: {type: Boolean}, //is the currently selected mic connected
      controlling: {type: Boolean},  //Asked for and received control
      colour: {type: String},  //Led colour
      recording: {type: Boolean}, //State of recording push button (before a recording requested)
      state: {type: String},  //Current state of selected mic (main are 'No Mic', 'Monitor', 'Control' and 'Record', but intermedate states allowed)
      target:{type: String}, //State we want to reach
      filename: {type: String}, //Name of filename last recording (and kept), or (when state = 'No Mic') name of alternatively connected mic.
      loudness: {type: String}, //Last integrated loudness received from recorder in fixed(1) format for luFS
      leftpeak: {type: String}, //Last peak left channel in fixed(1) format for dbFS
      rightpeak: {type: String}, //Last peak right channel in fixed(1) format for dbFS
      seconds: {type: Number},  //Seconds since loudness last reset
      code: {type: String},      //Error Code if there is one
      taken: {type: Boolean}
    };
  }
  constructor() {
    super();
    this.connected = false;
    this.controlling = false;
    this.recording = false;
    this.micstate = {};
    this.micname = '';
    this.mics = [];
    this.modes = ['Monitor', 'Control'];
    this.code = '';
    this.mic = '';
    this.altMic = '';
    this.mode = 'Control';   //when we start up we want to take control if we can
    this.colour = 'led-red';
    this.state = 'Closed';
    this.target = 'Close';
    this.filename = '';
    this.loudness = this.leftpeak = this.rightpeak = '-70.0';
    this.seconds = 0;
    this.taken = false; 
    this.timer = 0;
    this.client = '';
    this.renew = 60; //start with a low number, so we are over zealous, be we will probably increase
 
    this._eventAdd = this._eventAdd.bind(this);
    this._eventClose  = this._eventClose.bind(this);
    this._eventNew = this._eventNew.bind(this);
    this._eventRelease = this._eventRelease.bind(this);
    this._eventRemove = this._eventRemove.bind(this);
    this._eventReset = this._eventReset.bind(this);
    this._eventStatus = this._eventStatus.bind(this);
    this._eventTake = this._eventTake.bind(this);
    this._statusMessage = this._statusMessage.bind(this);
    this._visibilityChange = this._visibilityChange.bind(this);

    document.addEventListener('visibilitychange', this._visibilityChange);
    this.link = document.createElement('a');

  }
  connectedCallback() {
    super.connectedCallback();
    this.removeAttribute('unresolved');
    this.target = 'Initialise';
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.target = 'Close';
  }

  updated(changed) {
    console.group('Updated changed properties')
    if (changed.has('target')) {
      console.group('Target Change')
      console.log('from ', changed.get('target'), ' to ', this.target);
      switch (this.target) {
        case 'Close':
          console.log('Target Change setting State Closed');
          this.state = 'Closed';
          break;
        case 'Initialise':
          this.state = 'Initialise'
          break;
        case 'Monitor': 
          if (this.mode === 'Control') {
            console.log('change target to Control');
            this.target = 'Control';
          } else {
            switch(this.state) {
              case 'Closed':
                this.state = 'No Mic';
                break;
              case 'Control':
                this.state = 'Req Rel';
                break;
              case 'Record':
                this.state = 'Req Stp';
                break;
              case 'Await R':
                this.state = 'Monitor';
            }
          }
          break;
        case 'Control':
          if (this.mode === 'Monitor') {
            console.log('change target to Monitor');
            this.target = 'Monitor';
          } else {
            switch (this.state) {
              case 'Closed':
                this.state = 'No Mic';
                break;
              case 'Monitor':
                this.state = 'Req Ctl';
                break;
              case 'Record':
                this.state = 'Req Stp';
                break;
            }
          }
          break;
        case 'Record': 
          if (this.mode === 'Monitor' || !this.controlling) {
            console.log('change target to monitor');
            this.target = 'Monitor';
          } else {
            switch(this.state) {
              case 'Closed':
                this.state = 'No Mic';
                break;
              case 'Monitor':
                this.state = 'Req Ctl';
                break;
              case 'Control':
                this.state = 'Req Rec';
                break;
            }
          }
          break;
        case 'Hibernate':
          this.state = 'Sleep'
          break;
        default:
          /*
            We use the opportunity with these target values to wait in a state in for 5 seconds, but still
            show were we are going next
          */
          const mic = this.mic; 
          const code = this.code;
          const nextTarget = this.target.replace(/^error-(.*)$/,'$1');
          console.log('Change target to ', nextTarget, ' in 5 seconds');
          setTimeout(() =>{
            if (mic === this.mic) {
              //we are still on the same mic
              console.log('still on same mic changing target to ', nextTarget, ' after 5 seconds');
              this.target = nextTarget;
              this.state = 'No Mic';
              if (code === this.code) {
                //still same code, leave for another 30 seconds
                setTimeout(()=>{
                  if (code === this.code) {
                    //still not changed, so we can reset it
                    this.code = '';
                  }
                },30000);
              }
              
            }
          },5000);
      }
      console.groupEnd();
    }

    if (changed.has('state')) {
      console.group('State Change');
      console.log('from ',changed.get('state'), ' to ', this.state);
      switch (this.state) {
        case 'Closed' :
          this.colour = 'led-red';
          this.recording = false;
          this.controlling = false;
          this.connected = false;
          if (this.timer !== 0) {
            console.log('in closed state stopping second timer')
            clearInterval(this.timer);
            this.timer = 0;
          }
          break;
        case 'Initialise':
          if (this.eventSrc === undefined) {
            console.group('Create an Event Source')
            console.log('calling new from Initialise');
            this.eventSrc = new EventSource(`/api/status`);
            this.eventSrc.addEventListener('add', this._eventAdd);
            this.eventSrc.addEventListener('close', this._eventClose);
            this.eventSrc.addEventListener('newid', this._eventNew);
            this.eventSrc.addEventListener('release', this._eventRelease);
            this.eventSrc.addEventListener('remove', this._eventRemove);
            this.eventSrc.addEventListener('reset', this._eventReset);
            this.eventSrc.addEventListener('status', this._eventStatus);
            this.eventSrc.addEventListener('take', this._eventTake);
          }          
          break;
        case 'No Mic':
          if (this.target === 'Close') {
            this.state = 'Closed';
          } else if (this.connected) {
            this.state = 'Monitor';
          } else {
            this.colour = 'led-red';
            this.seconds = 0;
          }
          if (this.timer !== 0) {
            console.log('stopping second timer')
            clearInterval(this.timer);
            this.timer = 0;
          }
          break;
        case 'Monitor':
            if (!this.connected) {
              this.state = 'No Mic';
            } else {
              this.colour = 'led-yellow';
              if(this.target === 'Control' || this.target === 'Record') {
                if (this.taken && !this.controlling) {
                  this.state = 'Await R';
                } else {
                  this.state = 'Req Ctl';
                }
              } else {
                this._getTimer();
              }
              if (this.timer === 0) {
                console.log('starting second timer');
                this.timer = setInterval(() => this.seconds++, 1000);
              }
            }
          break;
        case 'Req Rel': 
          if (!this.connected) {
            this.state = 'No Mic'
          } else if (this.controlling) {
            this._releaseControl();
          } else {
            this.state = 'Monitor';
          }
          break;
        case 'Req Ctl' :
          if (!this.connected) {
            this.state = 'No Mic'
          } else if (!this.controlling) {
              this._takeControl();
      
          } else {
            this.state = 'Control';
          }
          break;
        case 'Await R':
          //con't do anything until we get a release status message
          break;
        case 'Control' :
          
          if (!this.controlling) {
            console.log('Change to Control but not controlling');
            this.state = 'Error';
            this.code = 'NoCtl'
          } else {
            this.colour = 'led-blue';
            if (this.timer === 0) {
              console.log('starting second timer');
              this.timer = setInterval(() => this.seconds++, 1000);
            }
            //go get the time, because we might have transitioned from recording to here,
            this._getTimer();
          }
      break;
        case 'Req Stp':
          if (!this.recording) {
            this.state = 'Control';
          } else {
            this._stopRecording();
          }
          break;
        case 'Req Rec' :
          if (!this.recording) {
            this._sendCmd('record');
          } else {
            this.state = 'Record';
          }
          break;
        case 'Record':
          if (!this.recording) {

            console.log('Record but no recording');
            this.state = 'Error';
            this.code = 'NoRec'
          } else {
            this._getTimer();
          }
          if (this.timer === 0) {
            console.log('starting seconds timer');
            this.timer = setInterval(() => this.seconds++, 1000);
          }
          break;
        case 'Sleep':
          if (this.timer !== 0) {
            clearInterval(this.timer);
            this.timer = 0;
          }
          this.mic = ''; //will shut down the volume stream
          break;
        default: 
          
          /* 
            We had an error - so will display it, but target
            will lead the way out
          */
          this.colour='led-red';
          this.target = `error-${this.target}`;
      }
      console.groupEnd();
    } 

    if (changed.has('connected') && changed.get('connected') !== undefined) {
      console.log('Connected changed to ', this.connected);
      if (this.connected && this.state === 'No Mic') this.state = 'Monitor';
      if (!this.connected && this.state !== 'Closed' && this.state !== 'Initialise') this.state = 'No Mic';
    }

    if(changed.has('taken') && changed.get('taken') !== undefined) {
      console.log('Taken has changed to ', this.taken);
      if (this.state === 'Await R' && !this.taken) this.state = 'Monitor';
    }

    if (changed.has('controlling') && changed.get('controlling') !== undefined) {
      console.log('Controlling Changed to ', this.controlling);
      if (this.controlling) {
        if (this.state === 'Req Ctl') this.state = 'Control';
      } else {
        if (this.recording) {
          this.recording = false; //this will reset the state or error
          this.state = 'Error'
          this.code = 'NoCtl';
        } else if (this.state !== 'Closed') {
          this.state = 'Monitor';
        }
      }  
    }

    if(changed.has('recording') && changed.get('recording') !== undefined) {
      console.log('Recording Changed to ', this.recording);
      if (this.recording) {
        if (!this.controlling) {
          console.log('Recording Change to on, error because controlling not set')
          this.state = 'Error';
          this.code = 'NoCtl';
        } else {
          this.state = 'Record';
          this.seconds = 0;
        }
      } else if (this.controlling) {
          this.state = 'Control'
      } else if (this.state !== 'Closed') {
          this.state = 'Monitor';  
      }
    }

    if (changed.has('mode') && this.mode.length > 0) {
      console.log('Mode changed to ', this.mode);
      if (this.mode === 'Monitor') {
        this.target = 'Monitor';
      } else if (this.target !== 'Record') {  //Only record stays were it is
        this.target = 'Control';
      }
    }

    if(changed.has('mic') && this.mic.length > 0) {
      console.log('Mic change to ', this.mic);
      //Just make sure we have the time if the new mic is connected
      if(this.connected) this._getTimer();
    }  
    console.groupEnd();
    super.updated(changed);
  }
  firstUpdated() {
    this.volume = this.shadowRoot.querySelector('#volume');
  }
  render() {
    return html`
      <style>
        #icon {
          /* create a gradient to represent glowing blue light and then mask it with the logo image */
          grid-area: logo;
          -webkit-mask-image: url(/images/recorder-icon.svg);
          -webkit-mask-position: 0 0;
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          mask-image: url(/images/recorder-icon.svg);
          mask-position: 0 0;
          mask-size: contain;
          mask-repeat: no-repeat; 
          background: radial-gradient(#3F8CFF, #24E0FF );
          height: 80px;
          width:80px
        }
        #case {
          border-radius: 20px;
          padding: 20px;
          background-color: #380c27;
          background-image: url('/images/light-aluminium.png');
          background-repeat: repeat;
          height: 560px;
          width: 730px;
          display: grid;
          grid-gap: 5px;
          grid-template-areas:
            "logo led volume"
            "button reset volume"
            "mode mic volume"
            "lcd lcd volume";
          grid-template-columns: 4fr 4fr 5fr;
          grid-template-rows: 1fr 2fr 2fr 3fr;

        }
        rec-led {
          grid-area: led;
        }

        rec-switch {
          grid-area: switch;
        }
        rec-lcd {
          grid-area: lcd;
        }
        rec-record-button {
          grid-area: button;
        }
        rec-volume {
          grid-area: volume;
        }
        rec-reset-button {
          grid-area: reset;
        }
        #mode {
          grid-area:mode;
        }
        #mic {
          grid-area: mic;
        }
        .feet {
          padding: 0 50px;
          display: flex;
          align-items: stretch;
          justify-content: space-between;

        }
        .foot {
          height:30px;
          width: 100px;
          background-image: 
            -webkit-repeating-linear-gradient(left, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0)   6%, hsla(0,0%,100%, .1) 7.5%),
            -webkit-repeating-linear-gradient(left, hsla(0,0%,  0%,0) 0%, hsla(0,0%,  0%,0)   4%, hsla(0,0%,  0%,.03) 4.5%),
            -webkit-repeating-linear-gradient(left, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0) 1.2%, hsla(0,0%,100%,.15) 2.2%),
            linear-gradient(to right, #E5E5E5 , white 50%, #E5E5E5);

        }

      </style>
      <div id="case">
        <div id="icon" @click=${this._downloadCert}></div>
        <rec-led .colour=${this.colour} style="--led-size: 12px;"></rec-led>
        <rec-record-button ?enabled=${this.controlling} ?pushed=${this.recording} @record-change=${this._recordChange}></rec-record-button> 
        <rec-reset-button ?enabled=${this.controlling && !this.recording} @loud-reset=${this._loudReset}></rec-reset-button> 
        <round-switch title="Mode" id="mode" ?locked=${this.recording || (!this.connected && this.mode === 'Monitor')} .choices=${this.modes} .selected=${this.mode} @selection-change=${this._modeChange}></round-switch>
        <round-switch title="Mic" id="mic" .choices=${this.mics} .selected=${this.mic} @selection-change=${this._micChange}></round-switch>
        <rec-lcd
          .alt=${!this.connected && this.filename.slice(-5) !== '.flac'} 
          .channel=${this.micname}
          .state=${this.state}
          .filename=${this.filename}
          .loudness=${this.loudness}
          .leftpeak=${this.leftpeak}
          .rightpeak=${this.rightpeak}
          .seconds=${this.seconds}
          .code=${this.code}
        ></rec-lcd>
        <rec-volume id="volume" .channel=${this.connected ? this.mic:''} @loudness-change=${this._newLoudness}></rec-volume>
      </div>
      <div class="feet">
        <div id="left" class="foot"></div>
        <div id="right" class="foot"></div>
      </div>
    `;
  }
  _callApi(func,channel,token) {
    try {
      const response = await fetch(`/api/${channel}${token? '/' + token : ''}/${func}`);
      return await response.json(); 
    } catch(err) {
      console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
      this.state = 'Error';
      this.code = 'Comms';
  
    }
    return {state: false};
  }
  
  _downloadCert() {
    this.link.setAttribute('href', '/assets/akc-crt.pem');
    this.link.setAttribute('download','akc-crt.pem');
    this.link.click();

  }
  _eventAdd(e) {
    try {
      const initialMicsLength = mics.length;
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
          name: name,
          mode: 'Unknown',
          recording: false, 
          filename: ''
        }
        const micU = channel.charAt(0).toUpperCase() + channel.substring(1);
        if(!this.mics.find(aMic => micU === aMic)) {
          this.mics.push(micU);
        }
      } else Object.assign(this.micstate[channel],{connected: true, name: name});
      if (initialMicsLength !== mics.length) {
        this.mics = this.mics.slice();//remake mics so we pick up change
      }
      if (this.altMic.length === 0 && this.mic !== channel && !this.micstate[this.mic].connected) this.altMic = channel;
      sendStatus();
    } catch (e) {
      console.warn('Error in parsing Event Add:', e);
      sendError('Add');
    }
  }
  
  _eventClose() {
    //the server is closing down, so reset everything to wait for it to come up again
    for (const mic in this.micstate) {
      Object.assign(this.micstate[mic], {taken: false , recording: false, contolling: false, connected: false});
      if (this.micstate[mic].ticker !== undefined) this.micstate[mic].ticker.destroy();
      delete this.micstate[mic].ticker;
    }
    this.state = 'Closed';
   };
  _eventNew(e) {
    try {
      const {client,renew} = JSON.parse(e.data);
      this.client = client;
      this.renew = renew;
    } catch (err) {
      console.warn('Error in parsing Event New Id:', e);
      this.state = 'Error';
      this.code = 'NewId';     
    }
  }
  _eventRelease(e) {
    try {
      const {channel} = JSON.parse(e.data);     
      Object.assign(this.micstate[channel], {taken :false, client: '', token:'', controlling: false, recording: false});
      if (this.micstate[channel].ticker !== undefined) this.micstate[channel].ticker.destroy();
      sendStatus();
    } catch (e) {
      console.warn('Error in parsing Event Release:', e);
      sendError('Rlse')
    }
  }
  _eventRemove(e) {
    try {
      const {channel} = JSON.parse(e.data);
      Object.assign(this.micstate[channel], {taken: false, client: '', token: '', connected:false, controlling: false, recording:false});
      if (this.micstate[channel].ticker !== undefined) this.micstate[channel].ticker.destroy();
      if (this.altMic === channel) {
        this.altMic = '';
        for (mic in this.micstate) {
          if(mic !== this.mic && this.micstate[mic].connected) {
            this.altMic = mic;
            break;
          }
        }
      }
      sendStatus();
    } catch (e) {
      console.warn('Error in parsing Event Remove:', e);
      sendError('Rmve');
    }
  }
  
  _eventReset(e) {
    try {
      const {channel} = JSON.parse(e.data);
      if (channel === this.mic) self.postMessage(['reset', channel]);
    } catch (e) {
      console.warn('Error in parsing Event Reset', e);
      sendError('Rset');
    }
  }
  _eventStatus(e) {
    try {
      const initialMicsLength = mics.length;
      const status = JSON.parse(e.data);
      let possibleMic = '';
      let firstMic = '';
      for (const mic in status) {
        if (firstMic.length === 0) {
          firstMic = mic;
        }
        if (status[mic].connected) {
          if (possibleMic.length === 0) possibleMic = mic;
          if (this.altMic.length === 0 && this.mic.length > 0 && this.mic !== mic) this.altMic = mic;
         } else if (this.altMic === mic) this.altMic = '';  //no longer connected so reset this.altMic
        if (this.micstate[mic] === undefined) {
          this.micstate[mic] = {};
          Object.assign(this.micstate[mic],{
            //initial defaults
            connected: false, 
            taken: false, 
            token: '', 
            client: '',
            name: name,
            mode: 'Unknown',
            recording: false, 
            filename: ''
    
          }, status[mic]);
  
        } else {
          if (status[mic].name !== undefined && status[mic].name.length === 0) delete status[mic].name; //don't overwrite a name with blank once we have captured it.
          const controlling = status[mic].connected && status[mic].taken && status[mic].client === this.client;
          Object.assign(this.micstate[mic], status[mic]);
          if (!controlling && this.micstate[mic].ticker !== undefined) this.micstate[mic].ticker.destroy(); 
  
        }
        const micU = mic.charAt(0).toUpperCase() + mic.substring(1);
        if(!mics.find(aMic => micU === aMic)) {
          mics.push(micU);
        }
      }
      if (this.mic.length === 0) {
        if (possibleMic.length > 0) {
          this.mic = possibleMic;
        } else {
          this.mic = firstMic;
        }
      }
      if (this.altMic.length === 0 && this.mic.length > 0 && !this.micstate[this.mic].connected) {
        for (const mic in this.micstate) {
          if (mic !== this.mic && this.micstate[mic].connected) {
            this.altMic = mic;
            break;
          }
        }
      }
      if (initialMicsLength !== mics.length) {
        self.postMessage(['mics', mics]);
      }
      sendStatus();
    } catch (e) {
      console.warn('Error in parsing Event Status:', e);
      sendError('Stat')
    }
  }
  
  _eventTake(e) {
    try {
      const {channel,client} = JSON.parse(e.data);
      Object.assign(this.micstate[channel], {client:client, taken: true});
      sendStatus();
    } catch (err) {
      console.warn('Error in parsing Event Remove:', err);
      sendError('ETake');
    }
  
  }
  
  async _getTimer() {
    const mic = this.mic
    try {
      const response = await fetch(`/api/${mic}/timer`);
      const {time} = await response.json();
      if (mic === this.mic) this.seconds = time;
    } catch(err) {
      console.warn('Error response ', err, ' to time request');
      this.state = 'Error';
      this.code = 'Timer';
    }
  }
  async _loudReset() {
    if (this.controlling && !this.recording) {
      if (this.micstate[currentMic].taken && this.micstate[this.mic].client === this.client && !this.micstate[this.mic].recording) {
        const mic = this.mic;
        const {state, timer} = await this.callApi('reset',mic, micstate[mic].token);
        if (state && mic === this.mic) this.seconds = timer;
      } else {
        this.state = 'Error';
        this.code = 'Reset';
      }
    }    
  }

  _micChange(e) {
    console.group('Sending Switch Change')
    const newMic = e.detail.toLowerCase()
    console.log('change ', newMic);
    //check that the value received is a known mic
    if (this.micstate.hasOwnProperty(newMic)) {
      if (this.mic !== newMic) {
        this.mic = newMic;
        if (this.altMic.length === 0 && !this.micstate[this.mic].connected) {
          for (const mic in this.micstate) {
            if (mic !== this.mic && thiss.micstate[mic].connected) {
              this.altMic = mic;
              break;
            }
          }
        }      
        this._setStatus();
      }
    } else {
      this.status = 'Error';
      this.code = 'Mic'
    }

    console.groupEnd();
  }
  _modeChange(e) {
    this.mode = e.detail;
  }
  _newLoudness(e) {
    this.loudness = e.detail.integrated;
    this.leftpeak = e.detail.leftPeak;
    this.rightpeak = e.detail.rightPeak;
  }
  _recordChange(e) {
    if (this.controlling) {
      this.target = e.detail ? 'Record' : 'Control'
    }
  }

  async _releaseControl() {
    if (this.micstate[this.mic].taken && this.micstate[this.mic].client === this.client && !this.micstate[this.mic].recording) {
      const mic = this.mic;
      if (this.micstate[mic].ticker !== undefined) this.micstate[mic].ticker.destroy();
      const {state} = await this._callApi('release', mic, this.micstate[mic].token);
      if (state) {
        Object.assign(this.micstate[mic], {taken: false, client: ''});
        this._setStatus();
      } else {
        if(mic = this.mic) {
          this.state = 'Error',
          this.code = 'Give';
        }
      }
    } else {
      this.state = 'Error',
      this.code = 'Give';
    }
  }
  
  _sendCmd(cmd) {
    console.group('Send Command');
    console.log('sending command ', cmd, ' with mic ', this.mic);
    this.worker.postMessage([cmd,this.mic]);
    console.groupEnd();
  }
  _setStatus() {
    //purpose of this routine is to manage the various changes that have occurred and set our state accordingly
    console.group('Set Status');
    console.log('SS - state before ', this.state);
    switch (this.state) {
      case 'Closed':
      case 'Initialise':
        this.state = 'No Mic';
        break;
      case 'Sleep':
        this.state = 'Awaken';
        break;
    }
    console.log('SS - state after ', this.state);
    if (this.micstate[this.mic].mode === 'Unknown') {
      console.group('Update Micstate Mode');
      console.log('MS - mode ', this.mode);
      if (this.target !== 'Record') {
        console.log('MS - target set to mode from ', this.target);
        //might be in startup mode, so lets set target
        this.target = this.mode;
      }
      this.micstate[this.mic].mode = this.mode;
      console.groupEnd();
    } else {
      console.log('changing mode from ', this.mode, ' to ', this.micstate[this.mic].mode);
      this.mode = this.micstate[this.mic].mode;
    }
    const alt = micstate[currentMic].connected ? '' : (this.altMic.length > 0 ? micstate[this.altMic].name : ''),
    this.connected = this.micstate[this.mic].connected;
    this.micname = this.micstate[this.mic].name;
    this.taken = this.micstate[this.mic].taken;
    this.controlling = this.micstate[this.mic].taken && this.micstate[this.mic].client === this.client;
    this.recording = this.micstate[this.mic].recording;
    this.filename = (alt.length > 0 && !this.connected)? alt: this.micstate[this.mic].filename;
    console.groupEnd();
    }
    async _startRecording() {
      if (this.micstate[this.mic].taken && this.micstate[this.mic].client === this.client && !this.micstate[this.mic].recording) {
        const mic = currentMic;
        const {state,name} = await this._callApi('start', mic,this.micstate[mic].token);
        if (state) {
          Object.assign(this.micstate[mic], {recording: true, filename: name});
          this._setStatus();
        } else {
          if(mic === this.mic) {
            this.state = 'Fail';
            this.code = 'Rec';
          }
        }
    
      } else {
        this.state = 'Error';
        this.code = 'Rec';
      }
    }
      async _stopRecording() {
    if (this.micstate[this.mic].taken && this.micstate[this.mic].client === this.client && this.micstate[this.mic].recording) {
      const mic = currentMic;
      const {state,kept} = await this._callApi('stop', mic, micstate[mic].token)
      this.micstate[mic].recording = false;
      if (!kept) micstate[mic].filename = '';
      if (state) {
        this._setStatus();
      } else {
        this.state = 'Fail';
        this.code = 'Stop';
      }
    } else {
      this.state = 'Error';
      this.code = 'Stop';
    } 
  
  }
  
  async _takeControl() {
    if (!this.micstate[this.mic].taken) {
      const mic = this.mic;
      const {state,token} = await this._callApi('take', mic, this.client)
      console.group('Take Control')
      if (state) {
        console.log('TC - positive response with token ', token );
        Object.assign(this.micstate[mic], {
          token: token, 
          taken: true, 
          client: this.client, 
          ticker:  new Ticker(this.renew * 1000) //create a renew ticker 
        });
        this._setStatus();
        try {
          while(true) {
            console.log('TC - awaiting next tick');
            await this.micstate[mic].ticker.nextTick;
            console.log('TC - got tick, about to renew');
            const {state, token} = await callApi('renew', mic, micstate[mic].token);
            if (state) {
              console.log('TC - positive renew with token ', token);
              micstate[mic].token = token;
            } else {
              console.log('TC - negative renew');
              this.micstate[mic].token = '';
              if (this.micstate[mic].taken && this.micstate[mic].client === this.client) {
                Object.assign(this.micstate[mic], {taken: false, client: ''});
              }
              this._setStatus();
              this.micstate[mic].ticker.destroy(); //no last as we will invoke immediate catch and want to have completed other stuff first
            }
          }
  
        } catch(err) {
          console.log('TC - ticker destroyed');
          //someone closed the ticker
          delete this.micstate[mic].ticker;
        }
      } else {
        if (mic === this.mic) {
          this.state = 'Await R'; //someone else has it so we have to wait
        }  
      }
      console.groupEnd();
  
    
    } else {
      this.state = 'Await R';
    }
  }
  _visibilityChange() {
    if (document.hidden) {
      remoteLog('Page About to Hide', this.client);
      //we need to look at all the mics.  If we are recording keep going, but if not then we should release control.
      let foundRecording = false;
      for(const mic in micstate) {
        if (micstate[mic].taken && micstate[mic].client === this.client) {
          if (micstate[mic].recording) {
            remoteLog('Still Recording on Mic ' + mic, this.client);
            foundRecording = true;
          } else {
            remoteLog('Releasing Mic ' + mic, this.client)
            //we must release any taken mics if we are not recording on them directly, we havn't time to wait
            fetch(`/api/${this.client}/${this.micstate[mic].token}/release`); 
          }
        }
      }
      this.eventSrc.removeEventListener('add', this._eventAdd);
      this.eventSrc.removeEventListener('close', this._eventClose);
      this.eventSrc.removeEventListener('release', this._eventRelease);
      this.eventSrc.removeEventListener('remove', this._eventRemove);
      this.eventSrc.removeEventListener('reset', this._eventReset);
      this.eventSrc.removeEventListener('status', this._eventStatus);
      this.eventSrc.removeEventListener('take', this._eventTake);
      if (!foundRecording) { 
        remoteLog('Not Recording so Shutting Down', this.client);
        fetch(`/api/${this.client}/done`); ; //tell the server we are going
        this.target = 'Close';       
      } else {
        remoteLog('Recording so Going to Sleep', this.client);
        this.target = 'Hibernate';
      }
      this.eventSrc.close();
      delete this.this.eventSrc;

    } else {
      remoteLog(`Awaken Request Received when we were in ${this.state} state after targetting ${this.target}`, this.client); 
      this.target = 'Initialise';
    }     
  }
}
customElements.define('rec-app', RecApp);
