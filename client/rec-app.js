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

import Ticker from './ticker.js';
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
      taken: {type: Boolean},  //Asked for and received control
      colour: {type: String},  //Led colour
      pushed: {type: Boolean}, //State of recording push button (before a recording requested)
      recording: {type: Boolean}, //State of recording after recording requested
      micstate: {type: Object}, //Full details of known Microphones
      state: {type: String},  //Current state of selected mic (main are 'No Mic', 'Monitor', 'Control' and 'Record', but other errors statuses allowed)
      filename: {type: String}, //Name of filename last recording (and kept)
      loudness: {type: String}, //Last integrated loudness received from recorder in fixed(1) format for luFS
      leftpeak: {type: String}, //Last peak left channel in fixed(1) format for dbFS
      rightpeak: {type: String} //Last peak right channel in fixed(1) format for dbFS
    };
  }
  constructor() {
    super();
    console.time('rec');
    this.subscribeid = Date.now();
    this._resetState();
    this._eventAdd = this._eventAdd.bind(this);
    this._eventClose = this._eventClose.bind(this);
    this._eventRelease = this._eventRelease.bind(this);
    this._eventRemove = this._eventRemove.bind(this);
    this._eventStatus = this._eventStatus.bind(this);
    this._eventTake = this._eventTake.bind(this);
    this._unload = this._unload.bind(this);
    window.addEventListener('beforeunload', this._unload);
    this.link = document.createElement('a');
  }
  connectedCallback() {
    super.connectedCallback();
    this.removeAttribute('unresolved');
    this._resetState();
    this.eventSrc = new EventSource(`/api/${this.subscribeid}/status`);
    this.eventSrc.addEventListener('add', this._eventAdd);
    this.eventSrc.addEventListener('close', this._eventClose);
    this.eventSrc.addEventListener('release', this._eventRelease);
    this.eventSrc.addEventListener('remove', this._eventRemove);
    this.eventSrc.addEventListener('status', this._eventStatus);
    this.eventSrc.addEventListener('take', this._eventTake);
    this.removeAttribute('resolved');
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.eventSrc.close();
    this.eventSrc.removeEventListener('add', this._eventAdd);
    this.eventSrc.removeEventListener('close', this._eventClose);
    this.eventSrc.removeEventListener('release', this._eventRelease);
    this.eventSrc.removeEventListener('remove', this._eventRemove);
    this.eventSrc.removeEventListener('status', this._eventStatus);
    this.eventSrc.removeEventListener('take', this._eventTake);
  }
  updated(changed) {
    if (changed.has('mic') || changed.has('micstate')) {
      if (this.mic.length > 0 && this.micstate[this.mic] !== undefined) {
        this.micname = this.micstate[this.mic].name;
        if (this.micname.length === 0) {
          //need a temporary name because we don't have the full one yet
          this.micname = this.mic.charAt(0).toUpperCase() + this.mic.substring(1);
        }
      }
    }
    if (changed.has('state')) {
      if (changed.get('state')  === 'No Mic') {
        this.micdata[this.mic].filename = '';
        this.filename = '';
      }
      if (changed.get('state') !== 'New Mic') {
        switch (this.state) {
          case 'Record' :
            const mic = this.mic;
            this.colour = 'led-blue';
            this._callApi('start', mic, this.micdata[mic].token).then(({state,name}) => {
              if (state) {
                this.micdata[mic].recording = true
                this.micdata[mic].filename = name;
                if (this.mic === mic) this.filename = name;
              } else {
                this.micdata[this.mic].state = 'Control';
                if (this.mic === mic) {
                  this.recstate = 'Control';
                }
              }
            });

            break;
          case 'Control':
            this.colour = 'led-blue';
            if (changed.get('state') === 'Record') {
              //we were recording so must now stop
              this._stopRecording();
            } else {
              this._takeControl();
            }
            
            break;
          case 'Monitor':

            this.colour='led-yellow';
            switch (changed.get('state')) {
              case 'Record':
                this._stopRecording();
                break;
              case 'Control':
                this._releaseControl(this.mic);
                break;
            }
          
            break;
          case 'No Mic':
            this.colour - 'led-red';
            switch (changed.get('state')) {
              case 'Record':
                this._stopRecording();
                break;
              case 'Control':
                this._releaseControl(this.mic);
                break;
            }
            break;
          case 'New Mic':
            break;  //do nothing - we will get a new state and undertand where we are
          default: 
            /* 
              we had some sort of error with our eventSrc, to shut it down wait 5 secs and
              then start it up again

              But first we need to shut down if we are holding stuff
            */
            this.colour='led-red';
            switch (changed.get('state')) {
              case 'Record':
                this._stopRecording();
                break;
              case 'Control':
                this._releaseControl(this.mic);
                break;
            }
            this.eventSrc.close();
            this.eventSrc.removeEventListener('add', this._eventAdd);
            this.eventSrc.removeEventListener('close', this._eventClose);
            this.eventSrc.removeEventListener('release', this._eventRelease);
            this.eventSrc.removeEventListener('remove', this._eventRemove);
            this.eventSrc.removeEventListener('status', this._eventStatus);
            this.eventSrc.removeEventListener('take', this._eventTake);
            this.micstate = {};
            setTimeout(() => {
              this.subscribeid = Date.now();//Make a new id so we don't get hung up on the last one
              this.eventSrc = new EventSource(`/api/${this.subscribeid}/status`);
              this.eventSrc.addEventListener('add', this._eventAdd);
              this.eventSrc.addEventListener('close', this._eventClose);
              this.eventSrc.addEventListener('release', this._eventRelease);
              this.eventSrc.addEventListener('remove', this._eventRemove);
              this.eventSrc.addEventListener('status', this._eventStatus);
              this.eventSrc.addEventListener('take', this._eventTake);
              //now we are up and running we will soon get a status event        
            },5000);
        }
      } 

    }
    if (changed.has('mode')) {
      if (this.mic.length > 0) {
        if (this.mode === 'Monitor' && (this.state === 'Control' || this.state === 'Record')) {
          this.micdata[this.mic].state = 'Monitor'
          this.recstate = 'Monitor';
        }
        if (this.mode === 'Control' && this.state === 'Monitor') {
          //we need to try and take control if the microphone is free
          if (!this.micstate[this.mic].taken) {
            this.micdata[this.mic].state = 'Control';
            this.recstate = 'Control';
          }
        }
      }
    }
    if (changed.has('pushed')) {
      if (this.pushed && this.state  === 'Control') {
        this.micdata[this.mic].state = 'Record';
        this.recstate = 'Record';
      } 
      if (!this.pushed && this.state === 'Record') {
        this.micdata[this.mic].state = 'Control';
        this.recstate = 'Control';
      }
    }
    if (changed.has('mic') || changed.has('micstate')) {
      if (this.mic.length > 0 && this.micstate[this.mic] !== undefined) {
        const myMic = this.micstate[this.mic];
        if (myMic.connected) {
          if (this.state === 'Control' || this.state === 'Record') {
            //we might have lost control, or we might not yet have taken it yet
            if (this.taken && (!myMic.taken || myMic.client !== this.subscribeid.toString())) {
              //we have lost control for some reason
              this.micdata[this.mic].state = 'Monitor';
              this.recstate = 'Monitor';
            }
          } else {
            if (!myMic.taken && this.mode === 'Control') {
              //the mic has become free and we are in control mode so try and take it
              this.micdata[this.mic].state = 'Control';
              this.recstate = 'Control'
            } else {
              this.micdata[this.mic].state = 'Monitor';
              this.recstate = 'Monitor';
            }
          }
        } else {
          for(const mic in this.micstate) {
            if (this.micstate[mic].connected) {
              this.filename = this.micstate[mic].name;
              break;
            }
          }
          this.micdata[this.mic].state = 'No Mic';
          this.recstate = 'No Mic';
        }
      } else if (this.mic.length === 0 && this.mics.length > 0) this.mic = this.mics[0].toLowerCase();
    } 
      
    
    super.updated(changed);
  }
  set recstate(state) {
    const newState = state;
    this.updateComplete.then(() => requestAnimationFrame(() => 
      this.state = newState));   
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
          height: 700px;
          width: 600px;
          display: grid;
          grid-gap: 5px;
          grid-template-areas:
            "logo led volume"
            "button button volume"
            "mode mic volume"
            "lcd lcd lcd";
          grid-template-columns: 4fr 4fr 7fr;
          grid-template-rows: 2fr 4fr 4fr 3fr;

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
        <rec-record-button ?enabled=${this.taken} ?pushed=${this.state === 'Record'} @record-change=${this._recordChange}></rec-record-button>  
        <round-switch title="Mode" id="mode" ?locked=${this.pushed} .choices=${this.modes} .selected=${this.mode} @selection-change=${this._modeChange}></round-switch>
        <round-switch title="Mic" id="mic" .choices=${this.mics} .selected=${this.mic} @selection-change=${this._micChange}></round-switch>
        <rec-lcd
          .alt=${this.state === 'No Mic'} 
          .channel=${this.micname}
          .state=${this.state}
          .filename=${this.filename}
          .loudness=${this.loudness}
          .leftpeak=${this.leftpeak}
          .rightpeak=${this.rightpeak}
        ></rec-lcd>
        <rec-volume id="volume" .channel=${this.micstate[this.mic] !== undefined && this.micstate[this.mic].connected ? this.mic:''} @loudness-change=${this._newLoudness}></rec-volume>
      </div>
      <div class="feet">
        <div id="left" class="foot"></div>
        <div id="right" class="foot"></div>
      </div>
    `;
  }
  async _callApi(func,channel,token) {
    try {
      const response = await fetch(`/api/${channel}${token? '/' + token : ''}/${func}`);
      return await response.json(); 
    } catch(err) {
      console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
      this.color = 'led-red'; //this is our external showing that all is not well.
      this.micdata[this.mic].state = 'Comms';
      this.recstate = 'Comms'
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
      const {channel, name} = JSON.parse(e.data);
      const newMic = this.micstate[channel] === undefined;
      Object.assign(this.micstate[channel],{connected: true, taken: false, client: '', name: name});
      this.micstate = Object.assign({},this.micstate);
      if (newMic) {
        this.mics = [];
        for(const mic in this.micstate) {
          const lmic = mic.toLowerCase();
          this.mics.push(lmic.charAt(0).toUpperCase() + lmic.substring(1));
        }
  
        this.micdata[channel] = {
          state: this.micstate[mic].connected ? 'Monitor' : 'No Mic', 
          filename: '', 
          taken: false, 
          token: '',
          recording: false,
          pushed: false,
          mode: 'Monitor'
        };
      }
    } catch (e) {
      console.warn('Error in parsing Event Add:', e);
      this.colour = 'led-red';
      this.recstate = 'Err:Add';
    }

  }
  _eventClose() {
    //the server is closing down, so reset everything to wait for it to come up again
    this.taken = false;
    for (let mic in this.micstate) {
      Object.assign(this.micstate[mic] , {connected: false, taken: false, client:'' });
    }
    this.micstate = Object.assign({},this.micstate);
    this. mic = '';
    this.recstate = 'Closed'
    this.micdata = [];
    if (this.ticker !== undefined) this.ticker.destroy();
  }
  _eventRelease(e) {
    try {
      const {channel} = JSON.parse(e.data);
      Object.assign(this.micstate[channel],{taken: false, client: ''});
      this.micstate = Object.assign({},this.micstate);
    } catch (e) {
      console.warn('Error in parsing Event Release:', e);
      this.colour = 'led-red';
      this.recstate = 'Err:Rel';
    }
  }
  _eventRemove(e) {
    try {
      const {channel} = JSON.parse(e.data);
      Object.assign(this.micstate[channel],{connected: false, taken: false, client: ''});
      this.micstate = Object.assign({},this.micstate);
    } catch (e) {
      console.warn('Error in parsing Event Remove:', e);
      this.colour = 'led-red';
      this.recstate = 'Err:Rem';
    }
  }
  _eventStatus(e) {
    try {
      this.micstate = JSON.parse(e.data);
      this.mics = [];
      for(const mic in this.micstate) {
        const lmic = mic.toLowerCase();
        this.mics.push(lmic.charAt(0).toUpperCase() + lmic.substring(1));
        if (this.micdata[mic] === undefined) this.micdata[mic] = {
          state: this.micstate[mic].connected ? 'Monitor' : 'No Mic', 
          filename: '', 
          taken: false, 
          token: '',
          recording: false,
          pushed: false,
          mode: 'Monitor'
        };
      }
    } catch (e) {
      console.warn('Error in parsing Event Status:', e);
      this.colour = 'led-red';
      this.recstate = 'Err:Sts'
    }
  }
  _eventTake(e) {
    try {
      const {channel,client} = JSON.parse(e.data);
      Object.assign(this.micstate[channel],{taken: true, client: client});
      this.micstate = Object.assign({},this.micstate);
    } catch (err) {
      console.warn('Error in parsing Event Remove:', err);
      this.colour = 'led-red';
      this.recstate = 'Err:Tak'
    }

  }

  _micChange(e) {
    const newMic = e.detail.toLowerCase();
    if (newMic !== this.mic) {
      this.recstate = 'New Mic';
      this.updateComplete.then(() => {
        this.mic = newMic;
        this.recstate = this.micdata[this.mic].state;
        this.taken = this.micdata[this.mic].taken;
        this.filename = this.micdata[this.mic].filename;
        this.mode = this.micdata[this.mic].mode;
        this.pushed = this.micdata[this.mic].pushed;
      });
    }
  }
  _modeChange(e) {
    this.mode = e.detail;
    if (this.mic.length > 0) this.micdata[this.mic].mode = this.mode;
  }
  _newLoudness(e) {
    this.loudness = e.detail.integrated;
    this.leftpeak = e.detail.leftPeak;
    this.rightpeak = e.detail.rightPeak;
  }
  _recordChange(e) {
    this.pushed = e.detail;
    if (this.mic.length > 0) this.micdata[this.mic].pushed = this.pushed;
  }
  _releaseControl(myMic) {
    const mic = myMic;
    this._callApi('release', mic, this.micdata[mic].token).then(({state}) => {
      if (this.micdata[mic].ticker !== undefined) this.micdata[mic].ticker.destroy();      
      this.micdata[mic].taken = false;
      if (mic === this.mic) this.taken = false;
    });



  }
  _resetState() {
    this.mics = [];
    this.micdata = [];
    this.mic = '';
    this.micname = '';
    this.modes = ['Monitor', 'Control']
    this.mode = 'Monitor';
 
    this.taken = false;
    this.colour = 'led-red';  //initial state is blinking red
    this.pushed = false;
    this.state = 'No Mic';
    this.filename = ''
    this.loudness = '';
    this.leftpeak = '';
    this.rightpeak = '';
    this.micstate = {};
    if (this.ticker !== undefined) {
      this.ticker.destroy();      
    }
  }
  _stopRecording() {
    const mic = this.mic;
    this._callApi('stop', mic, this.micdata[mic].token).then(({state,kept}) => {
      if (!(state && kept)) {
        this.micdata[mic].filename = '';
        if (this.mic === mic) this.filename = '';
        
      }
      if (this.micdata[mic].state !== 'Control') {
        this._releaseControl(mic);
      }  
    });

  }
  _takeControl() {
    const mic = this.mic;
    this._callApi('take', mic, this.subscribeid).then( async ({state,token}) => {
      if (state) {
        this.micdata[mic].token = token;
        this.micdata[mic].taken = true;
        if (this.mic === mic) {
          this.taken = true;
          this.colour = 'led-blue';
        }
        this.micdata[mic].ticker = new Ticker(4*60*1000); //create a renew ticker for 4 minutes
        
        try {
          while(true) {
            await this.micdata[mic].ticker.nextTick;
            const {state, token} = await this._callApi('renew', mic, this.micdata[mic].token);
            if (state) {
              this.micdata[mic].token = token;
            } else {
              this.micdata[mic].token = '';
              this.micdata[mic].state = 'Monitor';
              this.micdata[mic].taken = false;
              if (this.mic === mic) {
                this.recstate = 'Monitor';
                this.taken = false;
                this.colour = 'led-yellow';
              }
              this.micdata[mic].ticker.destroy();
            }
          }

        } catch(e) {
          //someone closed the ticker
          delete this.micdata[mic].ticker;
        }
      } else {
        this.micdata[mic].state = 'Monitor';
        if (this.mic === mic) this.recstate = 'Monitor';
      }
    });

  }
  async _unload() {
    this.eventSrc.close();

  }
}
customElements.define('rec-app', RecApp);