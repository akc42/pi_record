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
const devnull = require('dev-null');
//eslint-disable-next-line   max-len
const mainargs = '-hide_banner -f alsa -acodec pcm_s32le -ac:0 2 -ar 192000 -i hw:dddd -filter_complex asplit=2[main][vol],[vol]showvolume=rate=25:f=0.95:o=v:m=p:dm=3:h=80:w=480:ds=log:s=2[vid] -map [main] -f s32le -acodec flac pipe:1 -map [vid] -preset ultrafast -g 25 -an -sc_threshold 0 -c:v:1 libx264 -b:v:1 1000k -maxrate:v:1 1100k -bufsize:v:1 2000k -f hls -hls_time 4 -hls_flags delete_segments+temp_file -strftime 1 -hls_segment_filename vvvv/volume-%Y%m%d-%s.ts vvvv/volume.m3u8';
const recargs = '-hide_banner -f s32le -i pipe:0';
const { spawn } = require('child_process');
const fs = require('fs').promises;
  
  class Recorder {
    constructor(device, name, dir) {
      debug('recorder ', name, ' started');
      this._id = dir.slice(-1);
      this._name = name;
      this._controlling = '';
      this._recording = false;
      const args = mainargs.replace('hw:dddd', 'hw:' + device).replace(/vvvv/g, dir).split(' ');
      debug('starting ffmeg command is ffmpeg ', args.join(' '));
      this.ffmpeg = spawn('ffmpeg', args, {
        cwd: path.resolve(__dirname, '../'),
        stdio: ['inherit', 'pipe', 'pipe']
      });
      this.ffmpeg.stdout.pipe(devnull());  //throw the output away
      this.ffmpeg.stderr.on('data', chunk => {
        debugdata('received ffmpeg chunk', chunk.toString());
      });
      this.running = false;
      this.runningPromise = Promise.resolve();
      this.ffmpegClose = new Promise(resolve => this.ffmpeg.once('exit', async () => {
        debug('ffmpeg exited - delete videos');
        const directory = path.resolve(__dirname,'../', dir)
        const files = await fs.readdir(directory);
        for (let file of files) {
          await fs.unlink(path.resolve(directory,file));
        } 

        delete this.ffmpeg
        resolve();
      }));
      this.name = name;
    }
    get id() {
      return this._id;
    }
    get name() {
      return this._name;
    }
    get controlled() {
      if (this._controlled.length === 0) return false;
      const payload = jwt.decode(this._controlled,process.env.RECORDER_TOKEN);
      const now = new Date().getTime();
      if (now < payload.expiry) return true; //not expired yet, so this is validly controlled.
      this._controlled = '';
      return false;
    }
    get recording() {
      return this._recording;
    }
    _checkToken(token) {

    }
    control() {
      if (this._controlled) return false;
      const payload = {
        expiry: new Date().getTime() + 300000,   //5 minutes time
        hw: this._name
      };
      this._controlled = jwt.encode(payload,process.env.RECORDER_TOKEN);
      return this._controlled;
    }
    play(token) {


      if (!this.running ) {
        const args = recargs.split(' ');
        const rightnow = new Date();
        args.push('recordings/' + this.name + rightnow.toISOString());
        debug('starting recording command is ffmpeg ', args.join(' '));
        this.recording = spawn('ffmeg', args, {
          cwd: path.resolve(__dirname, '../'),
          stdio: ['pipe', 'ignore', 'pipe']
        });
        this.recording.stderr.on('data', chunk => {
          debugdata('received recording chunk ', chunk.toString());
        });
        this.ffmpeg.stdout.unpipe();
        this.ffmpeg.stdout.pipe(this.recording.stdin);
        this.runningPromise = new Promise(resolve => this.recording.once('exit', () => {
          debug('running exited');
          this.running = false;
          delete this.recording;
          resolve();
        }));
        this.running = true;
      }
    }
    stop() {
      debug('stop request received when running is ', this.running, ' and recording is ', this.recording !== undefined)
      this.running = false;
      if (this.recording !== undefined) {
        this.ffmpeg.stdout.unpipe(); //disconnect the recording part
        this.ffmpeg.stdout.pipe(devnull()); //now throw ffmpeg output away
        this.recording.stdin.write(null); //write a null to end the recording
        this.recording.kill();
      }
    }
    close() {
      debug('close request received when ffmpeg is ', this.ffmpeg !== undefined, ' and recording is ', this.recording !== undefined);
      this.stop();
      if (this.ffmpeg !== undefined) this.ffmpeg.kill();
      return Promise.all([this.ffmpegClose, this.runningPromise]);
    }
  }

  module.exports = Recorder;