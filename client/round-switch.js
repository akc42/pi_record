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
import {styleMap} from '../lit/style-map.js'
import metal from './styles/metal.js';
import label from './styles/label.js';

class RoundSwitch extends LitElement {
  static get styles() {
    return [metal,label];
  }
  static get properties() {
    return {
      choices: {type: Array},
      selected: {type:String},
      title: {type: String}
    };
  }
  constructor() {
    super();
    this.choices = [];
    this.selected = '';
  }
  connectedCallback() {
    super.connectedCallback();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
  }
  update(changed) {
    if (changed.has('selected') && this.selected.length > 0) {
      this.dispatchEvent(new CustomEvent('selection-change', {
        bubbles: true,
        cancel: true,
        details: this.selected
      }));
    }
    super.update(changed);
  }

  render() {
    const base = this.choices.length > 1 ? -45 : 0 ;
    const stepSize = this.choices.length > 2 ? 45 : 90;
    const selectedIndex = this.choices.indexOf(this.selected);
    const rotate = selectedIndex > 0 ? base + (stepSize * selectedIndex) : base ;
    return html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }
        #container {
          position:relative;
        }
        #knob {
          height: 60px;
          width: 60px;
          border-radius:50%;
          position:relative;
          
        } 
        #spot {
          position: absolute;
          left:calc(50% - 3px);
          top: calc(50% - 3px);
          border-radius:50%;
          height: 6px;
          width:6px;
          background-color: black;
          transition: 1s ease-in-out;

        }
        .tick {
          position: absolute;
          left:calc(50% - 3px);
          top: calc(50% - 5px);
          width: 2px;
          height: 10px;
          background-color:silver;

        }

        .label {
          position: absolute;          
          left:0;
          bottom: 50%;
          width:100%;
          overflow:visible;
          color: lightgray;
          cursor:pointer;
          text-align:center;
        }
        .label:active {
          background: black;
          box-shadow: 0px 0px 4px 2px rgba(204,204,204,1);
        }
        .label:hover {
          background: black;
          
        }
      </style>


        <div id="knob" metal>
          <div id="spot" style=${styleMap({transform: `rotate(${rotate}deg) translateY(-22px)`})}></div>
          ${guard(this.choices, () => this.choices.map((choice, index) => html`
            <div class="tick" style=${styleMap({transform: `rotate(${base + stepSize * index}deg) translateY(-36px)`})}></div>
            <div 
              class="label" 
              style=${styleMap({transform: `rotate(${base + stepSize * index}deg) translateY(-50px) rotate(${-base - stepSize * index}deg)`})} 
              @click=${this._selectChoice}
              data-choice=${choice}>${choice}</div>
          `))}
        </div>
        <div label>${this.title}</div>
      
    `;
  }
  _selectChoice(e) {
    this.selected = e.currentTarget.dataset.choice;
  }
}
customElements.define('round-switch', RoundSwitch);