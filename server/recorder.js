/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    This file is part of Program.

    Program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    2020 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Program.  If not, see <http://www.gnu.org/licenses/>.
*/
const path = require('path');
const debug = require('debug')('recorder:record');
const debugdata = require('debug')('recorder:data');
const debugctl = require('debug')('recorder:control');
const devnull = require('dev-null');
//eslint-disable-next-line   max-len
const mainargs = '-hide_banner -f alsa -acodec pcm_s32le -ac:0 2 -ar 192000 -i hw:dddd -filter_complex asplit=2[main][vol],[vol]showvolume=rate=25:f=0.95:o=v:m=p:dm=3:h=80:w=480:ds=log:s=2[vid] -map [main] -f s32le -acodec flac pipe:1 -map [vid] -preset ultrafast -g 25 -an -sc_threshold 0 -c:v:1 libx264 -b:v:1 1000k -maxrate:v:1 1100k -bufsize:v:1 2000k -f hls -hls_time 4 -hls_flags delete_segments+temp_file -strftime 1 -hls_segment_filename vvvv/volume-%Y%m%d-%s.ts vvvv/volume.m3u8';
const recargs = '-hide_banner -f s32le -i pipe:0';
const { spawn } = require('child_process');
const fs = require('fs').promises;
const jwt = require('jwt-simple');
  
  class Recorder {
    constructor(device, name, dir) {
      debug('recorder ', name, ' started');
      this._name = name;
      this._controlled = '';
      const args = mainargs.replace('hw:dddd', 'hw:' + device).replace(/vvvv/g, dir).split(' ');
      debug('starting ffmeg command is ffmpeg ', args.join(' '));
      this._volume = spawn('ffmpeg', args, {
        cwd: path.resolve(__dirname, '../'),
        stdio: ['inherit', 'pipe', 'pipe']
      });
      this._volume.stdout.pipe(devnull());  //throw the output away
      this._volume.stderr.on('data', chunk => {
        debugdata('received ffmpeg chunk', chunk.toString());
      });
      this.__recordingPromise = Promise.resolve();
      this._volumePromise = new Promise(resolve => this._volume.once('exit', async () => {
        //delete all the ts files in the directory - leave the .m3u8 file
        const directory = path.resolve(__dirname,'../', dir)
        const files = await fs.readdir(directory);
        for (let 
          file of files) {
          if (path.extname(file) === '.ts') await fs.unlink(path.resolve(directory,file));
        } 
        resolve();
      }));
      this._name = name;
    }
    get name() {
      return this._name;
    }
    get controlled() {
      if (this._controlled.length === 0) return false;
      try {
        const payload = jwt.decode(this._controlled,process.env.RECORDER_TOKEN);
        debugctl('jwt payload ', payload);
        if (payload.hw !== this._name) return false;
        return true;
      } catch(e) {
        debugctl('jwt decode threw for channel', this.channel);
        debug('jwt decode threw error ', e);
        return false;
      }
    }
    get channel() {
      return this._channel
    }
    get recording() {
      return this._recording !== undefined;
    }
    _checkToken(token) {
      if (token !== this._controlled) return false;
      return this.controlled;
    }
    _makeToken(channel) {
      const payload = {
        exp: Math.round(Date.now()/1000) + 300,   //5 minutes time
        hw: this._name,
        channel: channel
      };
      this._controlled = jwt.encode(payload,process.env.RECORDER_TOKEN);
      this._channel = channel;
      debug('new token made');
      return this._controlled;
    }
    take(channel) {
      debug('take control request received for ', this.name, ' with channel ', channel);
      if (this.controlled) return false;
      return this._makeToken(channel);
    }
    renew(token) {
      debug('request to renew token for ', this.name);
      if (this._checkToken(token)) {
        return this._makeToken(this.channel);
      }
      debug('request to renew failed');
      return false;
    }
    release(token) {
      debug('request to release token made');
      if (this._checkToken(token)) {
        debug('valid request to release token');
        this._controlled = '';
        this._channel = '';
        return true;
      }
      return false;

    }
    record(token) {
      debug('request to start recording')
      if(this._checkToken(token)) { //only a valid token will allow us to start
        if (!this.recording ) {
          const args = recargs.split(' ');
          const rightnow = new Date();
          args.push('recordings/' + this.name.replace(/\s/g,'_') + rightnow.toISOString().replace(/\.|:/g,'-') + '.flac');
          debug('starting recording command is ffmpeg ', args.join(' '));
          this._recording = spawn('ffmpeg', args, {
            cwd: path.resolve(__dirname, '../'),
            stdio: ['pipe', 'ignore', 'pipe']
          });
          this._recording.stderr.on('data', chunk => {
            debugdata('received recording chunk ', chunk.toString());
          });
          this._volume.stdout.unpipe();
          this._volume.stdout.pipe(this._recording.stdin);
          this.__recordingPromise = new Promise(resolve => this._recording.once('exit', () => {
            debug('running exited');
            delete this._recording;
            resolve();
            this._recordingPromise = Promise.resolve(); //we need to succeed immediately if we are no longer running
          }));
          return true; 
        }
      }
      debug('request to start recording failed');
      return false;
    }
    stop(token) {
      debug('stop request received when recording is ', this._recording !== undefined)
      if (this._checkToken(token)) {
        if (this.recording) {
          this._volume.stdout.unpipe(); //disconnect the recording part
          this._volume.stdout.pipe(devnull()); //now throw ffmpeg output away
          this._recording.stdin.end(); //write a null to end the recording
          this._recording.kill(); //and then tell it to close
          return true;
        }
      }
      return false;
    }
    close() {
      debug('close request received when ffmpeg (volune) is ', this._volume !== undefined, ' and ffmpeg(recording) is ', this._recording !== undefined);
      if (this.recording) {
        this._volume.stdout.unpipe(); //disconnect the recording part
        this._volume.stdout.pipe(devnull()); //now throw ffmpeg output away
        this._recording.stdin.end(); //wend the recording
        this._recording.kill(); //and then tell it to close
      }
      if (this._volume !== undefined) this._volume.kill();
      return Promise.all([this._volumePromise, this._recordingPromise]);
    }
  }

  module.exports = Recorder;