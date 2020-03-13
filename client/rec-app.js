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



import { LitElement, html, supportsAdoptingStyleSheets } from '../lit/lit-element.js';

import './rec-volume.js';
import './rec-led.js';
import './rec-record-button.js';

class RecApp extends LitElement {

  static get properties() {
    return {
      channel : {type: String},
      availableChannels: {type: Array},
      colour: {type: String},
      taken: {type: Boolean},
      pushed: {type: Boolean}
    };
  }
  constructor() {
    super();
    this.subscribeid = Date.now();
    this.channel = '';
    this.availableChannels = [];
    this.colour = 'led-red';  //initial state is blinking red
    this.taken = false;
    this.pushed = false;
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
    this.channel = '';
    this.availableChannels = [];
    this.colour = 'led-red';  //initial state is blinking red
    this.taken = false;
    this.pushed = false;
    this.eventSrc = new EventSource('/api/status/' + this.subscribeid);
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
          height: 560px;
          width: 480px;
          display: grid;
          grid-gap: 10px;
          grid-template-areas:
            "logo led volume"
            "switch switch volume"
            ". . volume"
            "button button volume";
          grid-template-columns: 3fr 3fr 4fr;
          grid-template-rows: 1fr 2fr 1fr 2fr;

        }
        rec-led {
          grid-area: led;
        }
        rec-switch {
          grid-area: switch;
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
        <rec-record-button ?enabled=${this.taken} ?pushed=${this.recording} @record-change=${this._recordChange}></rec-record-button>  
        <rec-volume id="volume" .availableChannels=${this.availableChannels} .channel=${this.channel}></rec-volume>
      </div>
      <div class="feet">
        <div id="left" class="foot"></div>
        <div id="right" class="foot"></div>
      </div>
    `;
  }
  async _callApi(func,channel,token) {
    try {
      const response = await fetch(`/api/recording/${channel}/${func}${token? '/' + token : ''}`);
      return await response.json(); 
    } catch(err) {
      console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
      this.color = 'led-red'; //this is our external showing that all is not well.
    }
    return false;
  }
  _changeChannel(e) {
    if (this.channel !== e.details) {
      const newChannel = e.details;
      const result = this._callApi('release', this.channel, this.token);
      if (result.state) {
        this.token = ''
        this.taken = false
      }
      this.colour = 'led-yellow';
      const result2 = this._callApi('take', newChannel, this.subscribeid);
      if (result2.state) {
        this.taken = true;
        this.channel = newChannel;
        this.token = result2.token;
        this.colour = 'led-blue';
      }
    }
  }
  _eventAdd(e) {
    try {
      const added = JSON.parse(e.data);
      this.state[added.id].connected = true;
      this.state[added.id].name = added.name;
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Add:', e);
      this.colour = 'led-red';
    }

  }
  _eventClose() {
    //the server is closing down, so reset everything to wait for it to come up again
    this.pushed = false;
    this.taken = false;
    this.state = { };
    this.channel = '';
  }
  _eventRelease(e) {
    try {
      const removed = JSON.parse(e.data);
      this.state[removed.id].taken = false;
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Release:', e);
      this.colour = 'led-red';
    }
  }
  _eventRemove(e) {
    try {
      const removed = JSON.parse(e.data);
      this.state[removed.id].connected = false;
      this.state[removed.id].taken = false;
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Remove:', e);
      this.colour = 'led-red';
    }
  }
  _eventStatus(e) {
    try {
      this.state = JSON.parse(e.data);
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Status:', e);
      this.colour = 'led-red';
    }
  }
  _eventTake(e) {
    try {
      const taken = JSON.parse(e.data);
      this.state[taken.id].connected = true;
      this.state[taken.id].taken = true;
      this.state[taken.id].channel = taken.channel;
      this._manageNewState();
    } catch (e) {
      console.warn('Error in parsing Event Remove:', e);
      this.colour = 'led-red';
    }

  }
  async _manageNewState() {
    this.availableChannels = [];
    let foundCurrentChannel = false;
    for (let channel in this.state) {
      const currentChannel = (this.channel === channel)
      if (this.state[channel].connected) {
        if (currentChannel) foundCurrentChannel = true;
        if (currentChannel && this.taken && !this.state[channel].taken) {
          //we've lost our taken status
          this.taken = false;;
        }
        if (!this.state[channel].taken || (this.taken && currentChannel)) {
          this.availableChannels.push(channel);
        }
      }
    } 
    if (!foundCurrentChannel) {
      this.channel = '';  //ensure we don't think we have a channel
      this.taken = false; //or that we have it taken
    }
    if (this.availableChannels.length > 0) {
      if (!this.taken) {
        //we haven't taken any channel, so lets try to take one
        if (this.channel.length === 0) {
          this.channel = this.availableChannels[0];  //select the first one for now
        }
        const resp = await this._callApi('take',this.channel, this.subscribeid);
        if (resp.state) {
          this.token = resp.token;
          this.taken = true;
          this.colour = 'led-blue';
        }
      } 
    } else {
      this.colour = 'led-yellow';
    }
  }
  async _recordChange(e) {
    if (this.pushed !== e.detail  && this.taken) {
      const newPushState = e.detail;
      if (newPushState) {
        const {state} = await this._callApi('start', this.channel, this.token);
        if (state) this.pushed = true
      } else {
        const {state} = await this._callApi('stop', this.channel, this.token);
        if (state) this.pushed = false;
      }
      
    }
    
  }
  async _unload() {
    this.eventSrc.close();

  }
}
customElements.define('rec-app', RecApp);