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
  const http = require('http');
  const debug = require('debug')('recorder:web');
  const debugfile = require('debug')('recorder:file');
 
  const debugstatus = require('debug')('recorder:status');
  const Router = require('router');
  const enableDestroy = require('server-destroy');
  const {usb, findByIds} = require('usb');
  const Recorder = require('./recorder');

  const logger = require('./logger');

  const root = path.resolve(__dirname,'../');


  const update = require('./update');
  const serviceWorkerBase = path.resolve(__dirname, 'service-worker.js');
  const serviceWorker = path.resolve(__dirname, '../client/service-worker.js');


// see https://stackoverflow.com/a/52171480/438737
  const cyrb53 = function(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1>>>16, 2246822507) ^ Math.imul(h2 ^ h2>>>13, 3266489909);
    h2 = Math.imul(h2 ^ h2>>>16, 2246822507) ^ Math.imul(h1 ^ h1>>>13, 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
  };

  const version = new Promise(async resolve => {
    //no release info file, so use package.json
    let version;
    let vtime;
    try {
      const pjsonfile = path.resolve(__dirname,'..', 'package.json');
      const pjson = require(pjsonfile);
      version = 'v' + pjson.version;
      try {
        const { mtime } = await fs.stat(pjsonfile);
        vtime = mtime;
      } catch (e) {
        vtime = new Date();
      }
    } catch (e) {
      version = 'v1.0.0';
      vtime = new Date();
    } finally {
      const finalversion = version.replace(/\s+/g, ' ').trim(); //trim out new lines and multiple spaces just one.
      const copyrightTime = new Date(vtime);
      resolve({version: finalversion, year: copyrightTime.getUTCFullYear()});
    }
  
    
  });


  const setTimeoutPromise = (time) => new Promise(accept => setTimeout(accept,time));

  let server;
  const recorders = {};
  let statusid = 0;
  const subscribedChannels = {};
  let statusTimer = 0;

  async function startUp (http, Router,enableDestroy, logger, Recorder, usb, findByIds) {
    try {
      const routerOpts = {mergeParams: true};
      const router = Router(routerOpts);  //create a router
          
      debug('about to create the http server')
      server = http.createServer((req,res) => {
        const reqURL = new URL(req.url, `http://${req.headers.host}`).pathname;
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
      fs.copyFile(serviceWorkerBase, serviceWorker).then(() =>
        version.then(info =>
          update(serviceWorker, 'version = ', `'${info.version}';`).then(() => {
            logger('app', `Release ${info.version} of Recorder API Server Operational on Port:${process.env.RECORDER_PORT} using node ${process.version}`);
            if (process.send) process.send('ready'); //if started by (e.g.) PM2 then tell it you are ready
          })
        )
      );
      router.get('/api/:client/done',async (req,res) => {
        debug('done request received');
        const client = req.params.client;
        res.statusCode = 200;
        if (subscribedChannels[client] !== undefined) {
          const subscriber = subscribedChannels[client];
          for(const channel in subscriber.channels) {
              subscriber.channels[channel].recorder.release(subscriber.channels[channel].token);
          }
          delete subscribedChannels[client];
          res.end(JSON.stringify({state: true}));
        } else {
          res.end(JSON.stringify({state: false}));
        }
      });
      
      router.get('/api/:channel/:token/release', checkRecorder, async (req,res) => {
        debug('release request received')
        const token = req.params.token
        const channel = req.params.channel
        const state = await req.recorder.release(req.params.token);
        res.statusCode = 200;
        res.end(JSON.stringify({state: state}));
        if (state) {
          //reset or state
          for (const client in subscribedChannels) {
            if (subscribedChannels[client].channels[channel] !== undefined && 
              subscribedChannels[client].channels[channel].token === token) {
              delete subscribedChannels[client].channels[channel]
              break;
            }
          }

          sendStatus('release', {channel:req.params.channel});
        }
      });
      router.get('/api/:channel/:token/renew', checkRecorder,(req,res) => {
        debug('renew request received');
        const channel = req.params.channel;
        const previousToken = req.params.token
        const result = req.recorder.renew(req.params.token);  
        res.statusCode = 200;
        res.end(JSON.stringify(result));
        //replace token in subscriber list if its there
        for (const client in subscribedChannels) {
          if (subscribedChannels[client].channels[channel] !== undefined && 
            subscribedChannels[client].channels[channel].token === previousToken) {
            
            if (result.state) {
              subscribedChannels[client].channels[channel].token = result.token
            } else {
              delete subscribedChannels[client].channels[channel]
              sendStatus('release', {channel:req.params.channel});
            }
            break;
          }
        }          
      });
      router.get('/api/:channel/:token/reset', checkRecorder, async (req,res) => {
        debug('got a loudness reset request with params', req.params);
        res.statusCode = 200;
        res.end(JSON.stringify(await req.recorder.reset(req.params.token)));
        sendStatus('reset',{channel:req.params.channel});
      }); 
      router.get('/api/:channel/:token/start', checkRecorder, async (req,res) => {
        debug('got a start request with params ', req.params);
        res.statusCode = 200;
        res.end(JSON.stringify(await req.recorder.record(req.params.token)));
      });
      router.get('/api/status', (req,res) => {
        if (req.headers.accept && req.headers.accept == 'text/event-stream') {
          //we make our unique client id from their ip address
          const client = cyrb53(req.headers['x-forwarded-for']).toString(16);
          const response = res;
          debug('/api/status received creating/reusing channel ', client);
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no' 
          });
          if (subscribedChannels[client] === undefined) {
            subscribedChannels[client] = {response: response,channels: {}};
          } else {
            subscribedChannels[client].response = response;
          }
          req.once('end', () => {
            debug('client closed status channel ', client.toString());
            if (subscribedChannels[client] !== undefined) delete subscribedChannels[client].response;
            //we don't do anything else as they may come back and we need to have the correct picture
          });
          //don't do anymore until we have a version read (normally will have completed by now)
          version.then(version => {
            //before anything else we send the client info to the user (should wake him up if asleep)
            sendStatus('newid', {
              client: client, 
              renew: parseInt(process.env.RECORDER_RENEW_TIME,10),
              log: typeof process.env.RECORDER_NO_REMOTE_LOG === 'undefined',
              warn: typeof process.env.RECORDER_NO_REMOTE_WARN === 'undefined',
              version: version.version,
              year: version.year
            }, response);
            const status = {
              scarlett: recorders.scarlett !== undefined? recorders.scarlett.status : {connected: false},
              yeti: recorders.yeti !== undefined? recorders.yeti.status :{connected: false}
            };
            //then send the current status of all the microphones.
            sendStatus('status', status, response);
          });



        } else {
          res.writeHead(404);
          res.end();
        }
      });
      router.get('/api/:channel/:token/stop', checkRecorder, async (req,res) => {
        debug('got a stop request with params ', req.params);
        res.statusCode = 200;
        res.end(JSON.stringify(await req.recorder.stop(req.params.token)));
      });
      router.get('/api/:channel/:client/take',checkRecorder, (req,res) => {
        debug('take request received');
        const client = req.params.client;
        const channel = req.params.channel;
        const {state, token, controller } = req.recorder.take(client);
        res.statusCode = 200;
        if (state) {
          //lets see if we are a subscriber
          if (subscribedChannels[client] !== undefined) {
            subscribedChannels[client].channels[channel] = {recorder :req.recorder, token: token};
          }
          res.end(JSON.stringify({state: true, token: token}));
          sendStatus('take',{ client: client, channel: req.params.channel});
        } else {
          res.end(JSON.stringify({state: false, client: controller}));
        }
      });
      router.get('/api/:channel/timer', checkRecorder, (req,res) => {
        debug('got a timer request for channel ', req.recorder.name)
        res.statusCode = 200;
        const time = req.recorder.timer;
        debug('recorder said timer was ', time);
        res.end(JSON.stringify({time: time}));
      });
      router.get('/api/:channel/:client/token', checkRecorder, (req,res) => {
        const client = req.params.client;
        debug('got a token request for channel ', req.recorder.name, ' for client ', client);
        res.end(JSON.stringify(req.recorder.retrieve(client))); //it will only work if client has control
      });
      router.get('/api/:channel/volume', checkRecorder, (req, res) => {
        if (req.headers.accept && req.headers.accept == 'text/event-stream') {
          const recorder =req.recorder;
          const response = res;
          debug ('volume subscription received for channel ', recorder.name)
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no' 
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
      router.get('/api/:client/log',(req,res) => {
        const objUrl = new URL(req.url, `http://${req.headers.host}`);
        if (typeof process.env.RECORDER_NO_REMOTE_LOG === 'undefined') 
          logger('log', decodeURI(objUrl.search).substring(1), req.headers['x-forwarded-for']);
        res.end();
      });
      router.get('/api/:client/warn',(req,res) => {
        const objUrl = new URL(req.url, `http://${req.headers.host}`);
        if (typeof process.env.RECORDER_NO_REMOTE_WARN === 'undefined') 
          logger('err', decodeURI(objUrl.search).substring(1), req.headers['x-forwarded-for']);
        res.end();
      });

      usb.on('attach', usbAttach);
      usb.on('detach', usbDetach);
 
      if (findByIds(parseInt(process.env.RECORDER_SCARLETT_VID,10), parseInt(process.env.RECORDER_SCARLETT_PID,10)) !== undefined) {
        recorders.scarlett = new Recorder(process.env.RECORDER_SCARLETT_HW, process.env.RECORDER_SCARLETT_FORMAT, process.env.RECORDER_SCARLETT_NAME);
      }
      if (findByIds(parseInt(process.env.RECORDER_YETI_VID,10), parseInt(process.env.RECORDER_YETI_PID,10)) !== undefined) {
        recorders.yeti = new Recorder(process.env.RECORDER_YETI_HW, process.env.RECORDER_YETI_FORMAT, process.env.RECORDER_YETI_NAME);
      }

      const status = {
        scarlett: recorders.scarlett !== undefined? recorders.scarlett.status : {connected: false},
        yeti: recorders.yeti !== undefined? recorders.yeti.status :{connected: false}
      };
      sendStatus('status', status);
      statusTimer = setInterval(() => {
        const status = {
          scarlett: recorders.scarlett !== undefined? recorders.scarlett.status : {connected: false},
          yeti: recorders.yeti !== undefined? recorders.yeti.status :{connected: false}
        };
        sendStatus('status', status);
      }, 90000);
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

  function sendStatus(type, data, response) {
    debugstatus('send status of event type ', type, ' to ', response ? 'one client': 'all clients')
    if (response) {
      sendMessage(response, type, data);
    } else {
      for(const client in subscribedChannels) {
        if (subscribedChannels[client].response !== undefined) sendMessage(subscribedChannels[client].response, type, data);
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
      try {
        await logger('app', 'Starting Server ShutDown Sequence');
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
        await logger('app', 'Recorder Server ShutDown');
      } catch (err) {
        logger('error', `Trying to close caused error:${err}`);
      }
    }
    process.exit(0);
  }
  if (!module.parent) {
    //running as a script, so call startUp
    debug('Startup as main script');
    startUp(http, Router, enableDestroy, logger, Recorder, usb, findByIds);
    process.on('SIGINT', () => close(usb));
  }
  module.exports = {
    startUp: startUp,
    close: close
  };
})();
