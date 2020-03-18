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
const MINVOL = Math.log(60);  //db we consider as min converted to linear

class RecVolume extends LitElement {

  static get properties() {
    return {
      availableChannels: {type: Array},  //channels currently plugged in to the recorder
      channel: {type: String},  //requested channel
      running: {type: Boolean}
    };
  }
  constructor() {
    super();
    this.channel = '';
    this.availableChannels = [];
    this.running = false;
    this._receiveVolumeData = this._receiveVolumeData.bind(this);
    this.resizeInProgress;
    this._resize = this._resize.bind(this);
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this._resize);
  }
  disconnecteCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._resize);
    
  }
  updated(changed) {
    if ((changed.has('channel') || changed.has('availableChannels')) && 
      (this.ctx !== undefined && changed.get('channel') !== undefined && changed.has('availableChannels') !== undefined)) {
        //we are not in the start up phase
        if (changed.has('availableChannels')) {
          if (this.availableChannels.length > 0) {
            let found = false;
            for(let channel of this.availableChannels) {
              if (channel === this.channel) {
                found = true;
                break;
              }
            }
            if (found && !this.running) this._startChannel();
          
          } else {
            if (this.running) this._stopChannel();
          }
        } else if (this.availableChannels.length > 0) {
          let found = false;
          for(let channel of this.availableChannels) {
            if (channel === this.channel) {
              found = true;
              break;
            }
          }
          if (found && !this.running) this._startChannel(); 
          else if (!found && this.running) this._stopChannel();
       
        }
      
    }
    super.updated(changed);
  }
  firstUpdated() {
    this.canvas = this.shadowRoot.querySelector('canvas');    
    this.ctx = this.canvas.getContext('2d');
    this.resizeInProgress = false;
    this._resize();
  }
  render() {
    return html`
      <style>
        :host {
          margin: 0;
          padding: 0;
          background-color: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        canvas {
          -webkit-box-shadow: 0px 0px 5px 5px #000000; 
          box-shadow: 0px 0px 5px 5px #000000;
          background-color: #777;
        }

      </style>
      <canvas width="120" height="480"></canvas>
    `;
  } 
  _receiveVolumeData(e) {
    const bottom = Math.round(this.scale * MINVOL);
    const [left, right] = e.data.split(' ');
    const leftVol = parseFloat(left);
    if (leftVol < this.minLeft) {
      this.minLeft = leftVol;
      console.log('minLeft:',leftVol);
    }
    if (leftVol > this.peakLeft ) {
      this.peakLeft = leftVol;
      console.log('peakLeft:',leftVol);
    }
    const rightVol = parseFloat(right);
    if (rightVol < this.minRight) {
      this.minRight = rightVol;
      console.log('minRight:',rightVol);
    }
    if (rightVol > this.peakRight ) {
      this.peakRight = rightVol;
      console.log('peakRight:',rightVol);
    }
    const leftOffset = Math.round(this.scale * Math.log(-leftVol) + 10);
    const rightOffset = Math.round(this.scale * Math.log(-rightVol) + 10);
    this.ctx.fillStyle = this.grad;
    this.ctx.fillRect(5,10,20,bottom);
    this.ctx.fillRect(35,10,20,bottom);
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(5,0,20, leftOffset);
    this.ctx.fillRect(35,0,20,rightOffset);
  }
  _resize() {
    if (this.resizeInProgress) return;
    this.resizeInProgress = true;
    requestAnimationFrame(() => {
      this.scale = Math.round((this.canvas.height-10)/MINVOL); //scale to do up to 10 below top (keep that black)
      this.grad = this.ctx.createLinearGradient(0,0,0,this.scale);
      this.grad.addColorStop(0,'red');
      this.grad.addColorStop(0.05,'red');
      this.grad.addColorStop(0.1, 'orange');
      this.grad.addColorStop(0.3,'yellow');
      this.grad.addColorStop(0.4, 'limegreen');
      this.grad.addColorStop(1, 'limegreen');
      this.resizeInProgress = false;
    });
  }
  _startChannel() {
    this.running = true;
    this.eventSrc = new EventSource(`/api/${this.channel}/volume`);
    this.eventSrc.addEventListener('message', this._receiveVolumeData);  
    this.peakRight = -100.0;
    this.peakLeft = -100.0;
    this.minRight = +20.0;
    this.minLeft = +20.0;
  }
  _stopChannel() {
    this.running = false;
    this.eventSrc.close();
    this.eventSrc.removeEventListener('message', this._receiveVolumeData);
  }
}

customElements.define('rec-volume', RecVolume);