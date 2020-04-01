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


import './rec-volume.js';
import './rec-led.js';
import './rec-lcd.js';
import './rec-record-button.js';
import './round-switch.js';
import './rec-reset-button.js';

import Ticker from './ticker.js';
import { e } from '../lit/lit-html-ed58d615.js';
function getErrorObject(){
  try { throw Error('') } catch(err) { return err; }
}



class RecApp extends LitElement {

  static get properties() {
    return {
      mics: {type: Array},  //names of mics that we can select (Capitalised)
      mic : {type: String},  //name of mike selected (lower case)
      micname: {type: String}, //Full name of selected Mic (as received)
      modes: {type: Array},   //Available Modes ('Monitor' and 'Control')
      mode: {type: String},   // Currently Selected Mode
      connected: {type: Boolean}, //is the currently selected mic connected
      taken: {type: Boolean}, //This mic is taken by someone (it might be me)
      controlling: {type: Boolean},  //Asked for and received control
      colour: {type: String},  //Led colour
      recording: {type: Boolean}, //State of recording push button (before a recording requested)
      state: {type: String},  //Current state of selected mic (main are 'No Mic', 'Monitor', 'Control' and 'Record', but intermedate states allowed)
      target:{type: String}, //State we want to reach
      filename: {type: String}, //Name of filename last recording (and kept), or (when state = 'No Mic') name of alternatively connected mic.
      loudness: {type: String}, //Last integrated loudness received from recorder in fixed(1) format for luFS
      leftpeak: {type: String}, //Last peak left channel in fixed(1) format for dbFS
      rightpeak: {type: String}, //Last peak right channel in fixed(1) format for dbFS
      seconds: {type: Number}  //Seconds since loudness last reset
    };
  }
  constructor() {
    super();

    this.subscribeid = Date.now();
    this.micstate = {};
    this.timer = 0;
    this,_statusMessage = this._statusMessage.bind(this);
    this._unload = this._unload.bind(this);

    this.worker = new Worker('status-manager.js');
    this.worker.addEventListener('message', this._statusMessage);
    window.addEventListener('beforeunload', this._unload);
    this.link = document.createElement('a');
    this._resetState();
  }
  connectedCallback() {
    super.connectedCallback();
    this.removeAttribute('unresolved');
    this._resetState();
    this.target = 'Initialise';
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.eventSrc.close();
  }

  updated(changed) {

    if (changed.has('state')) {
      console.group('State Change');
      console.log('from ',changed.get('state'), ' to ', this.state);
      switch (this.state) {
        case 'Close' :
          this.colour = 'led-red';
          if (changed.get('state') !== undefined) { //not first time into here.
            this._resetState(); //ensure everything shuts down until a new stats message is received
          }
          break;
        case 'No Mic':
          if (this.target === 'Close') {
            this.state = 'Close';
          } else if (this.connected) {
            this.state = 'Monitor';
          } else this._altMic();
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
              //Don't overwrite a genuine filename, but if the alt mic text was there clear it
              if(changed.get('state')  === 'No Mic' && this.filename.slice(-5) !== '.flac') this.filename = '';
              if(this.target === 'Control' || this.target === 'Record') {
                this.state = 'Req Ctl';
              } else {
                const mic = this.mic
                this._callApi('timer',this.mic).then(({time}) => {
                  if (mic === this.mic) this.seconds = time;
                });
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
            this._releaseControl()
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
          this.colour = 'led-blue';
          if (!this.controlling) {
            console.log('Change to Control but not controlling');
            this.state = 'Error:T';
            this.target = 'Error-Monitor';
          }
          if (this.timer === 0) {
            console.log('starting second timer');
            this.timer = setInterval(() => this.seconds++, 1000);
          }
          //go get the time, because we might have transitioned from recording to here,
          const mic = this.mic
          this._callApi('timer',this.mic).then(({time}) => {
            if (mic === this.mic) this.seconds = time;
          });        

      break;
        case 'Req Stp':
          if (!this.recording) {
            console.log('Stop Requested but not reccording')
            this.state = 'Error:S';
            this.target = 'Error-Control';
          } else {
            this._stopRecording();
          }
          break;
        case 'Req Rec' :
          if (!this.recording) {
            const mic = this.mic;
            this.colour = 'led-blue';
            this._callApi('start', mic, this.micstate[mic].token).then(({state,name}) => {
              if (state) {
                if (this.mic === mic) {
                  this.filename = name;
                  this.recording = true;
                  this.state = 'Record';
                } else Object.assign(this.micstate[this.mic], {state:'Record',filename: name, recording: true});
              } else {
                console.log('State Change failure to start recording');
                if (this.mic === mic) {
                  this.state = 'Error:R';
                  this.target = 'Error-Record';
                } else this.micstate[this.mic].state = 'Control';
              }
            });
          } else {
            this.state = 'Record';
          }
          break;
        case 'Record':
          if (!this.recording) {

            console.log('Record but no recording');
            this.state = 'Error:R';
            this.target = 'Error-Control';
          } else {
            const mic = this.mic
            this._callApi('timer',this.mic).then(({time}) => {
              if (mic === this.mic) this.seconds = time;
            });        
          }
          if (this.timer === 0) {
            console.log('starting second timer');
            this.timer = setInterval(() => this.seconds++, 1000);
          }
      break;
        default: 
          
          /* 
            We had an error - so will display it, but target
            we lead the way out
          */
          this.colour='led-red';
      }
      console.groupEnd();
    } 
    if (changed.has('connected')) {
      if (this.connected && this.state === 'No Mic') this.state = 'Monitor';
      if (!this.connected) this.state = 'No Mic';
    }
    if (changed.has('mode') && this.mode.length > 0) {
      if (this.target !== 'Initialise') {
        if (this.mode === 'Monitor') {
          this.target = 'Monitor';
        } else if (this.target === 'Monitor') {
          this.target = 'Control';
        }
      }
    }
    if (changed.has('controlling')) {
      if (changed.get('controlling') !== undefined) {
        if (this.controlling) {
          if (this.state === 'Req Ctl') this.state = 'Control';
        } else {
          if (this.recording) {
            this.recording = false; //this will reset the state or error
          } else if (this.state === 'Req Rel') {
            this.state = 'Monitor';
          } else if (this.state !== 'Monitor' && this.state !== 'No Mic' && this.state !== 'Close') {
            console.log('Controlling Change, Error because state is ', this.state);
            this.state = 'Error:C';
            this.target = 'Error-Monitor';
          }
        }
      }
    }

    if(changed.has('recording')) {
      if(changed.get('recording') !== undefined) {
        if (this.recording) {
          if (!this.controlling) {
            console.log('Recording Change to on, error because controlling not set')
            this.state = 'Error:R';
            this.target = 'Error-Monitor';
          } else {
            this.state = 'Record';
          }
        } else if (this.controlling) {
            if (this.state === 'Req Stp' || this.state === 'Control') {
              this.state = 'Control'
            } else {
              this.state = 'Error:S';
              this.target = 'Error-Control';
            }
        } else if (this.state !== 'No Mic' && this.state !== 'Monitor' && this.state !== 'Close') {
          console.log('Recording Change - Error because not recording or controlling but state is ', this.state);
          this.state = 'Error:S';
          this.target('Error-Monitor')
        }
      }
    }
    if (changed.has('target')) {
      console.group('Target Change')
      console.log('from ', changed.get('target'), ' to ', this.target);
      switch (this.target) {
        case 'Close':
          this.state = 'Close';
          this.postMessage('Close');
          break;
        case 'Initialise':
          this.target = 'Monitor';
          console.log('Change target to Monitor');
          this.worker.postMessage('Start');
          this.worker = new Worker('status-manager.js');
          this.worker.addEventListener('message', this._statusMessage);
          break;
        case 'Monitor': 
          if (this.mode === 'Control') {
            console.log('change target to Control');
            this.target = 'Control';
          } else {
            switch(this.state) {
              case 'Close':
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
              case 'Close':
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
              case 'Close':
                this.state = 'No Mic';
              case 'Monitor':
                this.state = 'Req Ctl';
              case 'Control':
                this.state = 'Req Rec';
            }
          }
          break;
        default:
          /*
            We use the opportunity with these target values to wait in a state in for 5 seconds, but still
            show were we are going next
          */
          const mic = this.mic; 
          const nextTarget = this.target.replace(/^Error-(.*)$/,'$1');
          console.log('Change target to ', nextTarget, ' in 5 seconds');
          setTimeout(() =>{
            if (mic === this.mic) {
              //we are still on the same mic
              console.log('still on same mic changing target to ', nextTarget, ' after 5 seconds');
              this.target = nextTarget;
              this.state = 'No Mic';
            } else {
              console.log('difference mic changing target to ', nextTarget, ' after 5 seconds');
              this.micstate[mic].target = nextTarget;
              this.micstate[mic].state = 'No Mic';
            }
          },5000);
      }
      console.groupEnd();
    }


    if(changed.has('mic') && this.mic.length > 0) {
      const old = changed.get('mic');
      console.group('Mic Change');
      console.log('From ', old ,' To ', this.mic)
      if (old.length > 0) {
        if(!this.connected && this.state === 'No Mic') this.filename = '';
        console.log('From Mode ',this.mode, ' Connected ', this.connected, 
        ' Controlling ', this.controlling, ' Recording ', this.recording, ' Filename ', this.filename );

        Object.assign(this.micstate[old], {
          connected: this.connected,
          state: this.state, 
          target: this.target,
          mode: this.mode,
          recording: this.recording,
          controlling: this.controlling,
          filename: this.filename 
        });
      }
      this.connected = this.micstate[this.mic].connected;
      this.controlling = this.micstate[this.mic].controlling;
      this.recording = this.micstate[this.mic].recording;
      this.mode = this.micstate[this.mic].mode;
      this.filename = this.micstate[this.mic].filename;
      console.log('To Mode ',this.mode, ' Connected ', this.connected, 
      ' Controlling ', this.controlling, ' Recording ', this.recording, ' Filename ', this.filename );
      console.log('State from ', this.state, ' to ',this.micstate[this.mic].state);
      console.log('Target from ', this.target,' to ', this.micstate[this.mic].target );
      console.groupEnd()
      this.state = this.micstate[this.mic].state;
      this.target = this.micstate[this.mic].target;
      this.micname = this.micstate[this.mic].name;
      this._altMic(); //check for alt mic just to be safe.
      //Just make sure we have the time if the new mic is connected
      if(this.connected) {
        const mic = this.mic
        this._callApi('timer',this.mic).then(({time}) => {
          if (mic === this.mic) this.seconds = time;
        });        
      }

    }  
    
    super.updated(changed);
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
          .alt=${!this.connected} 
          .channel=${this.micname}
          .state=${this.state}
          .filename=${this.filename}
          .loudness=${this.loudness}
          .leftpeak=${this.leftpeak}
          .rightpeak=${this.rightpeak}
          .seconds=${this.seconds}
        ></rec-lcd>
        <rec-volume id="volume" .channel=${this.connected ? this.mic:''} @loudness-change=${this._newLoudness}></rec-volume>
      </div>
      <div class="feet">
        <div id="left" class="foot"></div>
        <div id="right" class="foot"></div>
      </div>
    `;
  }
  _altMic() {
    if (this.state === 'No Mic') {
      this.filename = '';
      for (const mic in this.micstate) {
        if ( mic !== this.mic && this.micstate[mic].connected) {
          this.filename  = this.micstate[mic].name;
          break;
        }
      }
    }
  }
  async _callApi(func,channel,token) {
    try {
      const response = await fetch(`/api/${channel}${token? '/' + token : ''}/${func}`);
      return await response.json(); 
    } catch(err) {
      console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
      this.color = 'led-red'; //this is our external showing that all is not well.
      this.state = 'Error:C';
      this.target = `Error-${this.target}`;  //Just continue where we left off
    }
    return {state: false};
  }
  _downloadCert() {
    this.link.setAttribute('href', '/assets/akc-crt.pem');
    this.link.setAttribute('download','akc-crt.pem');
    this.link.click();

  }

  }
  _loudReset() {
    if (this.controlling && !this.recording) {
      const mic = this.mic
      this._callApi('reset',mic, this.micstate[mic].token).then(({state, timer}) => {
        if (state && mic === this.mic) {
          this.seconds = timer;
        }
      });
    }

  }
  _micChange(e) {
    this.mic = e.detail.toLowerCase();
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
  _releaseControl() {
    const mic = this.mic;
    if (this.micstate[mic].ticker !== undefined) this.micstate[mic].ticker.destroy();
    this.state = 'Req Rel'
    this._callApi('release', mic, this.micstate[mic].token).then(({state}) => {
      if (mic === this.mic) {
        if (state) {
          this.state = 'Monitor';
        } else {
          this.state = 'Error G';
          this.target = `Error-${this.target}`;  //continue were we are heade
        }
      } else this.micstate[mic] = 'Monitor';
      Object.assign(this.micstate[mic], {taken: false, client: ''});
    });
  }
  _resetState() {
    this.mics = [];
    this.mic = '';
    this.micname = '';
    this.modes = ['Monitor', 'Control']
    this.mode = 'Monitor';
    this.target = 'Close';
    this.connected = false;
    this.controlling = false;
    this.recording = false;
    this.colour = 'led-red';  //initial state is blinking red
    this.state = 'Close';
    this.filename = ''
    this.loudness = '';
    this.leftpeak = '';
    this.rightpeak = '';
    this.seconds = 0;
    for (mic in this.micstate) {
      if (this.micstate[mic].ticker !== undefined) {
        this.micstate[mic].ticker.destroy();
      }
    }
    this.micstate = {};
  }
  _stopRecording() {
    const mic = this.mic;
    this._callApi('stop', mic, this.micstate[mic].token).then(({state,kept}) => {
      if (mic === this.mic) {
        this.recording = false;
        if (!(state && kept)) this.filename = '';
      } else {
        this.micstate[mic].recording = false;
        if (!(state && kept)) this.micstate[mic].filename = '';
      } 
    });

  }
  _takeControl() {
    const mic = this.mic;
    this._callApi('take', mic, this.subscribeid).then( async ({state,token}) => {
      if (state) {
        console.log('Took Control with Token ',token);
        this.micstate[mic].token = token;
        if (this.mic === mic) {
          this.controlling = true;
          this.colour = 'led-blue';
        } else this.micstate[mic].controlling = true
        this.micstate[mic].ticker = new Ticker(4*60*1000); //create a renew ticker for 4 minutes        
        try {
          while(true) {
            const {tickCounter, promiseCounter} = await this.micstate[mic].ticker.nextTick;
            const {state, token} = await this._callApi('renew', mic, this.micstate[mic].token);
            if (state) {
              this.micstate[mic].token = token;
            } else {
              this.micstate[mic].token = '';
              if (this.mic === mic) {
                this.controlling = false;
                this.colour = 'led-red';
              } else Object.assign(this.micstate[mic], {controlling: false});
              this.micstate[mic].ticker.destroy();
            }
          }

        } catch(err) {
          //someone closed the ticker
          delete this.micstate[mic].ticker;
        }
      } else {
        if (mic === this.mic) {
          this.state = 'Await R';
          this.colour = 'led-red';
        } else  this.micstate[mic].state = 'Await R';
      }
    });

  }
  async _unload() {
    this.worker.terminate();     
  }
}
customElements.define('rec-app', RecApp);