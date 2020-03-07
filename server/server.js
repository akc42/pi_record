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
  const debugfile = require('debug')('recorder:file');
  const debugmedia = require('debug')('recorder:media');
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
  const recorders = {};
  let statusid = 0;
  const subscribedChannels = {};

  async function startUp (http2, Router,enableDestroy, logger, Recorder, usbDetect) {
    const routerOpts = {mergeParams: true};
    const router = Router(routerOpts);  //create a router

    const options = {
      key: await fs.readFile(path.resolve(__dirname,  'assets/key.pem')),
      cert: await fs.readFile(path.resolve(__dirname,  'assets/certificate.pem')),
      allowHttp1: true
    };
    debug('have server ssl keys about to create the http2 server')
    server = http2.createSecureServer(options, (req,res) => {
      const reqURL = url.parse(req.url).pathname;
      if (reqURL.indexOf('volume') < 0) {
        debugfile('request for ', reqURL, ' received');
      } else {
        debugmedia('request for ', reqURL, 'received');
      } 
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
    
    router.get('/api/recording/:id/take',checkRecorder, (req,res) => {
      debug('take request received');
      const token = req.recorder.take();
      res.statusCode = 200;
      if (token) {
        res.end(JSON.stringify({state: true, token: token}));
      } else {
        res.end(JSON.stringify({state: false, token: ''}));
      }
    });
    router.get('/api/recording/:id/renew/:token', checkRecorder,(req,res) => {
      debug('take request received');
      const token = req.recorder.renew(req.params.token);
      res.statusCode = 200;
      if (token) {
        res.end(JSON.stringify({state: true, token: token}));
      } else {
        res.end(JSON.stringify({state: false, token: ''}));
      }
    });
    router.get('/api/recording/:id/release/:token', checkRecorder, (req,res) => {
      res.end(JSON.stringify({state: req.recorder.release(req.params.token)}));
    });
    router.get('/api/recording/:id/start/:token', checkRecorder, (req,res) => {
      debug('got a start request with params ', req.params);
      res.end(JSON.stringify({state: req.recorder.record(req.params.token)}));
    });
    router.get('/api/recording/:id/stop/:token', checkRecorder, (req,res) => {
      debug('got a stop request with params ', req.params);
      res.end(JSON.stringify({state: req.recorder.stop(req.params.token)}));
    });
    router.get('/api/status', (req,res) => {
      const channel = Symbol();
      debug('/api/status received creating chanel ', channel,toString());
      subscribedChannels[channel] = res;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      debug('wrote headers');
      req.once('end', () => {
        debug('client closed status channel ', channel.toString());
        delete subscribedChannels[channel];
      });
      if (recorders.scarlett !== undefined) {
        sendStatus('add', {id: 'scarlett', name: recorders.scarlett.name}, channel);
        if (recorders.scarlett.controlling) sendStatus('taken', {id: 'scarlett'}, channel);
      }
      if (recorders.yeti !== undefined) {
        sendStatus('add', {id:'yeti', name: recorders.yeti.name}, channel);
        if (recorders.yeti.controlling) sendStatus('taken', {id: 'yeti'}, channel);
      }

    });
    router.use('/', serveFile);

    usbDetect.on('add:' + process.env.RECORDER_SCARLETT_VID + ':' + process.env.RECORDER_SCARLETT_PID, device => {
      recorders.scarlett = new Recorder(process.env.RECORDER_SCARLETT_HW, device.deviceName, 'volumes');
      sendStatus('add', {id: 'scarlett', name: recorders.scarlett.name});
      debug('created scarlett recorder');    
    });
    usbDetect.on('add:' + process.env.RECORDER_YETI_VID + ':' + process.env.RECORDER_YETI_PID, device => {
      recorders.yetti = new Recorder(process.env.RECORDER_YETI_HW, device.deviceName, 'volumey');
      sendStatus('add', {id: 'yeti', name: recorders.yeti.name});
      debug('created yeti recorder');
    });
    usbDetect.on('remove:' + process.env.RECORDER_SCARLETT_VID + ':' + process.env.RECORDER_SCARLETT_VID, async device => {
      debug('about to close scarlett recorder');
      await recorders.scarlett.close() //stop the recorder
      sendStatus('remove', {id: 'scarlett'});
      delete recorders.scarlett;
      debug('closed scarlett recorder');
    });
    usbDetect.on('remove:' + process.env.RECORDER_YETI_VID + ':' + process.env.RECORDER_YETI_PID, async () => {
      debug('about to close yeti recorder');
      await recorders.yeti.close();
      sendStatus('remove', {id: 'yeti'});
      delete recorders.yeti;
      debug('closed yeti recorder');
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
      recorders.scarlett = new Recorder(process.env.RECORDER_SCARLETT_HW, devices[0][0].deviceName, 'volumes');
    }
    if (devices[1].length > 0) {
      recorders.yeti = new Recorder(process.env.RECORDER_YETI_HW, devices[1][0].deviceName, 'volumey');
    }
    logger('app', 'Recorder Web Server Operational Running on Port:' +
        process.env.RECORDER_PORT + ' with Node Version: ' + process.version);
  }
  function checkRecorder(req, res, next) {
    debug('recording router id = ', req.params.id);
    if (recorders[req.params.id] !== undefined) {
      debug('middleware found recorder ', req.params.id);
      req.recorder =  recorders[req.params.id];
      next();
    } else {
      next(new Error ('No Recorder for id ' + req.params.id))
    }

  }
  function serveFile(req, res, next) {
    //helper for static files
    let dbug = req.url.indexOf('volume') <  0 ? debugfile : debugmedia;
    const clientPath = (req.url.indexOf('volume') <  0 && req.url.indexOf('node_modules') < 0 )? '../client/' : '../';
    dbug('clientPath = ', clientPath, ' when req.url = ', req.url);
    let playlist = false;
    //find out where file is
    if (req.url.slice(-1) === '/') req.url += 'index.html';
    const filename = path.resolve(
      __dirname,
      clientPath,
      req.url.charAt(0) === '/' ? req.url.substring(1) : req.url
    );
    let match = '';
    const ext = path.extname(filename);
    if (ext === 'm3u8' && req.url.indexOf('volume') > 0) {
      playlist = true;
      dbug('request for playlist so no e-tag')
    } else {
      //if we have an if-modified-since header we can maybe not send the file so create timestamp from it
      if (req.headers['if-none-match']) {
        dbug('we had a if-none-match header for url ', req.url);
        match = req.headers['if-none-match'];
      }
    }
    function statCheck(stat, headers) {
      dbug('in stat check for file ', req.url);
      if (!playlist) { //only worry about e-tags for non playlist request
        const tag = etag(stat);
        if (match.length > 0) {
          dbug('if-none-since = \'', match, '\' etag = \'', tag, '\'');
          if (tag === match) {
            dbug('we\'ve not modified the file since last cache so sending 304');
            res.statusCode = 304;
            res.end();
            return false; //do not continue with sending the file
          }
        }
        headers['etag'] = tag;
        dbug('set etag header up ', tag);
      }
      return true; //tell it to continue
    }
    
    dbug(`send static file ${filename}`);
    function onError(err) {
      dbug('Respond with file error ', err);
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
    debug('send status of event type ', type, ' to ', channel ? 'one channel': 'all channels')
    if (channel) {
      sendMessage(subscribedChannels[channel], type, data);
    } else {
      for(let channel in subscribedChannels) {
        sendMessage(subscribedChannels[channel], type, data);
      }
    }

  }
  function sendMessage(res,type,data) {
    statusid++;
    res.write(`id: ${statusid.toString()}\n`);
    res.write(`event: ${type}\n`);
    res.write('retry: 10000\n');
    res.write("data: " + JSON.stringify(data) + '\n\n');
  }

  async function close() {
  // My process has received a SIGINT signal
    if (server) {
      sendStatus('close',{});
      let tmp = server;
      server = null;
      debug('about to stop monitoring udev events')
      await usbDetect.stopMonitoring();
      if (recorders.scarlett !== undefined) {
        //need to shut off the recording smoothly
        debug('stopping scarlett');
        await recorders.scarlett.close();
        delete recorders.scarlett;
      }
      if (recorders.yeti !== undefined) {
        debug('stopping yetti');
        await recordery.close();
        delete recorders.yeti;
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
