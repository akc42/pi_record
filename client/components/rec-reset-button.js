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
import {classMap} from '../lit/class-map.js';
import {styleMap} from '../lit/style-map.js'

import metal from '../styles/metal.js';
import label from '../styles/label.js';

import './material-icon.js';

class RecResetButton extends LitElement {
  static get styles() {
    return [metal, label];
  }

  static get properties() {
    return {
      enabled: {type: Boolean},
      pressed: {type: Boolean}   //internal property that can be used to rotate the icon
    };
  }
  constructor() {
    super();
    this.enabled = false;
    this.pressed = false;
  }
  connectedCallback() {
    super.connectedCallback();
    setTimeout(() => {
      const mi = this.shadowRoot.querySelector('material-icon');
      mi.classList.add('ready');

    },1000);
  }
  update(changed) {
    if (changed.has('pressed')) {
      if (this.pressed) {
        let duration;
        if (this.enabled) {
          this.dispatchEvent(new CustomEvent('loud-reset',{
            bubbles: true,
            cancel: true
          }));
          duration = 2000;
        } else {
          duration = 500;
        }
        setTimeout(() => this.pressed = false, duration);
      }
    }
    super.update(changed);
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
          height: 60px;
          width: 60px;
          margin:0;
          border-radius:50%;
          border-width: 5px;
          border-style: solid;
          border-color: transparent;
        }
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
        material-icon.ready {
          transition: 1s linear;
        }


        [label] {
          height: 50px;
        }

      </style>
      <div class="outer ${classMap({enabled: this.enabled})}" @click=${this._toggle} metal>
        <div class="inner"><material-icon style=${styleMap({transform: `rotate(${this.pressed? 0 : 90}deg)`, '--icon-size':'40px'})}>settings_backup_restore</material-icon></div>     
      </div>
      ${this.enabled? html`<div label>Click to Reset Loudness</div>`: html`<div label></div>`}
    `;
  }
  _toggle() {
    this.pressed = true;
  }
}
customElements.define('rec-reset-button', RecResetButton);