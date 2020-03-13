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
      availableChannels: {type: Array},  //channels currently plugged in to the recorder
      channel: {type: String},  //requested channel
      channelGood: {type: Boolean},  //requested channel is in available channels
      isSuported: {type: Boolean},  //does browser support these videos
    };
  }
  constructor() {
    super();
    this.channel = '';
    this.availableChannels = [];
    this.channelGood = false;
    this.isSupported = true;  //assume we can support video for now
    this._play = this._play.bind(this);
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.channelGood) this._startChannel(); //We have already run firstUpdated and we have a good channel
  }
  disconnecteCallback() {
    super.disconnectedCallback();
    if (this.channelGood) this._stopChannel();
    
  }
  updated(changed) {
    if (changed.has('channel') || changed.has('availableChannels')) {
      if (this.isSupported && this.video !== undefined) {
        let found = false;
        for(let channel of this.availableChannels) {
          if (channel === this.channel) {
            found = true;
            break;
          }
        }
        if (this.channelGood) {
          if(this.video !== undefined) this._stopChannel();
        }
        this.channelGood = found;
        if (this.channelGood) this._startChannel();
      }
    }
    super.updated(changed);
  }
  firstUpdated() {
    this.video = this.shadowRoot.querySelector('video');
    if (!(Hls.isSupported() || this.video.canPlayType('application/vnd.apple.mpegurl'))) {
      this.isSupported = false;
      delete this.video;
    } else if (this.channelGood) this._startChannel();
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
          justify-items: center;
        }
        video, #vidnone {
          -webkit-box-shadow: 0px 0px 5px 5px #000000; 
          box-shadow: 0px 0px 5px 5px #000000;
          background-color: black;
        }
        #vidnone {
          display: flex;
          align-items: center;
          justify-items: center;
        }
        .explain {
          font-size:24pt;
          color: white;
          font-weight: bold;
        }
      </style>
      ${this.isSupported? html`
        <video height="480" width="160" autoplay muted></video>
      `: html`
        <div id="vidnone" height="480" width="160">
          <div class="explain">Volume Display is not Supported</div>
        </div>
      `}
    `;
  } 
  _play() {
    this.video.play();
  }
  _startChannel() {
    if (this.channelGood) {
      if (Hls.isSupported()) {
        this.hls = new Hls();
        // bind them together
        this.hls.attachMedia(this.video);
        this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          this.hls.loadSource(`/${this.channel}.m3u8`);
          this.hls.on(Hls.Events.MANIFEST_PARSED, this._play);
          this.hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.warn('Fatal error on video channel ', this.channel)
              this.hls.destroy();
              this._startChannel();
            }
          });
        
        });
      } else {
        this.video.src = `/${this.channel}.m3u8`
        this.video.addEventListener('loadedmetadata', this._play);
      }
    }
  }
  _stopChannel() {
    if (Hls.isSupported()) {
      this.hls.destroy();
    } else {
      this.video.removeEventListener('loadedmetadata', this._play);
      this.video.pause();
      this.video.currentTime = 0;
      this.video.src = '';
    }
  }
}

customElements.define('rec-volume', RecVolume);