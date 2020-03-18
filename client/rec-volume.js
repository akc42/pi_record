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
  }

  updated(changed) {
    if (changed.has('channel') && this.ctx !== undefined && changed.get('channel') !== undefined) {
      //we are not in the start up phase
      if (this.channel.length > 0 && !this.running) this._startChannel(); 
      else if (this.channel.length === 0 && this.running) this._stopChannel();     
    }
    super.updated(changed);
  }
  firstUpdated() {
    this.canvas = this.shadowRoot.querySelector('canvas');    
    this.ctx = this.canvas.getContext('2d');
    this.grad = this.ctx.createLinearGradient(0,0,0,448);
    this.grad.addColorStop(0,'red');
    this.grad.addColorStop(0.03125, 'red');
    this.grad.addColorStop(0.125,'yellow');
    this.grad.addColorStop(0.21875, 'limegreen');
    this.grad.addColorStop(1, 'green');
    //fill canvas with grey background
    this.ctx.fillStyle = '#a0a0a0';
    this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
    //now make a scale each side of the canvas
    this.ctx.textAlign = 'right';
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
    this_reset();//rest the peak
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
          flex-direction: column;
        }

        canvas {
          -webkit-box-shadow: 0px 0px 5px 5px #000000; 
          box-shadow: 0px 0px 5px 5px #000000;
          background-color: #777;
        }
        #container {
          position:relative;
        }
        #reset {
          position:absolute;
          border-radius:50%;
          height:20px;
          width: 20px;
          background-image: -webkit-radial-gradient(  50%   0%,  8% 50%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
            -webkit-radial-gradient(  50% 100%, 12% 50%, hsla(0,0%,100%,.6) 0%, hsla(0,0%,100%,0) 100%),
            -webkit-radial-gradient(   0%  50%, 50%  7%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
            -webkit-radial-gradient( 100%  50%, 50%  5%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
            
            -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,  0%,0) 0%, hsla(0,0%,  0%,0)   3%, hsla(0,0%,  0%,.1) 3.5%),
            -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0)   6%, hsla(0,0%,100%,.1) 7.5%),
            -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0) 1.2%, hsla(0,0%,100%,.2) 2.2%),
            
            -webkit-radial-gradient( 50% 50%, 200% 50%, hsla(0,0%,90%,1) 5%, hsla(0,0%,85%,1) 30%, hsla(0,0%,60%,1) 100%);

        }
        #reset::before, #reset::after {
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
        #reset:before { transform: rotate( 65deg); }
        #reset:after { transform: rotate(-65deg); }

      </style>
      <canvas width="120" height="480"></canvas>
      <div id="container" @click=${this._reset}>
        <div id="reset">R</div>
      </div>
      <div class="label">Reset Peak</div>
    `;
  } 
  _receiveVolumeData(e) {

    const [left, right] = e.data.replace(/^\s*(\S+)\s+(\S+)\s*$/,'$1 $2').split(' ');
    const leftVol = Math.min(2.0,parseFloat(left)); //limit to negative numbers
    const rightVol = Math.min(2.0,parseFloat(right)); 
    const leftOffset = Math.max(0,Math.min(14 -  Math.round(7*leftVol),448)); //limit range of scal
    const rightOffset = Math.max(0,Math.min(14 -  Math.round(7*rightVol), 448));
    this.leftPeak = Math.min(this.leftPeak, leftOffset); //record the peak
    this.rightPeak = Math.min(this.rightPeak, rightOffset);
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
    this.ctx.fillStyle = 'lightgrey'; //then paint in the decaying average
    this.ctx.fillRect(25,leftAvgOffset,20,2);
    this.ctx.fillRect(85,rightAvgOffset,20,2);
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = 'white';
    this.ctx.beginPath();
    this.ctx.moveTo(25,this.leftPeak + 21);
    this.ctx.lineTo(45,this.leftPeak + 21);
    this.ctx.moveTo(85,this.rightPeak + 21);
    this.ctx.lineTo(105, this.rightPeak + 21);
    this.ctx.stroke();

    //draw the peakes box at the top

    this.ctx.fillstyle = 'darkgray';
    this.ctx.fillRect(20,2,30,18);
    this.ctx.fillRect(80,2,30,18);
    this.ctx.textAlign = 'center';
    this.ctx.font = '14px san-serif';
    this.ctx.fillText((-(this.leftPeak-36)/7).toString() + ' db', 35, 11);
    this.ctx.fillText((-(this.rightPeak-36)/7).toString() + ' db', 95, 11);
  }
  _reset() {
    this.rightPeak = this.leftPeak = 448;
    this.rightAvg = this.leftAvg = 62;
  }

  _startChannel() {
    this.running = true;
    this.eventSrc = new EventSource(`/api/${this.channel}/volume`);
    this.eventSrc.addEventListener('message', this._receiveVolumeData);  
    this.rightPeak = this.leftPeak = this.canvas.height - 10;
    this.rightAvg = this.leftAvg = Math.log(65); 
  }
  _stopChannel() {
    this.running = false;
    this.eventSrc.close();
    this.eventSrc.removeEventListener('message', this._receiveVolumeData);
  }
}

customElements.define('rec-volume', RecVolume);