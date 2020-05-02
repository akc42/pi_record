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
import label from './styles/label.js';

class RecVolume extends LitElement {
  static get styles() {
    return [label];
  }
  static get properties() {
    return {
      channel: {type: String},  //requested channel
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
    this._stopChannel = this._stopChannel.bind(this);
    this.animationInProgress = true;
  }
  updated(changed) {
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
    if (changed.has('channel') && this.ctxPk !== undefined && changed.get('channel') !== undefined) {
      //we are not in the start up phase
      if (changed.get('channel').length > 0) {
        this._stopChannel(); //there was one running so stop it
      }
      if (this.channel.length > 0 ) this._startChannel(); 
    }

    super.updated(changed);
  }
  firstUpdated() {
    this.dbFS = this.shadowRoot.querySelector('#peak');
    this.luFS = this.shadowRoot.querySelector('#loud');    
    this.ctxPk = this.dbFS.getContext('2d');
    this.ctxLu = this.luFS.getContext('2d');
    this.gradPk = this.ctxPk.createLinearGradient(0,0,0,448);
    this.gradPk.addColorStop(0,'red');
    this.gradPk.addColorStop(0.03125, 'red');
    this.gradPk.addColorStop(0.125,'yellow');
    this.gradPk.addColorStop(0.21875, 'limegreen');
    this.gradPk.addColorStop(1, 'green');
    this.gradLu = this.ctxLu.createLinearGradient(0,0,0,448);
    this.gradLu.addColorStop(0,'#9c1f07');
    this.gradLu.addColorStop(0.161,'#9c1f07');
    this.gradLu.addColorStop(0.161, '#1b611b');
    this.gradLu.addColorStop(0.395, '#1b611b');
    this.gradLu.addColorStop(0.395,'#3f3399');
    this.gradLu.addColorStop(1.0, '#3f3399')

    requestAnimationFrame(() => {
      //fill canvas with grey background
      this.ctxPk.fillStyle = '#a0a0a0';
      this.ctxPk.fillRect(0,0,this.dbFS.width, this.dbFS.height);
      this.ctxLu.fillStyle = '#a0a0a0';
      this.ctxLu.fillRect(0,0,this.luFS.width, this.luFS.height);

      //now make a scale between the bars of peak and the right hand side of loud
      this.ctxPk.textAlign = 'center';
      this.ctxPk.textBaseline = 'middle'
      this.ctxPk.fillStyle = 'white';
      this.ctxPk.strokeStyle = 'white';
      this.ctxLu.textAlign = 'left';
      this.ctxLu.textBaseline = 'middle';
      this.ctxLu.fillStyle = 'white';
      this.ctxLu.strokeStyle = 'white';
      for(let i = 0; i <= 30; i++ ) {
        if ( i % 3 === 0) {
          this.ctxPk.lineWidth = 2;
          this.ctxPk.beginPath();
          this.ctxPk.moveTo(37, 30 + (i * 7));
          this.ctxPk.lineTo(42, 30 + (i * 7));
          this.ctxPk.moveTo(62, 30 + (i * 7));
          this.ctxPk.lineTo(67, 30 + (i * 7));
          this.ctxPk.stroke();
          this.ctxPk.fillText(i.toString(), 53, 30 + (i * 7));
          this.ctxLu.lineWidth = 2;
          this.ctxLu.beginPath();
          this.ctxLu.moveTo(this.luFS.width - 41, 30 + (i * 7));
          this.ctxLu.lineTo(this.luFS.width - 36, 30 + (i * 7));
          this.ctxLu.stroke();
          this.ctxLu.fillText(i.toString(), this.luFS.width - 32, 30 + (i * 7));

        } else {
          this.ctxPk.lineWidth = 1;
          this.ctxPk.beginPath();
          this.ctxPk.moveTo(37, 30 + (i * 7));
          this.ctxPk.lineTo(41, 30 + (i * 7));
          this.ctxPk.moveTo(63, 30 + (i * 7));
          this.ctxPk.lineTo(67, 30 + (i * 7));
          this.ctxPk.stroke();
          this.ctxLu.lineWidth = 1;
          this.ctxLu.beginPath();
          this.ctxLu.moveTo(this.luFS.width - 41, 30 + (i * 7));
          this.ctxLu.lineTo(this.luFS.width - 37, 30 + (i * 7));
          this.ctxLu.stroke();

        }
      }
      for(let i = 31; i <= 60; i++ ) {
        if ( i % 5 === 0) {
          this.ctxPk.lineWidth = 2;
          this.ctxPk.beginPath();
          this.ctxPk.moveTo(37, 30 + (i * 7));
          this.ctxPk.lineTo(42, 30 + (i * 7));
          this.ctxPk.moveTo(62, 30 + (i * 7));
          this.ctxPk.lineTo(67, 30 + (i * 7));
          this.ctxPk.stroke();
          this.ctxPk.fillText(i.toString(), 53, 30 + (i * 7));
          this.ctxLu.lineWidth = 2;
          this.ctxLu.beginPath();
          this.ctxLu.moveTo(this.luFS.width - 41, 30 + (i * 7));
          this.ctxLu.lineTo(this.luFS.width - 36, 30 + (i * 7));
          this.ctxLu.stroke();
          this.ctxLu.fillText(i.toString(), this.luFS.width - 32, 30 + (i * 7));

        } else {
          this.ctxPk.lineWidth = 1;
          this.ctxPk.beginPath();
          this.ctxPk.moveTo(37, 30 + (i * 7));
          this.ctxPk.lineTo(41, 30 + (i * 7));
          this.ctxPk.moveTo(63, 30 + (i * 7));
          this.ctxPk.lineTo(67, 30 + (i * 7));
          this.ctxPk.stroke();
          this.ctxLu.lineWidth = 1;
          this.ctxLu.beginPath();
          this.ctxLu.moveTo(this.luFS.width - 41, 30 + (i * 7));
          this.ctxLu.lineTo(this.luFS.width - 37, 30 + (i * 7));
          this.ctxLu.stroke();
        }
      }
      this.ctxLu.fillStyle = this.gradLu;
      this.ctxLu.fillRect(16,16,this.luFS.width - 60, this.luFS.height - 32);
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
        .container {
          display: flex;
          flex-direction: column;
          align-items:center;
        }

        canvas {
          -webkit-box-shadow: 0px 0px 5px 5px #000000; 
          box-shadow: 0px 0px 5px 5px #000000;
          background-color: #777;
        }

      </style>
      <div class="container">
        <canvas id="loud" width="150" height="480"></canvas>
        <div label>luFS</div>
      </div>
      <div class="container">
        <canvas id="peak" width="104" height="480"></canvas>
        <div label>dbFS</div>
      </div>
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
  
      this.ctxPk.fillStyle = this.gradPk; //gradient
      this.ctxPk.fillRect(16,16,18,448);
      this.ctxPk.fillRect(69,16,18,448);
      this.ctxPk.fillStyle = 'black'; //then blacken above it where no volume
      this.ctxPk.fillRect(16,16,18, leftOffset);
      this.ctxPk.fillRect(69,16,18, rightOffset);
      const img = this.ctxLu.getImageData(17,16, this.luFS.width - 60, this.luFS.height - 32);
      this.ctxLu.putImageData(img, 16,16);
      this.ctxLu.fillStyle = this.gradLu;
      this.ctxLu.fillRect(this.luFS.width - 44,16,1,448);  //add graident back to the missing pixel column

      const mValue = Math.min(2.0,parseFloat(m));
      const sValue = Math.min(2.0, parseFloat(s));
      const mOffset = Math.max(17,Math.min(464, 31 - Math.round(7*mValue)));
      const sOffset = Math.max(17,Math.min(464, 31 - Math.round(7*sValue)));
      this.ctxLu.strokeStyle = 'cyan';
      this.ctxLu.beginPath()
      this.ctxLu.moveTo(this.luFS.width - 45, this.sOffset);
      this.ctxLu.lineTo(this.luFS.width - 44, sOffset);
      this.ctxLu.stroke();
      this.sOffset = sOffset;

      this.ctxLu.strokeStyle = 'black';
      this.ctxLu.beginPath()
      this.ctxLu.moveTo(this.luFS.width - 45, this.mOffset);
      this.ctxLu.lineTo(this.luFS.width - 44, mOffset);
      this.ctxLu.stroke();
      this.mOffset = mOffset;
      this.animationInProgress = false;
    });
  }
  _startChannel() {
    this.receivedFirstDataMessage = false;
    this.eventSrc = new EventSource(`/api/${this.channel}/volume`);
    this.eventSrc.addEventListener('message', this._receiveVolumeData);  
    this.eventSrc.addEventListener('close', this._stopChannel);
    this.sOffset = this.mOffset = 464;
  }
  _stopChannel() {
    this.eventSrc.close();
    this.eventSrc.removeEventListener('close', this._stopChannel);
    this.eventSrc.removeEventListener('message', this._receiveVolumeData);
    this.animationInProgress = false;
    const resetValue = {data:' M: -70.0 S: -70.0     I: -70.0  P:  -70.0 -70.0  K:    70.0   70.0 '};
    this._receiveVolumeData(resetValue);
  }
}

customElements.define('rec-volume', RecVolume);