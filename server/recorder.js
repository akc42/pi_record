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
const debugctl = require('debug')('recorder:control');
const debugvol = require('debug')('recorder:volume');
const fs = require('fs');
const jwt = require('jwt-simple');
const {spawn} = require('child_process');
const rl = require('readline');
const logger = require('./logger');

//eslint-disable-next-line   max-len
const volargs = '-hide_banner -nostats -f alsa -acodec pcm_s32le -ac:0 2 -ar 192000 -i hw:dddd -filter_complex ebur128=peak=true -f null -';
//eslint-disable-next-line   max-len
const recargs = '-hide_banner -nostats -f alsa -acodec pcm_s32le -ac:0 2 -ar 192000 -i hw:dddd -filter_complex asplit=2[main][vols],[vols]ebur128=peak=true[vol] -map [main] -acodec flac recordings/out.flac -map [vol] -f null -';
const sedargs = ['-u', '-n','s/.*FTPK:\\([^d]*\\).*/\\1/p'];

  class Recorder {
    constructor(device, fmt, name) {
      logger('rec',`recorder ${name} created`);
      this._volumeMessageCounter = 0;
      this._device = device;
      this._name = name;
      this._controlled = '';
      this._fmt = fmt;
      this._isRecording = false;
      this._subscribers = [];
      this._sed = spawn('sed', sedargs, {
        cwd: path.resolve(__dirname, '../'),
        stdio: ['pipe', 'pipe', 'ignore']        
      });
      this._sed.stdin.setDefaultEncoding('utf8');
      this._sedreader = rl.createInterface({
        input: this._sed.stdout,
        terminal: false
      });
      this._sedreader.on('line', line => {
        if (this._volumeMessageCounter % 100 === 0) debugvol('sending subscribers 100th message ', line);
        this._volumeMessageCounter++;
        for (let response of this._subscribers) {
          response.write(`data:${line}\n\n`);
        }
      });
      this._sedPromise = new Promise(resolve => this._sedreader.on('close', resolve));
      this._startVolume();            
      this._recordingPromise = Promise.resolve();
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
        debugctl('jwt decode threw for client', this.client);
        debug('jwt decode threw error ', e);
        return false;
      }
    }
    get client () {
      return this._client
    }
    get isRecording() {
      return this._recording !== undefined;
    }
    _checkToken(token) {
      if (token !== this._controlled) return false;
      return this.controlled;
    }
    _makeToken(client) {
      const payload = {
        exp: Math.round(Date.now()/1000) + 300,   //5 minutes time
        hw: this._name,
        client: client
      };
      this._controlled = jwt.encode(payload,process.env.RECORDER_TOKEN);
      this._client = client;
      debug('new token made');
      return this._controlled;
    }
    _startVolume() {
      const args = volargs.replace('hw:dddd', 'hw:' + this._device).replace(/s32le/g,this._fmt).split(' ');
      debug('starting volume command is ffmpeg ', args.join(' '));
      this._volume = spawn('ffmpeg', args, {
        cwd: path.resolve(__dirname, '../'),
        stdio: ['pipe', 'ignore', 'pipe']
      });
      this._volume.stderr.pipe(this._sed.stdin, {end: false});  //send the output throught the sed filter and out to listener 

      this._volumePromise = new Promise(resolve => this._volume.once('exit', (code, signal) => {
        debug('volume for ', this.name, ' exited with code ', code, ' and signal ', signal);
        delete this._volume;
        if (code !== 0 && code !== 255) logger('error', `recorder ${this.name} volume stream ended prematurely with code ${code}`);
        resolve(); 
      }));      
    }
    async close() {
      debug('close request received when ffmpeg (volume) is ', this._volume !== undefined, ' and ffmpeg(recording) is ', this._recording !== undefined);
      if (this.isRecording) {
        this._recording.stderr.unpipe(); //disconnect from the volume filter
        this._recording.stdin.end('q'); //write this to end the recording
      } else if (this._volume !== undefined) { //check it hasn't finished prematurely 
        this._volume.stderr.unpipe();
        this._volume.stdin.end('q');
      }
      this._sed.kill();
      await Promise.all([this._volumePromise, this._recordingPromise, this._sedPromise]);
      logger('rec', `recorder ${this.name} closed`)
    }
    async record(token) {
      debug('request to start recording')
      if(this._checkToken(token)) { //only a valid token will allow us to start
        if (!this.isRecording ) {
          this._volume.stderr.unpipe();
          this._volume.stdin.end('q');
          await this._volumePromise;
          const rightnow = new Date();
          const filename = `${process.env.RECORDER_RECORDINGS}/` + 
            this.name.replace(/\s/g,'_') + '_' + rightnow.toISOString().replace(/\.|:/g,'-') + '.flac';
          const args = recargs.replace('hw:dddd', 'hw:' + this._device).replace(/s32le/g,this._fmt).replace('recordings/out.flac',filename).split(' ');
          debug('starting recording command is ffmpeg ', args.join(' '));
          this._recording = spawn('ffmpeg', args, {
            cwd: path.resolve(__dirname, '../'),
            stdio: ['pipe', 'ignore', 'pipe']
          });
          this._recording.stderr.pipe(this._sed.stdin, {end: false});
          this._recordingPromise = new Promise(resolve => this._recording.once('exit', (code,signal) => {
            debug('recording for ', this.name, ' exited with code ', code, ' and signal ', signal);
            if (code !== 0 && code !== 255) logger('error', `recorder ${this.name} recording ended prematurely with code ${code}`);
            delete this._recording;
            resolve();
          }));
          logger('rec', `recorder ${this.name} recording ${filename}`);
          return true; 
        }
      }
      debug('request to start recording failed');
      return false;
    }
    release(token) {
      debug('request to release token made');
      if (this._checkToken(token)) {
        debug('valid request to release token');
        if (this.isRecording) this.stop(token);
        this._controlled = '';
        this._channel = '';
        logger('rec', `recorder ${this.name} control released`);
        return true;
      }
      return false;

    }
    renew(token) {
      debug('request to renew token for ', this.name);
      if (this._checkToken(token)) return this._makeToken(this.client);
      debug('request to renew failed');
      return false;
    }
    async stop(token) {
      debug('stop request received when recording is ', this._recording !== undefined)
      if (this._checkToken(token)) {
        if (this.isRecording) {
          this._recording.stderr.unpipe(); //disconnect from the volume filter
          this._recording.stdin.end('q'); //write this to end the recording
          await this._recordingPromise;
          this._startVolume();  //go back to plain volume output
          logger('rec', `recorder ${this.name} stopped recording`);
          return true;
        }
      }
      return false;
    }
    subscribe(response) {
      debug('subscribe request received as subscriber no ', this._subscribers.length, ' after ', this._volumeMessageCounter, ' messages');
      this._subscribers.push(response);
    }
    take(client) {
      debug('take control request received for ', this.name, ' from client ', client);
      if (this.controlled) return false;
      const token = this._makeToken(client);
      logger('rec', `recorder ${this.name} control taken by ${client}`);
      return token;
    }
    unsubscribe(response) {
      const idx = this._subscribers.indexOf(response);
      debug('unsubscribe request for subscriber no ', idx, ' after ', this._volumeMessageCounter, ' messages');
      if (idx >= 0) {
        this._subscribers.splice(idx,1);  //delete the entry
      }
    }
  }

  module.exports = Recorder;