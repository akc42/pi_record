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
    this.micname = '';
    this.mics = [];
    this.modes = ['Monitor', 'Control'];
    this.code = '';
    this.mic = '';
    this.mode = 'Control';   //when we start up we want to take control if we can
    this.colour = 'led-red';
    this.state = 'Closed';
    this.target = 'Close';
    this.filename = '';
    this.loudness = this.leftpeak = this.rightpeak = '-70.0';
    this.seconds = 0;
    this.taken = false; 
    this.timer = 0;
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
          const nextTarget = this.target.replace(/^error-(.*)$/,'$1');
          console.log('Change target to ', nextTarget, ' in 5 seconds');
          setTimeout(() =>{
            if (mic === this.mic) {
              //we are still on the same mic
              console.log('still on same mic changing target to ', nextTarget, ' after 5 seconds');
              this.target = nextTarget;
              this.state = 'No Mic';
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
          if (this.worker === undefined) {
            console.group('Create am SM Worker')
            console.log('calling new from Initialise');
            this.worker = new Worker('status-manager.js');
            console.groupEnd();
            this.worker.addEventListener('message', this._statusMessage);
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
            this._sendCmd('give');
          } else {
            this.state = 'Monitor';
          }
          break;
        case 'Req Ctl' :
          if (!this.connected) {
            this.state = 'No Mic'
          } else if (!this.controlling) {
            this._sendCmd('take');
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
            this._sendCmd('stop');
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
      if (this.mic.length > 0) this.worker.postMessage(['mode', this.mode]);
    }

    if(changed.has('mic') && this.mic.length > 0) {
      console.log('Mic change to ', this.mic);
      //tell web worker about the mode, as we didn't before mic was set.
      if (changed.get('mic').length === 0) this.worker.postMessage(['mode', this.mode]);
      //Just make sure we have the time if the new mic is connected
      if(this.connected) this._getTimer();
    }  
    
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

  _downloadCert() {
    this.link.setAttribute('href', '/assets/akc-crt.pem');
    this.link.setAttribute('download','akc-crt.pem');
    this.link.click();

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
  _loudReset() {
    if (this.controlling && !this.recording) this.worker.postMessage(['reset','']);
  }
  _micChange(e) {
    console.group('Sending Switch Change')
    console.log('change ', e.detail);
    this.worker.postMessage(['switch',e.detail.toLowerCase()]) ;
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
  _sendCmd(cmd) {
    console.group('Send Command');
    console.log('sending command ', cmd, ' with mic ', this.mic);
    this.worker.postMessage([cmd,this.mic]);
    console.groupEnd();
  }
  _statusMessage (e) {

    console.group('UI Received Message');
    const func = e.data[0];
    const value = e.data[1];
    console.log('Function: ', func, ' value ', value);
    switch (func) {

      case 'seconds':
        this.seconds = value;
        break;
      case 'close':
        this.state = 'Closed';
        break;
      case 'error':
        this.state = 'Fail';
        this.code = value;
        break;
      case 'reset':
        this.seconds = 0;
        break;
      case 'status':
        switch (this.state) {
          case 'Closed':
          case 'Initialise':
            this.state = 'No Mic';
            break;
          case 'Sleep':
            this.state = 'Awaken';
            break;
        }
        this.mic = value.mic;
        if (value.mode === 'Unknown') {
          console.group('Mode sending');
          console.log('MS - mode ', this.mode);
          if (this.target !== 'Record') {
            console.log('MS - target set to mode from ', this.target);
            //might be in startup mode, so lets set target
            this.target = this.mode;
          }
          this.worker.postMessage(['mode', this.mode])
          console.groupEnd();
        } else {
          this.mode = value.mode;
        }
        this.connected = value.connected;
        this.micname = value.name;
        this.taken = value.taken;
        this.controlling = value.controlling;
        this.recording = value.recording;
        this.filename = (value.alt.length > 0 && !this.connected)? value.alt: value.filename;
        break;
      case 'mics':
        this.mics = value;
        break;
      case 'kill':
        this.worker.terminate();
        delete this.worker;
        this.target = 'Close';
        break;
      case 'sleep':
        this.target = 'Hibernate';
        break;
      default:
        console.warn('Unknown Function ', func, ' received from worker');
    }
    console.groupEnd();
  }
  _visibilityChange() {
    if (document.hidden) {
      console.group('Sleep');
      console.log('sending sleep to worker');
      this.worker.postMessage(['sleep', ''])
      console.groupEnd();
    } else {
      console.group('Awaken');
      if (this.target === 'Hibernate') {
        console.log('sending awaken to worker')
        this.worker.postMessage(['awaken','']);  
      }
      console.log('AW set target to initialise');
      this.target = 'Initialise';
      console.groupEnd();
    }     
  }
}
customElements.define('rec-app', RecApp);