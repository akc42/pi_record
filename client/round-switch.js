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
import {guard} from '../lit/guard.js';
import metal from './styles/metal.js';

class RoundSwitch extends LitElement {
  static get styles() {
    return [metal];
  }
  static get properties() {
    return {
      choices: {type: Array},
      selected: {type:String}
    };
  }
  constructor() {
    super();
    this.choices = [];
    this.selected = '';
    this.labels = ['Disconnected']
  }
  connectedCallback() {
    super.connectedCallback();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
  }
  update(changed) {
    super.update(changed);
  }
  firstUpdated() {
  }
  updated(changed) {
    super.updated(changed);
  }
  render() {
    return html`
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #container {
          position:relative;
        }
        #knob {
          height: 60px;
          width: 60px;
          border-radius:50%;
          
         
        #spot {
          border-radius:50%;
          height: 5px;
          width:5px;
          background-color: black;
        }
      </style>
      <div id="container">

        <div id="knob" metal>
          <div id="spot"></div>
          ${guard(this.choices, () => this.choices.map(choice => html`
            <div class="tick"></div>
            <div class="label">${choice}</div>
          `))}
        </div>
      </div>
      
    `;
  }
}
customElements.define('round-switch', RoundSwitch);