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

class RecLed extends LitElement {
  static get properties() {
    return {
      blink: {type: Boolean},
      colour: {type: String}
    };
  }
  constructor() {
    super();
    this.blink = false;
    this.colour = 'led-red'
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
        .led {
          margin: 0 auto;
          width: var(--led-size,24px);
          height: var(--led-size,24px);
        }
        .led-red {

          background-color: #F00;
          border-radius: 50%;
          box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #441313 0 -1px calc(var(--led-size,24px) * .4), rgba(255, 0, 0, 0.5) 0 2px calc(var(--led-size,24px) * .5);
          -webkit-animation: blinkRed 0.5s infinite;
          -moz-animation: blinkRed 0.5s infinite;
          -ms-animation: blinkRed 0.5s infinite;
          -o-animation: blinkRed 0.5s infinite;
          animation: blinkRed 0.5s infinite;
        }

        @-webkit-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #441313 0 -1px calc(var(--led-size,24px) * .4), rgba(255, 0, 0, 0.5) 0 2px 0;}
            to { background-color: #F00; }
        }
        @-moz-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #441313 0 -1px calc(var(--led-size,24px) * .4), rgba(255, 0, 0, 0.5) 0 2px 0;}
            to { background-color: #F00; }
        }
        @-ms-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #441313 0 -1px calc(var(--led-size,24px) * .4), rgba(255, 0, 0, 0.5) 0 2px 0;}
            to { background-color: #F00; }
        }
        @-o-keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #441313 0 -1px calc(var(--led-size,24px) * .4), rgba(255, 0, 0, 0.5) 0 2px 0;}
            to { background-color: #F00; }
        }
        @keyframes blinkRed {
            from { background-color: #F00; }
            50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #441313 0 -1px calc(var(--led-size,24px) * .4), rgba(255, 0, 0, 0.5) 0 2px 0;}
            to { background-color: #F00; }
        }

        .led-yellow {
          background-color: #FF0;
          border-radius: 50%;
          box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3) 1px, inset #808002 0 -1px calc(var(--led-size,24px) * .4), #FF0 0 2px calc(var(--led-size,24px) * .5) ;

        }


        .led-blue {
          background-color: #24E0FF;
          border-radius: 50%;
          box-shadow: rgba(0, 0, 0, 0.2) 0 -1px calc(var(--led-size,24px) * .3)  1px, inset #006 0 -1px calc(var(--led-size,24px) * .4), #3F8CFF 0 2px calc(var(--led-size,24px) * .5) ;

        }

      </style>
      <div class="led ${this.colour}"></div>
    `;
  }
}
customElements.define('rec-led', RecLed);

