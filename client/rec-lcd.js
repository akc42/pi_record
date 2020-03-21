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
import { LitElement, html } from '../lit/lit-element.js';
import { Screen } from './lcd/classes.js';

class RecLcd extends LitElement {
  static PIXEL = 2;
  static COLUMNS = 20;
  static ROWS = 4;
  static CHANNEL_START = 0;
  static CHANNEL_LENGTH = 12;
  static STATE_START = 13;
  static STATE_LENGTH = 7;
  static FILE_START = 20;
  static FILE_LENGTH = 20;
  static LOUD_START = 40;
  static LOUD_LENGTH = 20;
  static PEAK_START = 60;
  static PEAK_LENGTH = 20;
  static get properties() {
    return {
      pixelSize: {type: Number},
      channel: {type: String},
      state: {type:String},
      filename: {type: String},
      loudness: {type: String},
      leftpeak: {type: String},
      rightpeak: {type: String}
    };
  }
  constructor() {
    super();
    this.pixelSize = RecLcd.PIXEL;
    this.channel = '';
    this.state = 'Off';
    this.filename = '';
    this.loudness = '';
    this.leftpeak = '';
    this.rightpeak = '';
    this.animationInProgress = true; //prevents any early display
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.screen !== undefined) {
      this._displayContent();
    }
  }
  update(changed) {
    if (this.screen !== undefined) {
      if (changed.has('pixelSize') ) {
        this.firstUpdated();  //just creates a new screen and displays everything
      } else {
        if (changed.has('channel')) this._displayContent('channel') ;
        if (changed.has('state')) this._displayContent('state');
        if (changed.has('filename')) this._displayContent('filename');
        if (changed.has('loudness')) this._displayContent('loudness');
        if (changed.has('leftpeak') || changed.has('rightpeak')) this._displayContent('peak');
      }
    }
    super.update(changed);
  }
  firstUpdated() {
    this.screen = new Screen({
      elem: this.shadowRoot.querySelector('#screen'),
      rows: RecLcd.ROWS,
      columns: RecLcd.COLUMNS,
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
  _displayContent(field = 'All') {
    const f = field;
    if (this.animationInProgress) return;
    this.animationInProgress = true;
    requestAnimationFrame(() => {
      if (f === 'All') this.screen.clearScreen();
      if (this._shouldDisplay(f, 'channel', RecLcd.CHANNEL_START, RecLcd.CHANNEL_LENGTH)) {
        this.screen.writeString(this.channel.left(RecLcd.CHANNEL_LENGTH));
      } 
      if (this._shouldDisplay(f, 'state', RecLcd.STATE_START, RecLcd.STATE_LENGTH)) {
        this.screen.writeString(this.state.left(RecLcd.STATE_LENGTH));
      } 
      if (this._shouldDisplay(f, 'filename', RecLcd.FILE_START, RecLcd.FILE_LENGTH)) {
        this.screen.writeString(this.filename.left(RecLcd.FILE_LENGTH));
      } 
      if (this._shouldDisplay(f, 'loudness', RecLcd.LOUD_START, RecLcd.LOUD_LENGTH)) {
        const loud = this.loudness.length > 0 ? `Loudness: ${this.loudness.left(5).padStart(5,' ')} LUFS`.left(RecLcd.LOUD_LENGTH) : '';
        this.screen.writeString(loud);
      } 
      if (this._shouldDisplay(f, 'peak', RecLcd.PEAK_START, RecLcd.PEAK_LENGTH)) {
        const peak = this.leftpeak.length > 0 || this.rightpeak.length > 0 ?
          `Peak: ${this.leftpeak.left(5).padStart(5,' ')} ${this.rightpeak.left(5).padStart(5,' ')} dbFS`.left(RecLcd.PEAK_LENGTH) : '';
        this.screen.writeString(peak);
      } 

      this.animationInProgress = false;
    });
  }
  _shouldDisplay(field, screenfield, start, length) {
    if (field === screenfield || field === 'All') {
      if (field !== 'All') {
        for (let i = 0; i < length; i++) {
          this.screen.clearCharacter(start + i);
        }
      };
      return true;
    }
    return false;
  } 
}
customElements.define('rec-lcd', RecLcd);