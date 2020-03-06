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

(function() {
  'use strict';

  const path = require('path');

  require('dotenv').config({path: path.resolve(__dirname,'.env')});
  
  const fs = require('fs').promises;
  const debug = require('debug')('recorder:web');
  const http2 = require('http2');
  const Router = require('router');
  const enableDestroy = require('server-destroy');
  const usbDetect = require('usb-detection');
  const Recorder = require('./recorder');

  const mimes = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/mp2t'
  };
  const url = require('url');
  const etag = require('etag');
  const logger = require('./logger');

  let server;
  let main = null;
  let sub = null;
  let statusid = 0;


  async function startUp (http2, Router,enableDestroy, logger, Recorder, usbDetect) {
    const router = Router();  //create a router

    const options = {
      key: await fs.readFile(path.resolve(__dirname,  'assets/key.pem')),
      cert: await fs.readFile(path.resolve(__dirname,  'assets/certificate.pem')),
      allowHttp1: true
    };
    debug('have server ssl keys about to create the http2 server')
    server = http2.createSecureServer(options, (req,res) => {
      const reqURL = url.parse(req.url).pathname;
      debug('request for ', reqURL, ' received');
      function final(err) {
        if (err) {
          logger('url','Request Error ' + (err.stack || err.toString()));
        } else {
          
          const ip = req.remoteAddress;
          const hostname = req.headers.host;
          logger('url','Request for ' + reqURL + ' from ' + hostname + ' not found',ip);
        }
        //could not find so send a 404
        res.statusCode = 404;
        res.end();
      }
      router.use('/', serveFile);

      router.get('/api/start/:id', (req,res) => {
        debug('got a start with params ', req.params)

      });
      router.get('api/stop/:id', (req,res) => {

      });
      router.get('/api/status', (req,res) => {
        const channel = Symbol();
        subscribedChannels[channels] = res;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        req.once('end', () => {
          delete subscribedChannels[channel];
        });
        if (main !== null) {
          sendStatus('add', {type: 'main', id: main.id, name: main.name}, channel);
          if (main.controlling) sendStatus('taken', {type: 'main', id: main.id}, channel);
        }
        if (sub !== null) {
          sendStatus('add', {type: 'sub', id:sub.id, name: sub.name}, channel);
          if (sub.controlling) sendStatus('taken', {type: 'sub', id: sub.id}, channel);
        }
        
      });
      router(req, res, err => {
        if (err) {
          final(err);
        } else if (/^\/(api(\/(.*)|))$/.test(reqURL)) {
            /*
              If we get here it means that it is not a route created by the client, and so we should
              respond with a 404.
            */
            debug(reqURL,' is one which should normally have been handled already, so now its a 404');
            final();
        } else {
          /*
            This is a url that should not have been handled by known server routes.  This means that
            it is likely that its a client generated url and so we should respond with index.html
          */
          debug('app route of %s called sending index.html',reqURL);
          req.url = '/index.html';
          serveFile(req, res, final);
        }
      });
    });
    server.listen(parseInt(process.env.RECORDER_PORT,10),'0.0.0.0');
    enableDestroy(server);
    usbDetect.on('add:' + process.env.RECORDER_SCARLETT_VID + ':' + process.env.RECORDER_SCARLETT_PID, (device) => {
      recorders = new Recorder(process.env.RECORDER_SCARLETT_HW, device.deviceName, 'volumes');
      state++;
      debug('created scarlet recorder, state is now ',state);
    });
    usbDetect.on('add:' + process.env.RECORDER_YETI_VID + ':' + process.env.RECORDER_YETI_PID, (device) => {
      recordery = new Recorder(process.env.RECORDER_YETI_HW, device.deviceName, 'volumey');
      state += 2;
      debug('created yeti recorder, state is now ',state);
    });
    usbDetect.on('remove:' + process.env.RECORDER_SCARLETT_VID + ':' + process.env.RECORDER_SCARLETT_VID, async () => {
      
      await recorders.close();
      recorders = null;
      state--;
      debug('closed scarlet recorder recorder, state is now ',state);
    });
    usbDetect.on('remove:' + process.env.RECORDER_YETI_VID + ':' + process.env.RECORDER_YETI_PID, async () => {
      await recordery.close();
      recordery = null;
      state -= 2;
      debug('closed yeti recorder, state is now ',state);
    });

    //start looking for udev events
    usbDetect.startMonitoring();


    //lets see if anthing plugged in and set initial state
    const devices = await Promise.all([
      usbDetect.find(parseInt(process.env.RECORDER_SCARLETT_VID,10),parseInt(process.env.RECORDER_SCARLETT_PID,10)),
      usbDetect.find(parseInt(process.env.RECORDER_YETI_VID,10),parseInt(process.env.RECORDER_YETI_PID,10))
    ]);

    debug('currently connected devices ', devices);
    if (devices[0].length > 0) {
      main = new Recorder(process.env.RECORDER_SCARLETT_HW, devices[0].deviceName, 'volumem');
    }
    if (devices[1].length > 0) {
      if (main === null) {
        main = new Recorder(process.env.RECORDER_YETI_HW, devices[1].deviceName, 'volumem');
      } else {
        sub = new Recorder(process.env.RECORDER_YETI_HW, devices[1].deviceName, 'volumes');
      }
    }
    logger('app', 'Recorder Web Server Operational Running on Port:' +
        process.env.RECORDER_PORT + ' with Node Version: ' + process.version);
  }
  
  function serveFile(req, res, next) {
    //helper for static files
    const clientPath = req.url.indexOf('volume') >  0 ? '../' : '../client/';
    let playlist = false;
    //find out where file is
    if (req.url.slice(-1) === '/') req.url += 'index.html';
    const filename = path.resolve(
      __dirname,
      clientPath,
      req.url.charAt(0) === '/' ? req.url.substring(1) : req.url
    );
    const ext = path.extname(filename);
    if (ext === 'm3u8') playlist = true;

    let match = '';
    //if we have an if-modified-since header we can maybe not send the file so create timestamp from it
    if (req.headers['if-none-match']) {
      debug('we had a if-none-match header for url ', req.url);
      match = req.headers['if-none-match'];
    }

    function statCheck(stat, headers) {
      debug('in stat check for file ', req.url);
      if (!playlist) { //only worry about e-tags for non playlist request
        const tag = etag(stat);
        if (match.length > 0) {
          debug('if-none-since = \'', match, '\' etag = \'', tag, '\'');
          if (tag === match) {
            debug('we\'ve not modified the file since last cache so sending 304');
            res.statusCode = 304;
            res.end();
            return false; //do not continue with sending the file
          }
        }
        headers['etag'] = tag;
        debug('set etag header up ', tag);
      }
      return true; //tell it to continue
    }
    
    debug(`send static file ${filename}`);
    function onError(err) {
      debug('Respond with file error ', err);
      if (!err.code === 'ENOENT') {
        next(err);
      } else {
        //this was probably file not found, in which case we just go to next middleware function.
        next();
      }
    }

    res.stream.respondWithFile(
      filename,
      { 'content-type': mimes[ext] || 'text/plain',
        'cache-control': 'no-cache' },
      { statCheck, onError });

  }
  function sendStatus(type, data, channel) {

  }

  async function close() {
  // My process has received a SIGINT signal
    if (server) {

      let tmp = server;
      server = null;
      debug('about to stop monitoring udev events')
      await usbDetect.stopMonitoring();
      if (recorders !== null) {
        //need to shut off the recording smoothly
        debug('stopping scarlett');
        await recorders.close();
        recorders = null;
      }
      if (recordery !== null) {
        debug('stopping yetti');
        await recordery.close();
        recordery = null;
      }

      debug('About to close Web Server');
      tmp.destroy();
      logger('app', 'Recorder Server ShowDown')
    }
    process.exit(0);
  }
  if (!module.parent) {
    //running as a script, so call startUp
    debug('Startup as main script');
    startUp(http2, Router, enableDestroy, logger, Recorder, usbDetect);
    process.on('SIGINT', close);
  }
  module.exports = {
    startUp: startUp,
    close: close
  };
})();
