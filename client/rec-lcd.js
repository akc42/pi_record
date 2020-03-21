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
  static get properties() {
    return {
      width: {type: Number, reflect:true},
      height: {type: Number, reflect: true},
      content: {type: Array}
    };
  }
  constructor() {
    super();
    this.width = 40; //setting default values - happens to be what we will need
    this.height = 3;
    this.content=[];
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
      if (changed.has('width') || changed.has('height')) {
        this.firstUpdated();  //just creates a new screen
      } else if (changed.has('content')) this._displayContent();
    }
    super.update(changed);
  }
  firstUpdated() {
    this.screen = new Screen({
      elem: this.shadowRoot.querySelector('#screen'),
      rows: this.height,
      columns: this.width,
      pixelSize: 1,
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
      if (this.content.length > 0) {
        for(let i = 0; i < Math.min(this.content.length,this.height); i++) {
          this.screen.writeString(this.content[i], i * this.width)
        }
      }
      this.animationInProgress = false;
    });
  }
}
customElements.define('rec-lcd', RecLcd);