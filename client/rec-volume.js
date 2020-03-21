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

class RecVolume extends LitElement {

  static get properties() {
    return {
      channel: {type: String},  //requested channel
      running: {type: Boolean},
      overallLoudness: {type:String},
      leftPeak: {type: String},
      rightPeak: {type: String}
    };
  }
  constructor() {
    super();
    this.channel = '';
    this.running = false;
    this._receiveVolumeData = this._receiveVolumeData.bind(this);
    this.animationInProgress = true;
  }
  updated(changed) {
    if (changed.has('channel') && this.ctx !== undefined && changed.get('channel') !== undefined) {
      //we are not in the start up phase
      if (this.channel.length > 0 && !this.running) this._startChannel(); 
      else if (this.channel.length === 0 && this.running) this._stopChannel();     
    }
    if (this.receivedFirstDataMessage) {
      if (changed.has('overallLoudness') || changed.has('leftPeak') || changed.has('rightPeak')) {
        this.dispatchEvent(new CustomEvent('loudness-change',{
          bubbles: true,
          cancel: true,
          detail: {
            integrated: this.overallLoudness,
            leftPeak: this.leftPeak,
            rightPeak: this.rightPeak
          }
        }));
      }
    }
    super.updated(changed);
  }
  firstUpdated() {
    this.canvas = this.shadowRoot.querySelector('#peak');    
    this.ctx = this.canvas.getContext('2d');
    this.grad = this.ctx.createLinearGradient(0,0,0,448);
    this.grad.addColorStop(0,'red');
    this.grad.addColorStop(0.03125, 'red');
    this.grad.addColorStop(0.125,'yellow');
    this.grad.addColorStop(0.21875, 'limegreen');
    this.grad.addColorStop(1, 'green');
    requestAnimationFrame(() => {
      //fill canvas with grey background
      this.ctx.fillStyle = '#a0a0a0';
      this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
      //now make a scale each side of the canvas
      this.ctx.textAlign = 'centre';
      this.ctx.textBaseline = 'middle'
      this.ctx.fillStyle = 'white';
      this.ctx.strokeStyle = 'white';
      for(let i = 0; i <= 30; i++ ) {
        if ( i % 3 === 0) {
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(19, 36 + (i * 7));
          this.ctx.lineTo(24, 36 + (i * 7));
          this.ctx.moveTo(79, 36 + (i * 7));
          this.ctx.lineTo(84, 36 + (i * 7));
          this.ctx.stroke();
          this.ctx.fillText(i.toString(), 18, 36 + (i * 7));
          this.ctx.fillText(i.toString(), 78, 36 + (i * 7));
        } else {
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(20, 36 + (i * 7));
          this.ctx.lineTo(24, 36 + (i * 7));
          this.ctx.moveTo(80, 36 + (i * 7));
          this.ctx.lineTo(84, 36 + (i * 7));
          this.ctx.stroke();

        }
      }
      for(let i = 31; i <= 60; i++ ) {
        if ( i % 5 === 0) {
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(19, 36 + (i * 7));
          this.ctx.lineTo(24, 36 + (i * 7));
          this.ctx.moveTo(79, 36 + (i * 7));
          this.ctx.lineTo(84, 36 + (i * 7));
          this.ctx.stroke();
          this.ctx.fillText(i.toString(), 18, 36 + (i * 7));
          this.ctx.fillText(i.toString(), 78, 36 + (i * 7));
        } else {
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(20, 36 + (i * 7));
          this.ctx.lineTo(24, 36 + (i * 7));
          this.ctx.moveTo(80, 36 + (i * 7));
          this.ctx.lineTo(84, 36 + (i * 7));
          this.ctx.stroke();
        }
      }
      this.animationInProgress = false;
    });
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
          justify-content: space-between;
          flex-direction: row;
        }

        canvas {
          -webkit-box-shadow: 0px 0px 5px 5px #000000; 
          box-shadow: 0px 0px 5px 5px #000000;
          background-color: #777;
        }

      </style>
      <canvas id="loud" width="120" height="480"></canvas>
      <canvas id="peak" width="120" height="480"></canvas>
    `;
  } 
  _receiveVolumeData(e) {
    if (this.animationInProgress) return;
    this.receivedFirstDataMessage = true;
    this.animationInProgress = true;
    //eslint-disable-next-line max-len
    const [m,s,i,left, right, leftPeak, rightPeak] = e.data.replace(/^\s*M:\s*(\S+)\s*S:\s*(\S+)\s*I:\s*(\S+)\s*P:\s*(\S+)\s+(\S+)\s*K:\s*(\S+)\s+(\S+)\s*$/,'$1 $2 $3 $4 $5 $6 $7').split(' ');
    this.overallLoudness = parseFloat(i).toFixed(1);
    this.leftPeak = parseFloat(leftPeak).toFixed(1);
    this.rightPeak = parseFloat(rightPeak).toFixed(1);
    requestAnimationFrame(() => {
      const leftVol = Math.min(2.0,parseFloat(left)); //limit to 2 dbFS max
      const rightVol = Math.min(2.0,parseFloat(right));
      
      const leftOffset = Math.max(0,Math.min(14 -  Math.round(7*leftVol),448)); //limit range of scal
      const rightOffset = Math.max(0,Math.min(14 -  Math.round(7*rightVol), 448));
      this.leftAvg--; //assumes we come in here about 10th sec will drop 20db in 2 secs
      this.rightAvg--;
      this.leftAvg = Math.min(Math.max(this.leftAvg, leftVol),0.0); //assumes we come in here about 10th sec will drop 20db in 2 secs
      this.rightAvg = Math.min(Math.max(this.rightAvg, rightVol),0.0);
      const leftAvgOffset = Math.max(22,Math.min(36 -  Math.round(7*this.leftAvg),468)); 
      const rightAvgOffset = Math.max(22,Math.min(36 -  Math.round(7*this.rightAvg), 468));
  
  
      this.ctx.fillStyle = this.grad; //gradient
      this.ctx.fillRect(25,22,20,448);
      this.ctx.fillRect(85,22,20,448);
      this.ctx.fillStyle = 'black'; //then blacken above it where no volume
      this.ctx.fillRect(25,22,20, leftOffset);
      this.ctx.fillRect(85,22,20, rightOffset);
      this.ctx.fillStyle = 'orange'; //then paint in the decaying average
      this.ctx.fillRect(25,leftAvgOffset,20,2);
      this.ctx.fillRect(85,rightAvgOffset,20,2);

      this.animationInProgress = false;
    });

    
  }
  _reset() {
    this.rightPeak = this.leftPeak = 448;
    this.rightAvg = this.leftAvg = -62;
  }

  _startChannel() {
    this.running = true;
    this.receivedFirstDataMessage = false;
    this.eventSrc = new EventSource(`/api/${this.channel}/volume`);
    this.eventSrc.addEventListener('message', this._receiveVolumeData);  
    this._reset();
  }
  _stopChannel() {
    this.running = false;
    this.eventSrc.close();
    this.eventSrc.removeEventListener('message', this._receiveVolumeData);
  }
}

customElements.define('rec-volume', RecVolume);