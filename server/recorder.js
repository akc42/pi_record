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
const debugsts = require('debug')('recorder:rstatus');
const fs = require('fs').promises;
const jwt = require('jwt-simple');
const {spawn} = require('child_process');
const rl = require('readline');
const logger = require('./logger');
const Semaphore = require('./semaphore');

//eslint-disable-next-line   max-len
const volargs = '-hide_banner -nostats -f alsa -acodec pcm_s32le -ac:0 2 -ar 192000 -i hw:dddd -filter_complex ebur128=peak=true:meter=18 -f null -';
//eslint-disable-next-line   max-len
const recargs = '-hide_banner -nostats -f alsa -acodec pcm_s32le -ac:0 2 -ar 192000 -i hw:dddd -filter_complex asplit=2[main][vols],[vols]ebur128=peak=true:meter=18[vol] -map [main] -acodec flac recordings/out.flac -map [vol] -f null -';
const sedargs = ['-u', '-n','s/.*TARGET:-23 LUFS\\(.*\\)LUFS.*FTPK:\\([^d]*\\)*.*TPK:\\([^d]*\\).*$/\\1 P: \\2 K: \\3/p'];

  class Recorder {
    constructor(device, fmt, name) {
      logger('rec',`recorder ${name} created`);
      this._basename = '';
      this._device = device;
      this._name = name;
      this._controlled = '';
      this._fmt = fmt;
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
        for (let response of this._subscribers) {
          response.write(`data:${line}\n\n`);
        }
      });
      this._sedPromise = new Promise(resolve => this._sedreader.on('close', () => {
        debug('in recorder ' ,this._name, ' closing down sed, so unsubscribe volume listeners');
        for (let response of this._subscribers) {
          debug(this._name, ' sending subscriber a close event');
          response.write(`event: close\ndata: '{}'\n\n`);  //special event to tell our subscribers to go away
        }
        resolve();
      }));
      this._startVolume();            
      this._recordingPromise = Promise.resolve();
      this._name = name;
      this._recordingTimeout = 0;
      this._recordingStopPromise = Promise.resolve();
    }
    get name() {
      return this._name;
    }
    get controlled() {
      if (this._controlled.length === 0) {
        debugctl(`in recorder ${this.mame} we have a zero length controlling token, so must say not controlled`);
        return false;
      }
      let returnValue = true;
      try {
        const payload = jwt.decode(this._controlled,process.env.RECORDER_TOKEN);
        debugctl('jwt payload ', payload);
        if (payload.hw !== this._name) return false;
        return true;
      } catch(e) {
        debugctl('jwt decode threw for client', this.client);
        debug('jwt decode threw error ', e);
        //token is no longer valid so clear it
        this._controlled = '';
        /* 
          the most likly cause of this is timeout of the control because it wasn't renewed.  We should
          stop the recording if it is going 
      
        */
       
        this._stop();
        return false;
      }
    }

    get status () {
      debugsts('Status Read ', {
        connected: true,
        name: this._name,
        taken: this.controlled,
        client: this._client,
        recording : this._recording !== undefined,
        file: this._basename
       
      });
      return {
        connected: true,
        name: this._name,
        taken: this.controlled,
        client: this._client,
        recording : this._recording !== undefined,
        file: this._basename
      };
    }
    get timer() {
      return Math.floor((Date.now() - this._timerStart)/1000);
    }
    _checkToken(token) {
      if (token !== this._controlled) {
        debugctl('token mismatch token = ', token, ' expected = ', this._controlled);
        return false;
      }
      return this.controlled;
    }
    _makeToken(client) {
      //tomorrow at 4:am
      const now = new Date();
      const fouram = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        4,0,0
      );
      const payload = {
        exp: fouram,
        hw: this._name,
        client: client
      };
      this._controlled = jwt.encode(payload,process.env.RECORDER_TOKEN);
      this._client = client;
      debug(`Recorder ${this._name} made a new token`);
      return this._controlled;
    }
    async _setRecordingTimeout() {
      if (this._recodingTimeout === 0) await this._recordingStopPromise;
      this._recordingTimeout = setTimeout(() => {
        this._recordingTimeout = 0;
        this._recordingStopPromise = this._stop();
      }, parseInt(process.env.RECORDER_RECORDING_TIME) * 1000);

    }
    _startVolume() {
      const args = volargs.replace('hw:dddd', 'hw:' + this._device).replace(/s32le/g,this._fmt).split(' ');
      debug(`Recorder ${this._name} starting volume generation with args ${args.join(' ')}`);
      this._volume = spawn('ffmpeg', args, {
        cwd: path.resolve(__dirname, '../'),
        stdio: ['pipe', 'ignore', 'pipe']
      });
      this._volume.on('error', (e) => {
        console.log('volume error event',e);
      });
      this._volume.stderr.pipe(this._sed.stdin, {end: false});  //send the output throught the sed filter and out to listener 
      this._timerStart = Date.now();
      this._volumePromise = new Promise(resolve => this._volume.once('exit', (code, signal) => {
        debug('Recorder ', this._name, ' volume production ended');
        delete this._volume;
        if (code !== null && code !== 0 && code !== 255) logger('error', `recorder ${this._name} volume stream ended prematurely with code ${code}`);
        resolve(); 
      }));      
    }
    async _stop() {
      //internal function to stop recording
      if (this._recording !== undefined) {
        if (this._recordingTimeout = 0) {
          await this._recordingStopPromise;
        } else {
          clearTimeout(this._recordingTimeout);
          this._recordingTimeout = 0;
        }
        const s = new Semaphore();
        await s.start();  //make sure we are not switching over right now
        this._recording.stderr.unpipe(); //disconnect from the volume filter
        this._recording.stdin.end('q'); //write this to end the recording
        const filekept = await this._recordingPromise;
        this._startVolume();  //go back to plain volume output
        s.end();
        logger('rec', `recorder ${this._name} stopped recording`);
        return {state: true, kept: filekept};
      }
      return {state:false};
   
    }
    async close() {
      debug('Recorder ',this._name, ' received close request whilst volume production is ', this._volume !== undefined, ' and recording is ', this._recording !== undefined);
      const s = new Semaphore();
      await s.start();
      if (this._recording !== undefined) {

        this._recording.stderr.unpipe(); //disconnect from the volume filter
        this._recording.stdin.end('q'); //write this to end the recording
      } else if (this._volume !== undefined) { //check it hasn't finished prematurely 
        this._volume.stderr.unpipe();
        this._volume.stdin.end('q');
      }
      await Promise.all([this._volumePromise, this._recordingPromise]);
      this._sed.stdin.end();
      await this._sedPromise;
      s.end();
      logger('rec', `recorder ${this._name} closed`)
    }
    async record(token) {
      debug('Recorder ', this._name ,' request to start recording')
      if(this._checkToken(token)) { //only a valid token will allow us to start
        if (this._recording === undefined ) {
          const s = new Semaphore();
          await s.start();
          this._volume.stderr.unpipe();
          this._volume.stdin.end('q');
          await this._volumePromise;
          const rightnow = new Date();
          this._basename = this._name.charAt(0) + '_' + rightnow.toISOString().substring(8,18).replace(/T|:/g,'') + '.flac';
          const filename = `${process.env.RECORDER_RECORDINGS}/${this._basename}`;
          const args = recargs.replace('hw:dddd', 'hw:' + this._device).replace(/s32le/g,this._fmt).replace('recordings/out.flac',filename).split(' ');
          debug('Recorder ', this._name, ' starting recording');
          this._recording = spawn('ffmpeg', args, {
            cwd: path.resolve(__dirname, '../'),
            stdio: ['pipe', 'ignore', 'pipe']
          });
          this._timerStart = Date.now()
          this._recording.stderr.pipe(this._sed.stdin, {end: false});
          this._recordingPromise = new Promise(resolve => this._recording.once('exit', async (code,signal) => {
            debug('recording for ', this._name, ' exited');
            if (code !== 0 && code !== 255) logger('error', `recorder ${this._name} recording ended prematurely with code ${code}`);

            const timeLimit = parseInt(process.env.RECORDER_TIME_LIMIT,10);
            const kept = (this.timer > timeLimit);
            if (!kept) {
              this._basename = '';
              await fs.unlink(path.resolve(__dirname,'../', filename)); //delete the recording because it is too short
            }
            debug('Recorder', this._name, ' recording kept is ', kept);
            delete this._recording;
            resolve(kept);
          }));
          s.end();
          await this._setRecordingTimeout();
          logger('rec', `recorder ${this._name} recording ${filename}`);
          return {state: true, name: this._basename}; 
        }
      }
      debug('Recorder ', this._name, ' request to start recording failed');
      return {state: false};
    }
    async release(token) {
      debug('Recorder ', this._name, ' request to release control');
      if (this._checkToken(token)) {
        if (this._recording !== undefined) await this.stop(token);
        this._controlled = '';
        this._channel = '';
        delete this._client; //so it no longer appears in status messages
        logger('rec', `recorder ${this._name} control released`);
        return true;
      }
      return false;

    }
    renew(token) {
      debug('Recorder ', this._name, ' request to renew token');
      if (this._checkToken(token)) {
        if (this._recording !== undefined && this._recordingTimeout !== 0) {
          //normal case if we were recording and not just in the point of timeout out (no longer recording)
          clearTimeout(this.recordingTimeout);
          this._setRecordingTimeout(); 
        }
        return {state: true, token: this._makeToken(this.client)};
      }
      logger('rec', `recorder ${this._name} failed to renew, so control released`);
      return {state: false };
    }
    retrieve(client) {
      debug('request by client ', client, ' to retrieve their token')
      if (this.controlled && client === this._client) {
        return {state: true, token: this._controlled};
      }
      return {state: false}
    }
    async stop(token) {
      debug(`Recorder ${this._name} request to stop recording after ${this.timer} secs`);
      if (this._checkToken(token)) {
        return await this._stop();
      }
      return false;
    }
    async reset(token) {

      debug(`Recorder ${this._name} request to reset loudness`);
      //we do that by stopping and restarting ffmpeg - but only if it is not recording.
      if (this._checkToken(token)) {
        if (this._recording !== undefined) {
          debug(`Recorder ${this._name} failed to reset because of Currently Recording`);
          return {state: false, reason: 'Currently Recording'};
        }
        const s = new Semaphore();
        await s.start()
        this._volume.stderr.unpipe();
        this._volume.stdin.end('q');
        await this._volumePromise;
        this._startVolume();
        s.end();
        return {state: true, timer: this.timer};
      } else {
        debug(`Recorder ${this._name} failed to reset because of Invalid Token`);
        return {state:false, reason: 'Invalid Token'};
      }
    }
    subscribe(response) {
      debug(`Recorder ${this._name} request to subscribe by no ${this._subscribers.length}  after ${this.timer} seconds`);
      this._subscribers.push(response);
    }
    take(client) {
      debug(`Recorder ${this._name } request to take control request by client ${client}`);
      if (this.controlled) return {state: false,client: this._client};
      const token = this._makeToken(client);
      logger('rec', `recorder ${this._name} control taken by ${client}`);
      return {state: true, token: token};
    }
    unsubscribe(response) {
      const idx = this._subscribers.indexOf(response);
      debug(`Recorder ${this._name} request to unsubscribe by subscriber no ${idx} after ${this.timer} seconds`);
      if (idx >= 0) {
        this._subscribers.splice(idx,1);  //delete the entry
      }
    }
  }

  module.exports = Recorder;