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
import { LitElement, html } from '../lit/lit.js';
import { Screen } from '../lcd/classes.js';

class RecLcd extends LitElement {
  static get constants() {
    return {
      PIXEL: 2,
      COLUMNS: 20,
      ROWS: 5,
      CHANNEL_START: 0,
      CHANNEL_LENGTH: 12,
      STATE_START: 13,
      STATE_LENGTH: 7,
      FILE_START: 20,
      FILE_LENGTH: 20,
      TIME_START: 80,
      TIME_LENGTH: 14,
      LOUD_START: 40,
      LOUD_LENGTH: 20,
      PEAK_START: 60,
      PEAK_LENGTH: 20,
      CODE_START: 95,
      CODE_LENGTH: 5
    };
  }
  static get properties() {
    return {
      pixelSize: {type: Number},
      channel: {type: String},
      state: {type:String},
      filename: {type: String},
      loudness: {type: String},
      leftpeak: {type: String},
      rightpeak: {type: String},
      alt: {type: Boolean},
      seconds: {type: Number},
      code:{type: String} //error code
    };
  }
  constructor() {
    super();
    this.pixelSize = RecLcd.constants.PIXEL;
    this.channel = '';
    this.state = 'Off';
    this.filename = '';
    this.loudness = '';
    this.leftpeak = '';
    this.rightpeak = '';
    this.code = '';
    this.alt = false;
    this.seconds = 0;
    this.minutes = 0;
    this.hours = 0;
    this.ticker = 0;
    this.animationInProgress = true; //prevents any early display
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.screen !== undefined) {
      this._displayContent();
    }
    this.addEventListener('timer-reset', this._resetTimer);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.ticker !== 0) {
      clearInterval(this.ticker);
      this.ticker = 0;
    }
    this.removeEventListener('timer-reset', this._resetTimer);
  }
  update(changed) {
    if (this.screen !== undefined) {
      if (changed.has('pixelSize') ) {
        this.firstUpdated();  //just creates a new screen and displays everything
      } else {
        if (changed.has('channel') || changed.has('state') || changed.has('filename') || changed.has('loudness') ||
        changed.has('filename')  || changed.has('leftpeak') || changed.has('rightpeak') || changed.has('seconds')) this._displayContent() ;

      }
    }
    super.update(changed);
  }
  firstUpdated() {
    this.screen = new Screen({
      elem: this.shadowRoot.querySelector('#screen'),
      rows: RecLcd.constants.ROWS,
      columns: RecLcd.constants.COLUMNS,
      pixelSize: this.pixelSize,
      pixelColor: "#000"
    });
    this.animationInProgress = false;
    this._displayContent();
  }
  updated(changed) {
    super.updated(changed);
  }
  render() {
    return html`
      <style>
        :host {
          display:flex;
          align-items:center;
          justify-content: center;
        }
        .display {
          padding: 20px 30px;
          background-color: #c7e736;
          color: red;
          display: inline-block;
          font-size: 0px;
          box-shadow: 0px 0px 5px 5px #000000, inset 0px 0px 30px 0px rgba(0, 0, 0, 0.30);
          -webkit-box-shadow: 0px 0px 5px 5px #000000, inset 0px 0px 30px 0px rgba(0, 0, 0, 0.30);
          border-radius: 3px;
          overflow: hidden;
        }
      </style>
      <div id="screen" class="display"></div>
    `;
  }
  _displayContent() {
    if (this.animationInProgress) return;
    this.animationInProgress = true;
    requestAnimationFrame(() => {
      this.screen.clearScreen();
      this.screen.writeString(this.channel.substr(0,RecLcd.constants.CHANNEL_LENGTH),RecLcd.constants.CHANNEL_START);
      this.screen.writeString(this.state.substr(0,RecLcd.constants.STATE_LENGTH),RecLcd.constants.STATE_START);
      const file = this.filename.length > 0 ? `${this.alt? 'Alt Mic': 'File'}: ${this.filename}`.substr(0,RecLcd.constants.FILE_LENGTH) : ''
      this.screen.writeString(file,RecLcd.constants.FILE_START);
      if (!this.alt && this.seconds > 0) {
        const seconds = this.seconds % 60;
        const minutes = Math.floor(this.seconds/60) % 60;
        const hours = Math.floor(Math.floor(this.seconds/60)/60) % 24;
        let timeString = 'Since:' + (hours === 0? '  ' : ('0' + hours.toString()).slice(-2) + ':');
        timeString += ('0' + minutes.toString()).slice(-2) + ':' + ('0' + seconds.toString()).slice(-2);
        this.screen.writeString(timeString.substr(0,RecLcd.constants.TIME_LENGTH),RecLcd.constants.TIME_START);
      }
      const loud = this.loudness.length > 0 ? `Int Loud: ${this.loudness.substr(0,5).padStart(5,' ')} LUFS`.substr(0,RecLcd.constants.LOUD_LENGTH) : '';
      this.screen.writeString(loud, RecLcd.constants.LOUD_START);
      const peak = this.leftpeak.length > 0 || this.rightpeak.length > 0 ?
        `Pk: ${this.leftpeak.substr(0,5).padStart(5,' ')} ${this.rightpeak.substr(0,5).padStart(5,' ')} dbFS`.substr(0,RecLcd.constants.PEAK_LENGTH) : '';
      this.screen.writeString(peak, RecLcd.constants.PEAK_START);
      this.screen.writeString(this.code.substr(0,RecLcd.constants.CODE_LENGTH),RecLcd.constants.CODE_START);
      this.animationInProgress = false;
    });
  }
}
customElements.define('rec-lcd', RecLcd);