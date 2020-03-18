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

import {classMap} from '../lit/class-map.js';
import {cache} from '../lit/cache.js';

import './material-icon.js';

class RecRecordButton extends LitElement {
  static get properties() {
    return {
      enabled: {type: Boolean},
      pushed: {type: Boolean}
    };
  }
  constructor() {
    super();
    this.enabled = false;
    this.pushed = false;
  }
  connectedCallback() {
    super.connectedCallback();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
  }
  update(changed) {
    if (changed.has('pushed')) {
      this.dispatchEvent(new CustomEvent('record-change',{
        bubbles: true,
        cancel: true,
        detail: this.pushed
      }));
    }

    super.update(changed);
  }
  firstUpdated() {
  }
  updated(changed) {
    if (changed.has('enabled') && !this.enabled) {
      this.pushed = false;
    }
    super.updated(changed);
  }
  render() {
    return html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background:transparent;
          position:relative;
        }
        .outer {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 80px;
          width: 80px;
          margin:0;
          position:absolute;
          border-radius:50%;
          border-width: 5px;
          border-style: solid;
          border-color: transparent;

          background-image: -webkit-radial-gradient(  50%   0%,  8% 50%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
            -webkit-radial-gradient(  50% 100%, 12% 50%, hsla(0,0%,100%,.6) 0%, hsla(0,0%,100%,0) 100%),
            -webkit-radial-gradient(   0%  50%, 50%  7%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
            -webkit-radial-gradient( 100%  50%, 50%  5%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
            
            -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,  0%,0) 0%, hsla(0,0%,  0%,0)   3%, hsla(0,0%,  0%,.1) 3.5%),
            -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0)   6%, hsla(0,0%,100%,.1) 7.5%),
            -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0) 1.2%, hsla(0,0%,100%,.2) 2.2%),
            
            -webkit-radial-gradient( 50% 50%, 200% 50%, hsla(0,0%,90%,1) 5%, hsla(0,0%,85%,1) 30%, hsla(0,0%,60%,1) 100%);

        }
        .outer::before, .outer::after {
          content: "";
          top: 0;
          left: 0;
          position: absolute;
          width: inherit;
          height: inherit;
          border-radius: inherit;
          
          /* fake conical gradients */
          background-image: -webkit-radial-gradient(  50%   0%, 10% 50%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%),
            -webkit-radial-gradient(  50% 100%, 10% 50%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%),
            -webkit-radial-gradient(   0%  50%, 50% 10%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%),
            -webkit-radial-gradient( 100%  50%, 50% 06%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%);
        }
        .outer:before { transform: rotate( 65deg); }
        .outer:after { transform: rotate(-65deg); }

        .outer.enabled {
          border-color: #24E0FF;
        }
        .inner {
          border-radius:50%;
          width: 40px;
          height: 40px;
          margin:0;
          cursor: pointer;
        }
        .inner.stopped {
          background-color: #abff00;
        }
        .inner.stopped.enabled {
          box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #304701 0 -1px 16px, #89FF00 0 2px 20px;
        }

        .label {
          color: white;
          font-size: 14pt;
          margin:5px;
          padding:0;
          font-variant: small-caps;
          bottom: 10px;
          position: absolute;
        }
        .inner.running {

          background-color: #F00;
          border-radius: 50%;
          box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #441313 0 -1px 16px, rgba(255, 0, 0, 0.5) 0 2px 20px;
          -webkit-animation: blinkRed 2s infinite;
          -moz-animation: blinkRed 2s infinite;
          -ms-animation: blinkRed 2s infinite;
          -o-animation: blinkRed 2s infinite;
          animation: blinkRed 2s infinite;
        }

        @-webkit-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #441313 0 -1px 16px, rgba(255, 0, 0, 0.5) 0 2px 20px;}
            to { background-color: #F00; }
        }
        @-moz-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #441313 0 -1px 16px, rgba(255, 0, 0, 0.5) 0 2px 20px;}
            to { background-color: #F00; }
        }
        @-ms-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #441313 0 -1px 16px, rgba(255, 0, 0, 0.5) 0 2px 20px;}
            to { background-color: #F00; }
        }
        @-o-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #441313 0 -1px 16px, rgba(255, 0, 0, 0.5) 0 2px 20px;}
            to { background-color: #F00; }
        }
        @keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 13px 1px, inset #441313 0 -1px 16px, rgba(255, 0, 0, 0.5) 0 2px 20px;}
            to { background-color: #F00; }
        }
      </style>
      <div class="outer ${classMap({enabled: this.enabled})}" @click=${this._toggle}>
        ${cache(this.pushed? html`
          <div class="inner running"><material-icon style="--icon-size:40px">pause_circle_outline</material-icon></div>
        `: html`
          <div class="inner stopped ${classMap({enabled: this.enabled})}"><material-icon style="--icon-size:40px">play_circle_outline</material-icon></div>
        `)}
      </div>
      ${this.enabled? cache(this.pushed? html`<div class="label">Recording</div>`: html`<div class="label">Click to Record</div>`): ''}
    `;
  }
  _toggle() {
    this.pushed = !this.pushed;
  }
}
customElements.define('rec-record-button', RecRecordButton);