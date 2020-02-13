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
  const debug = require('debug')('recorder');
  const http2 = require('http2');
  const Router = require('router');
  const enableDestroy = require('server-destroy');
  const usbDetect = require('usb-detection');
  const { spawn } = require('child_process');

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
    '.m3u8': 'application/x-mpegURL',
    '.ts': 'video/mp2t'
  };
  const url = require('url');
  const etag = require('etag');
  const logger = require('./logger');

  let server;
  let recorder;
  async function startUp (http2, Router,enableDestroy, logger, Recorder, usbDetect) {
    const router = Router();  //create a router
    router.

    const options = {
      key: await fs.readFile(path.resolve(__dirname,  '../assets/key.pem')),
      cert: await fs.readFile(path.resolve(__dirname,  '../assets/certificate.pem')),
      allowHttp1: true
    };

    server = http2.createSecureServer(options, (req,res) => {
      const reqURL = url.parse(req.url).pathname;
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
        } else if (/^([^\/]|\/(api|\/|.*(\.|\/\/)))/.test(reqURL)) {
            /*
              If we get here it means that it is not a route created by the client, and so we should
              respond with a 404.
            */
            debug('reqURL is one which should normally have been handled already, so now its a 404');
            final();
        } else {
          /*
            This is a url that should not have been handled by known server routes.  This means that
            it is likely that its a client generated url and so we should respond with index.html
          */
          debug('app route of %s called sending index.html',reqURL);
          serveFile('/index.html', req, res, final);
        }
      });
    });
    server.listen(parseInt(process.env.RECORDER_PORT,10),'0.0.0.0');
    enableDestroy(server);
    // Start a recorder instance
    recorder = new Recorder();
    


    //start looking for udev events
    usbDetect.startMonitoring();
    //lets see if anthing plugged in
    const devices = await Promise.all([
      usbDetect.find(parseInt(process.env.RECORDER_SCARLETT_VID,10),parseInt(process.env.RECORDER_SCARLETT_PID,10)),
      usbDetect.find(parseInt(process.env.RECORDER_YETI_VID,10),parseInt(process.env.RECORDER_YETI_PID,10))
    ])
    





    logger('app', 'Recorder Web Server Operational Running on Port:' +
        process.env.RECORDER_PORT + ' with Node Version: ' + process.version);
  }
  
  serveFile(url, req, res, next) {
    //helper for static files
    let forwardError = false;
    let match = '';
    //if we have an if-modified-since header we can maybe not send the file so create timestamp from it
    if (req.headers['if-none-match']) {
      debug('we had a if-none-match header for url ', url);
      match = req.headers['if-none-match'];
    }

    function statCheck(stat, headers) {
      debug('in stat check for file ', url);
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
      forwardError = true;
      return true; //tell it to continue
    }

    //find out where file is
    const filename = path.resolve(
      __dirname,
      '../',
      url.charAt(0) === '/' ? url.substring(1) : url;
    );
    const ext = path.extname(filename);

    debug(`send static file ${filename}`);
    function onError(err) {
      debug('Respond with file error ', err);
      if (forwardError || !(err.code === 'ENOENT')) {
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
  serveStatic() {
    const self = this;
    return (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      let reqURL = url.parse(req.url).pathname;
      if (reqURL === '/') reqURL = '/index.html';
      serveFile(reqURL,req, res, next);
    };

  }





  async function close() {
  // My process has received a SIGINT signal
    if (server) {

      let tmp = server;
      server = null;
      debug('about to stop monitoring udev events')
      await usbDetect.stopMonitoring();
      if (recorder) {
        //need to shut off the recording smoothly
        await recorder.close()
      }

      debug('About to close Web Server');
      server.destroy();
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
