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
 
  const debugstatus = require('debug')('recorder:status');
  const http2 = require('http2');
  const Router = require('router');
  const enableDestroy = require('server-destroy');
  const usb = require('usb');
  const Recorder = require('./recorder');
  const util = require('util');
  const url = require('url');
  const etag = require('etag');
  const logger = require('./logger');
  const contentDisposition = require('content-disposition');



  const setTimeoutPromise = util.promisify(setTimeout);


  const mimes = {
    '.crt':'application/x-x509-ca-cert',
    '.css': 'text/css',
    '.doc': 'application/msword',
    '.html': 'text/html',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.mjs': 'text/javascript',
    '.mp3': 'audio/mpeg',
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.pdf': 'application/pdf',
    '.pem':'application/x-x509-ca-cert',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ts': 'video/mp2t',
    '.wav': 'audio/wav'

  };
  let server;
  const recorders = {};
  let statusid = 0;
  const subscribedChannels = new Map();
  let statusTimer = 0;

  async function startUp (http2, Router,enableDestroy, logger, Recorder, usb) {
    try {
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
        debugfile('request for ', reqURL, ' received');

        function final(err) {
          if (err) {
            logger('url','Request Error ' + (err.stack || err.toString()));
          } else {
            logger('url','Request for ' + reqURL + ' not found');
          }
          //could not find so send a 404
          res.statusCode = 404;
          res.end();
        }
        router(req, res, final);

      });
      server.listen(parseInt(process.env.RECORDER_PORT,10),'0.0.0.0');
      enableDestroy(server);
      
      router.get('/api/:channel/:client/take',checkRecorder, (req,res) => {
        debug('take request received');
        const client = req.params.client;
        const {state, token, controller } = req.recorder.take(client);
        res.statusCode = 200;
        if (state) {
          //lets see if we are a subscriber
          for (let [response, entry] of subscribedChannels.entries()) {
            if (entry.client === client) {
              entry.recorder = req.recorder;
              entry.token = token;
              subscribedChannels.set(response,entry);
              break;
            }
          }
          res.end(JSON.stringify({state: true, token: token}));
          sendStatus('take',{ client: client, channel: req.params.channel});
        } else {
          res.end(JSON.stringify({state: false, client: controller}));
        }
      });
      router.get('/api/:channel/:token/renew', checkRecorder,(req,res) => {
        debug('renew request received');
        const previousToken = req.params.token
        const result = req.recorder.renew(req.params.token);  
        res.statusCode = 200;
        res.end(JSON.stringify(result));
        //replace token in subscriber list if its there
        for (let [response, entry] of subscribedChannels.entries()) {
          if (entry.token === previousToken) {
            entry.token = result.state? result.token : '';
            if (!result.state) {
              entry.recorder = null;
              sendStatus('release', {channel:req.params.channel});
            }
            subscribedChannels.set(response,entry);
            break;
          }
        }          
        
      });
      router.get('/api/:channel/:token/release', checkRecorder, async (req,res) => {
        debug('release request received')
        const token = req.params.token
        const state = await req.recorder.release(req.params.token);
        res.statusCode = 200;
        res.end(JSON.stringify({state: state}));
        if (state) {
          //reset or state
          for (let [response, entry] of subscribedChannels.entries()) {
            if (entry.token === token) {
              entry.token = '';
              entry.recorder = null
              subscribedChannels.set(response,entry);
              break;
            }
          }

          sendStatus('release', {channel:req.params.channel});
        }
      });
      router.get('/api/:channel/:token/start', checkRecorder, async (req,res) => {
        debug('got a start request with params ', req.params);
        res.statusCode = 200;
        res.end(JSON.stringify(await req.recorder.record(req.params.token)));
      });
      router.get('/api/:channel/:token/stop', checkRecorder, async (req,res) => {
        debug('got a stop request with params ', req.params);
        res.statusCode = 200;
        res.end(JSON.stringify(await req.recorder.stop(req.params.token)));
      });
      router.get('/api/:channel/:token/reset', checkRecorder, async (req,res) => {
        debug('got a loudness reset request with params', req.params);
        res.statusCode = 200;
        res.end(JSON.stringify(await req.recorder.reset(req.params.token)));
      }); 
      router.get('/api/:channel/timer', checkRecorder, (req,res) => {
        debug('got a timer request for channel ', req.recorder.name)
        res.statusCode = 200;
        const time = req.recorder.timer;
        debug('recorder said timer was ', time);
        res.end(JSON.stringify({time: time}));
      });
      router.get('/api/:channel/volume', checkRecorder, (req, res) => {
        if (req.headers.accept && req.headers.accept == 'text/event-stream') {
          const recorder =req.recorder;
          const response = res;
          debug ('volume subscription received for channel ', recorder.name)
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });
          recorder.subscribe(response);
          debug('wrote headers for volume subscription');
          req.once('end', () => {
            debug('client closed volume channel ', recorder.name);
            recorder.unsubscribe(response);
          });
        } else {
          res.writeHead(404);
          res.end();

        }
      });
      router.get('/api/:client/status', (req,res) => {
        if (req.headers.accept && req.headers.accept == 'text/event-stream') {
          const client = req.params.client;
          const response = res;
          debug('/api/status received creating/reusing channel ', client);
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });
          subscribedChannels.set(response, {client: client, token:'', recorder: null});
          req.once('end', () => {
            debug('client closed status channel ', client.toString());
            const entry = subscribedChannels.get(response);
            if (entry.recorder !== null) {
              entry.recorder.release(entry.token);
            }
            subscribedChannels.delete(response);

          });
          const status = {
            scarlett: {
              connected: recorders.scarlett !== undefined,
              taken: recorders.scarlett !== undefined ? recorders.scarlett.controlled : false,
              channel: recorders.scarlett !== undefined && recorders.scarlett.controlled ? recorders.scarlett.channel : '',
              name: recorders.scarlett !== undefined ? recorders.scarlett.name : ''
            },
            yeti: {
              connected: recorders.yeti !== undefined,
              taken: recorders.yeti !== undefined ? recorders.yeti.controlled : false,
              channel: recorders.yeti !== undefined && recorders.yeti.controlled ? recorders.yeti.channel : '',
              name: recorders.yeti !== undefined ? recorders.yeti.name : ''
            }
          };
          sendStatus('status', status, response);

        } else {
          res.writeHead(404);
          res.end();
        }
      });
      router.use('/', serveFile);
      usb.on('attach', usbAttach);
      usb.on('detach', usbDetach);
 
      if (usb.findByIds(parseInt(process.env.RECORDER_SCARLETT_VID,10), parseInt(process.env.RECORDER_SCARLETT_PID,10)) !== undefined) {
        recorders.scarlett = new Recorder(process.env.RECORDER_SCARLETT_HW, process.env.RECORDER_SCARLETT_FORMAT, process.env.RECORDER_SCARLETT_NAME);
      }
      if (usb.findByIds(parseInt(process.env.RECORDER_YETI_VID,10), parseInt(process.env.RECORDER_YETI_PID,10)) !== undefined) {
        recorders.yeti = new Recorder(process.env.RECORDER_YETI_HW, process.env.RECORDER_YETI_FORMAT, process.env.RECORDER_YETI_NAME);
      }

      const status = {
        scarlett: {
          connected: recorders.scarlett !== undefined,
          taken: recorders.scarlett !== undefined ? recorders.scarlett.controlled : false,
          client: recorders.scarlett !== undefined && recorders.scarlett.controlled ? recorders.scarlett.client : '',
          name: recorders.scarlett !== undefined ? recorders.scarlett.name : ''
        },
        yeti: {
          connected: recorders.yeti !== undefined,
          taken: recorders.yeti !== undefined ? recorders.yeti.controlled : false,
          client: recorders.yeti !== undefined && recorders.yeti.controlled ? recorders.yeti.client : '',
          name: recorders.yeti !== undefined ? recorders.yeti.name : ''
        }
      };
      sendStatus('status', status);
      statusTimer = setInterval(() => {
        const status = {
          scarlett: {
            connected: recorders.scarlett !== undefined,
            taken: recorders.scarlett !== undefined ? recorders.scarlett.controlled : false,
            client: recorders.scarlett !== undefined && recorders.scarlett.controlled ? recorders.scarlett.client : '',
            name: recorders.scarlett !== undefined ? recorders.scarlett.name : ''
          },
          yeti: {
            connected: recorders.yeti !== undefined,
            taken: recorders.yeti !== undefined ? recorders.yeti.controlled : false,
            client: recorders.yeti !== undefined && recorders.yeti.controlled ? recorders.yeti.client : '',
            name: recorders.yeti !== undefined ? recorders.yeti.name : ''
          }
        };
        sendStatus('status', status);
    
      }, 90000);

      logger('app', 'Recorder Web Server Operational Running on Port:' +
          process.env.RECORDER_PORT + ' with Node Version: ' + process.version);
    } catch(err) {
      logger('error', `Error occurred in startup; error ${err}`);
      close();
    }
  }
  function checkRecorder(req, res, next) {
    debug('recording router channel = ', req.params.channel);
    if (recorders[req.params.channel] !== undefined) {
      debug('middleware found recorder ', req.params.channel);
      req.recorder =  recorders[req.params.channel];
      next();
    } else {
      next(`Requested channel ${req.params.channel} not plugged in`);
    }

  }
  function serveFile(req, res, next) {
    //helper for static files
    const clientPath = (
      req.url.indexOf('node_modules') < 0 &&
      req.url.indexOf('lit') < 0 &&
      req.url.indexOf('assets') < 0
      )? '../client/' : (req.url.indexOf('assets') < 0? '../' : './');
     debugfile('client path is ', clientPath);
    //find out where file is
    if (req.url.slice(-1) === '/') req.url += 'index.html';
    let match = '';
    //if we have an if-modified-since header we can maybe not send the file so create timestamp from it
    if (req.headers['if-none-match']) {
      debugfile('we had a if-none-match header for url ', req.url);
      match = req.headers['if-none-match'];
    }
    
    function statCheck(stat, headers) {
      debugfile('in stat check for file ', req.url);
      const tag = etag(stat);
      if (match.length > 0 && tag === match) {
        debugfile('we\'ve not modified the file since last cache so sending 304');
        res.statusCode = 304;
        res.end();
        return false; //do not continue with sending the file
      }
      headers['etag'] = tag;
      return true; //tell it to continue
    }
    
    function onError(err) {
      debugfile('Respond with file error ', err);
      if (!err.code === 'ENOENT') {
        next(err);
      } else {
        //this was probably file not found, in which case we just go to next middleware function.
        next();
      }
    }
    const filename = path.resolve(
      __dirname,
      clientPath,
      req.url.charAt(0) === '/' ? req.url.substring(1) : req.url
    );
    debugfile('sending file ', filename)
    const headers =     { 
      'content-type': mimes[path.extname(filename)] || 'text/plain',
      'cache-control': 'no-cache' 
    }
    if (path.extname(filename)  === '.pem') {
      headers['Content-Disposition'] =  contentDisposition(filename)
    }
    res.stream.respondWithFile(
      filename,
      headers,
      { statCheck, onError });

  }
  function sendStatus(type, data, response) {
    debugstatus('send status of event type ', type, ' to ', response ? 'one client': 'all clients')
    if (response) {
      sendMessage(response, type, data);
    } else {
      for(let client of subscribedChannels.keys()) {
        sendMessage(client, type, data);
      }
    }

  }
  function sendMessage(res,type,data) {
    statusid++;
    res.write(`id: ${statusid.toString()}\n`);
    res.write(`event: ${type}\n`);
    res.write("data: " + JSON.stringify(data) + '\n\n');
    debugstatus('message sent with data  ', data);
  }
  async function usbAttach(device) {
    if (device.deviceDescriptor.idVendor === parseInt(process.env.RECORDER_SCARLETT_VID,10) && 
        device.deviceDescriptor.idProduct === parseInt(process.env.RECORDER_SCARLETT_PID,10)) {
      debug('detected scarlett added');
      await setTimeoutPromise(parseInt(process.env.RECORDER_USB_SETTLE,10));  //allow interface to settle   
      recorders.scarlett = new Recorder(process.env.RECORDER_SCARLETT_HW, process.env.RECORDER_SCARLETT_FORMAT, process.env.RECORDER_SCARLETT_NAME);
      sendStatus('add', {channel: 'scarlett', name: recorders.scarlett.name});
      debug('created scarlett recorder');    
    } else if (device.deviceDescriptor.idVendor === parseInt(process.env.RECORDER_YETI_VID,10) && 
        device.deviceDescriptor.idProduct === parseInt(process.env.RECORDER_YETI_PID,10)) {
      debug('detected yeti added');
      await setTimeoutPromise(parseInt(process.env.RECORDER_USB_SETTLE,10));  //allow interface to settle   
      recorders.yeti = new Recorder(process.env.RECORDER_YETI_HW, process.env.RECORDER_YETI_FORMAT, process.env.RECORDER_YETI_NAME);
      sendStatus('add', {channel: 'yeti', name: recorders.yeti.name});
      debug('created yeti recorder');    
    
    }
  }
  async function usbDetach(device) {
    if (device.deviceDescriptor.idVendor === parseInt(process.env.RECORDER_SCARLETT_VID,10) && 
        device.deviceDescriptor.idProduct === parseInt(process.env.RECORDER_SCARLETT_PID,10)) {
      debug('about to close scarlett recorder');
      await recorders.scarlett.close() //stop the recorder
      sendStatus('remove', {channel: 'scarlett'});
      delete recorders.scarlett;
      debug('closed scarlett recorder');
    } else if (device.deviceDescriptor.idVendor === parseInt(process.env.RECORDER_YETI_VID,10) && 
        device.deviceDescriptor.idProduct === parseInt(process.env.RECORDER_YETI_PID,10)) {
      debug('about to close yeti recorder');
      await recorders.yeti.close();
      sendStatus('remove', {channel: 'yeti'});
      delete recorders.yeti;
      debug('closed yeti recorder');
    }
  }
  async function close(usb) {
  // My process has received a SIGINT signal

    if (server) {
      logger('app', 'Starting Server ShutDown Sequence');
      try {
        const tmp = server;
        server = null;
        if (statusTimer !== 0) clearInterval(statusTimer);
        debug('Tell our subscribers we are shutting down');
        sendStatus('close',{});
        debug('Lets just stop for 1/2 second to allow our close events to be send out')
        await new Promise(resolve => setTimeout(() => resolve(),500));
        debug('about to stop monitoring udev events')
        usb.off('attach', usbAttach);
        usb.off('detach', usbDetach);
        if (recorders.scarlett !== undefined) {
          //need to shut off the recording smoothly
          debug('stopping scarlett');
          await recorders.scarlett.close();
          debug('scarlett stopped');
          delete recorders.scarlett;
        }
        if (recorders.yeti !== undefined) {
          debug('stopping yeti');
          await recorders.yeti.close();
          debug('yeti stopped');
          delete recorders.yeti;
        }
        debug('Lets just stop for 1/2 second to allow our volume subscriber shutdown messages to go out')
        await new Promise(resolve => setTimeout(() => resolve(),500));
        debug('About to close Web Server');
        tmp.destroy();
        logger('app', 'Recorder Server ShutDown');
      } catch (err) {
        logger('error', `Trying to close caused error:${err}`);
      }
    }
    process.exit(0);
  }
  if (!module.parent) {
    //running as a script, so call startUp
    debug('Startup as main script');
    startUp(http2, Router, enableDestroy, logger, Recorder, usb);
    process.on('SIGINT', () => close(usb));
  }
  module.exports = {
    startUp: startUp,
    close: close
  };
})();
