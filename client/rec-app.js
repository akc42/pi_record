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
import './rec-switch.js';

import Ticker from './ticker.js';

class RecApp extends LitElement {

  static get properties() {
    return {
      channel : {type: String},
      channelname: {type: String},
      availableChannels: {type: Array},
      colour: {type: String},
      taken: {type: Boolean},
      pushed: {type: Boolean},
      state: {type: String},
      filename: {type: String},
      loudness: {type: String},
      leftpeak: {type: String},
      rightpeak: {type: String},
      takeable: {type: Boolean}
    };
  }
  constructor() {
    super();
    this.subscribeid = Date.now();
    this.channel = '';
    this.channelname = '';
    this.availableChannels = [];
    this.colour = 'led-red';  //initial state is blinking red
    this.taken = false;
    this.pushed = false;
    this.state = 'No Mic';
    this.filename = ''
    this.loudness = '';
    this.leftpeak = '';
    this.rightpeak = '';
    this.microphones = {};
    this.takeable = false;
    this._eventAdd = this._eventAdd.bind(this);
    this._eventClose = this._eventClose.bind(this);
    this._eventRelease = this._eventRelease.bind(this);
    this._eventRemove = this._eventRemove.bind(this);
    this._eventStatus = this._eventStatus.bind(this);
    this._eventTake = this._eventTake.bind(this);
    this._unload = this._unload.bind(this);
    window.addEventListener('beforeunload', this._unload);
  }
  connectedCallback() {
    super.connectedCallback();
    this.removeAttribute('unresolved');
    this.channel = '';
    this.availableChannels = [];
    this.microphones = {};
    this.colour = 'led-red';  //initial state is blinking red
    this.taken = false;
    this.pushed = false;
    this.state = 'No Mic';
    this.filename = ''
    this.loudness = '';
    this.leftpeak = '';
    this.rightpeak = '';
    this.channelname = '';
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
    if (changed.has('channel')) {
      if (this.channel.length > 0 && this.microphones[this.channel] !== undefined) {
        if (this.microphones[this.channel].connected) { 
          this.channelname = this.microphones[this.channel].name;
        } else {
          this.channelname = '';
          this.channel = '';
        }
      } else {
        this.channelname = '';
      }
    }
    if (changed.has('takeable')  && this.takeable) {
      this. _takeChannel();
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
          padding: 40px;
          background-color: #380c27;
          background-image: url('/images/light-aluminium.png');
          background-repeat: repeat;
          height: 600px;
          width: 480px;
          display: grid;
          grid-gap: 10px;
          grid-template-areas:
            "logo led volume"
            "switch switch volume"
            "button button volume"
            "lcd lcd lcd";
          grid-template-columns: 2fr 2fr 4fr;
          grid-template-rows: 1fr 2fr 1fr 1fr;

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
        <div id="icon"></div>
        <rec-led .colour=${this.colour} style="--led-size: 12px;"></rec-led>
        <rec-switch .choices=${this.availableChannels} .selected=${this.channel} @switch-change=${this._changeChannel}></rec-switch>
        <rec-lcd 
          .channel=${this.channelname}
          .state=${this.state}
          .filename=${this.filename}
          .loudness=${this.loudness}
          .leftpeak=${this.leftpeak}
          .rightpeak=${this.rightpeak}
        ></rec-lcd>
        <rec-record-button ?enabled=${this.taken} ?pushed=${this.recording} @record-change=${this._recordChange}></rec-record-button>  
        <rec-volume id="volume" .channel=${this.channel} @loudness-change=${this._newLoudness}></rec-volume>
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
      this.state = 'Comms'
    }
    return false;
  }
  _changeChannel(e) {
    if (this.channel !== e.details) {
      const newChannel = e.details;
      const {state} = this._callApi('release', this.channel, this.token);
      if (state) {
        this.token = ''
        this.taken = false
        this.keepRenewing = false;
      }
      this.state = 'Monitor';
      this.colour = 'led-yellow';
      const {result, token} = this._callApi('take', newChannel, this.subscribeid);
      if (result) {
        this.taken = true;
        this.channel = newChannel;
        this.token = token;
        this.state = 'Control';
        this.colour = 'led-blue';
      }
    }
  }
  _eventAdd(e) {
    try {
      const {channel, name} = JSON.parse(e.data);
      Object.assign(this.microphones[channel],{connected: true, taken: false, client: '', name: name});
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Add:', e);
      this.colour = 'led-red';
      this.state = 'Err:Add';
    }

  }
  _eventClose() {
    //the server is closing down, so reset everything to wait for it to come up again
    this.pushed = false;
    this.taken = false;
    this.microphones = {};
    this.channel = '';
    this.state = 'Closed'
    this.ticker.destroy();
  }
  _eventRelease(e) {
    try {
      const {channel} = JSON.parse(e.data);
      Object.assign(this.microphones[channel], {taken:false, client: ''});
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Release:', e);
      this.colour = 'led-red';
      this.state = 'Err:Rel';
    }
  }
  _eventRemove(e) {
    try {
      const {channel} = JSON.parse(e.data);

      this.microphones[channel] = {connected: false, taken: false, client: '', name: ''};
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Remove:', e);
      this.colour = 'led-red';
      this.state = 'Err:Rem';
    }
  }
  _eventStatus(e) {
    try {
      this.microphones = JSON.parse(e.data);
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Status:', e);
      this.colour = 'led-red';
      this.state = 'Err:Sts'
    }
  }
  _eventTake(e) {
    try {
      const {channel,client} = JSON.parse(e.data);
      Object.assign(this.microphones[channel], {connected: true, taken: true, client: client});
      this._manageNewState();
    } catch (err) {
      console.warn('Error in parsing Event Remove:', err);
      this.colour = 'led-red';
      this.state = 'Err:Tak'
    }

  }
  _manageNewState() {
    this.availableChannels = [];
    let foundCurrentChannel = false;
    let firstConnectedChannel = ''
    for (let channel in this.microphones) {
      const currentChannel = (this.channel === channel);
      const microphone = this.microphones[channel];
      if (microphone.connected) {
        if (firstConnectedChannel.length === 0) firstConnectedChannel = channel;
        if (currentChannel) foundCurrentChannel = true;
        if (currentChannel && this.taken && !microphone.taken) {
          //we've lost our taken status
          this.taken = false;
          this.state = 'Monitor';
        }
        if (!microphone.taken || (this.taken && currentChannel)) {
          this.availableChannels.push(channel);
        }
      }
    } 
    if (!foundCurrentChannel) {
      this.channel = '';
      this.taken = false; //or that we have it taken
    }
    if (this.availableChannels.length > 0) {
      if (!this.taken) {
        //we haven't taken any channel, so lets try to take one
        if (this.channel.length === 0) {
          this.channel = this.availableChannels[0];  //select the first one for now
        }
        this._takeChannel();
      } 
    } else {
      this.colour = 'led-yellow';
      if (!foundCurrentChannel && firstConnectedChannel.length > 0) {
        this.channel = firstConnectedChannel;
        this.state = 'Monitor'
      }
    }
  }
  _newLoudness(e) {
    this.loudness = e.detail.integrated;
    this.leftpeak = e.detail.leftPeak;
    this.rightpeak = e.detail.rightPeak;
  }
  async _recordChange(e) {
    if (this.pushed !== e.detail  && this.taken) {
      const newPushState = e.detail;
      if (newPushState) {
        const {state, name} = await this._callApi('start', this.channel, this.token);
        if (state) {
          this.pushed = true
          this.filename = name;
        }
      } else {
        const {state, kept} = await this._callApi('stop', this.channel, this.token);
        this.pushed = false;
        if (!(state && kept)) this.filename = '';
      }
      
    }
    
  }
  _takeChannel() {
    this._callApi('take',this.channel, this.subscribeid).then( async response => {
      if (response.state) {
        this.token = response.token;
        this.taken = true;
        this.colour = 'led-blue';
        this.ticker = new Ticker(4*60*1000); //create a renew ticker for 4 minutes
        this.state = 'Control';
        try {
          let keepRenewing = true;
          while(keepRenewing) {
            await this.ticker.nextTick;
            const {state, token} = await this._callApi('renew', this.channel, this.token)
            if (state) {
              this.token = token;
            } else {
              this.token = '';
              this.state = 'Monitor';
              this.taken = false;
              this.colour = 'led-yellow';
              keepRenewing = false;
            }
          }
        } catch(e) {
          //someone closed the ticker
        }
      }
    });

  }
  async _unload() {
    this.eventSrc.close();

  }
}
customElements.define('rec-app', RecApp);