/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    This file is part of Recorder.

    Recorder is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Recorder is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Recorder.  If not, see <http://www.gnu.org/licenses/>.
*/
importScripts('./ticker.js');

const version = 'recorder-v1'
const api = /^\/api\/(\w+)\/(volume|timer|status|done|((\S+)\/(take|start|renew|release|stop)))$/i;

const clients = new Set();
const mics = new Map();
const subscribeid = Date.now().toString();
let eventSrc;

self.addEventListener('install', (event) => {
  event.waitUntil(async function() {
    const cache = await caches.open(version);
    await cache.addAll([
      '/',
      '/index.html',
      '/images/light-aluminium.png',
      '/images/recorder-icon-32.png',
      '/images/recorder-icon-144.png',
      '/images/recorder-icon.svg',
      '/styles/label.js',
      '/styles/metal.js',
      '/lcd/characters.js',
      '/lcd/classes.js',
      '/manifest.json',
      '/favicon.ico',
      '/material-icon.js',
      '/rec-app.js',
      '/rec-led.js',
      '/rec-record-button.js',
      '/rec-reset-button.js',
      '/rec-volume.js',
      '/round-switch.js'
    ]);
  });
});
self.addEventListener('activate', (event) => {
  subscribeid = Date.now().toString();  //something to use for our EventSrc subscription;
  event.waitUntil(async function() {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.filter((cacheName) => {
        return cacheName !== version;  //deletes anything that isn't current 
      }).map(cacheName => caches.delete(cacheName))
    );
  });
});


self.addEventListener('fetch', (event) => {

  const requestURL = new URL(event.request.url);

  if (/^\/api\//i.test(requestURL.pathname)) {
    if (api.test(requestURL.pathname)) {
      /*
        we are going to handle a few of the requests - the remainder we just pass through
      */
      const match = api.exec(requestURL.pathname);
      switch (match[2]) {
        case 'status':
          if (clients.keys().length === 0) {
            //this is our first client, so open up the event stream
            eventSrc = new EventSource(`/api/${subscribeid}/status`);
            eventSrc.addEventListener('add', eventAdd);
            eventSrc.addEventListener('close', eventClose);
            eventSrc.addEventListener('release', eventRelease);
            eventSrc.addEventListener('remove', eventRemove);
            eventSrc.addEventListener('status', eventStatus);
            eventSrc.addEventListener('take', eventTake);     
          }
          // add our client to the list
          clients.add(match[1]);
          break;
        case 'done' :
          clients.delete(match[1]); //remove our client
          if (Object.keys(clients).length === 0) {
            //no clients left so we shut down our eventSrc
            eventSrc.close();
            eventSrc.removeEventListener('add', eventAdd);
            eventSrc.removeEventListener('close', eventClose);
            eventSrc.removeEventListener('release', eventRelease);
            eventSrc.removeEventListener('remove', eventRemove);
            eventSrc.removeEventListener('status', eventStatus);
            eventSrc.removeEventListener('take', eventTake); 
          }
          break;
        default:
          if (match.length === 6) {
            switch(match[5]) {
              case 'take':
                break;
              case 'renew':
                event.respondWith(new Response(`Service Worker Handles this ${requestURL.pathname}`, {status: 404}));
                break;
              default:
                event.respondWith(fetch(event.request));
            }
          } else {
            event.respondWith(fetch(event.request));
          }
      } 
      }
      event.respondWith(fetch(event.request));  
    } else {
      event.respondWith(new Response(`Invalid API ${requestURL.pathname}`, {status: 404}));
    }
  } else if (service.test(requestURL.pathname)) {
    event.respondWith(async () => {
      //so a message - lets see if we have started anything yet
      if (!esRunning) {
        eventSrc = new EventSource(`/api/${subscribeid}/status`);
        eventSrc.addEventListener('add', eventAdd);
        eventSrc.addEventListener('close', eventClose);
        eventSrc.addEventListener('release', eventRelease);
        eventSrc.addEventListener('remove', eventRemove);
        eventSrc.addEventListener('status', eventStatus);
        eventSrc.addEventListener('take', eventTake); 
        esRunning = true;
        // because we are starting up stream in this request, it shouldn't end in the background until we close the stream again.
        // We will eventually, when there are no more clients, so provide a promise that we will eventually resolve.
        event.waitUntil(() => new Promise((resolve) => eventSrcPromiseResolver = resolve));
      }
      if (clients[event.clientId] === undefined) {
        clients[event.clientId] = {mics: {}, mic: ''};
      }
      const currentMic = clients[event.clientId].mic;
      const match = service.exec(requestURL.pathname);
      switch (match[1]) {
        case 'mode':
          if (currentMic.length > 0) clients[event.clientId].mics[currentMic].mode = match[3];
          break;
        case 'take':
          if (!micstate[mic].taken) {
            await takeControl(mic, event.clientId);
          } else {
            sendError('Take',event.clientId);
          }
          break;
        case 'give':
          if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && 
            micstate[currentMic].window === event.clientId && !micstate[currentMic].recording) {
            releaseControl(mic, event.clientId);
          } else {
            sendError('Give',event.clientId);
          }
          break;
        case 'switch':
          //check that the value received is a known mic
          if (micstate.hasOwnProperty(match[3])) {
            if (currentMic !== match[3]) {
              currentMic = match[3];
              sendStatus(event.clientId);
            }
          } else {
            sendError('Mic',event.clientId);
          }
          break;
        case 'reset':
          if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid &&
            !micstate[currentMic].recording && micstate[currentMic].window === event.clientId) {
            await loudReset(mic,event.clientId);
          } else {
            sendError('Reset', event,clientId);
          }
          break;
        case 'record':
          if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && 
            !micstate[currentMic].recording && micstate[currentMic].window === event.clientId) {
            await startRecording(mic, event.clientId);
          } else {
            sendError('Record', event.clientId, mic);
          }
          break;
        case 'stop':
          if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && 
            micstate[currentMic].recording && micstate[currentMic].window === event.clientId) {
            await stopRecording(mic, event.clientId);
          } else {
            sendError('Stop', event.clientId, mic);
          }
          break;
        case 'done':
          if (micstate[currentMic].window === event.clientId) {
            //looks like this client has control, so we need to release it
            if (micstate[currentMic].recording) await stopRecording(mic, event.clientId);
            if (micstate[currentMic].controlling) await releaseControl(mic, event.clientId);
          }
          delete clients[event.clientId]; //remove it from the list of clients
          if (Object.keys().length === 0) {
            //no clients left so we shut down our eventSrc
            eventSrc.close();
            eventSrc.removeEventListener('add', eventAdd);
            eventSrc.removeEventListener('close', eventClose);
            eventSrc.removeEventListener('release', eventRelease);
            eventSrc.removeEventListener('remove', eventRemove);
            eventSrc.removeEventListener('status', eventStatus);
            eventSrc.removeEventListener('take', eventTake); 
            esRunning = false;
            eventSrcPromiseResolver(); //let the original fetch event know we are done
          }
          break;
        default:
          return new Response('Unknown Service Command', {status: 404});
      }
      return new Response('OK',{status: 200});        
    });
  } else {
    event.respondWith(async () => {
      const cache = await caches.open(version);
      const cachedResponse = await cache.match(event.request);
      const networkResponsePromise = fetch(event.request);

      event.waitUntil(async () => {
        const networkResponse = await networkResponsePromise;
        await cache.put(event.request, networkResponse.clone());
      });

      // Returned the cached response if we have one, otherwise return the network response.
      return cachedResponse || networkResponsePromise;
    
    });
  }
});

const callApi = async (cid,func,channel,token) => {
  try {
    const response = await fetch(`/api/${channel}${token? '/' + token : ''}/${func}`);
    return await response.json(); 
  } catch(err) {
    console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
    Clients.get(cid).postMessage(['error','Comms']);

  }
  return {state: false};
};

const eventAdd = (e) => {
  try {
    const initialMicsLength = mics.length;
    const {channel, name} = JSON.parse(e.data);
    for(const cid in clients) {
      if (clients[cid].mic.length === 0) {
        clients[cid].mic = channel;
      }
    }
    if (micstate[channel] === undefined) {
      micstate[channel] = {
        connected: true, 
        taken: false, 
        token: '', 
        client: '',
        window: '',
        name: name,
        recording: false, 
        filename: ''
      }
      const micU = channel.charAt(0).toUpperCase() + channel.substring(1);
      if(!mics.find(aMic => micU === aMic)) {
        mics.push(micU);
      }
    } else Object.assign(micstate[channel],{connected: true, name: name});
    if (initialMicsLength !== mics.length) {
      sendAll('mics', mics);
    }
    statusAll();
  } catch (e) {
    console.warn('Error in parsing Event Add:', e);
  }
}


const eventClose = () => {
  //the server is closing down, so reset everything to wait for it to come up again
  for (const mic in micstate) {
    Object.assign(micstate[mic], {taken: false , recording: false, contolling: false, connected: false, window:''});
    if (micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy();
    delete micstate[mic].ticker;
  }
  sendAll('close', '');
 }
const eventRelease = (e) => {
  try {
    const {channel} = JSON.parse(e.data);     
    Object.assign(micstate[channel], {taken :false, client: '', token:'', controlling: false, recording: false, window:''});
    if (micstate[channel].ticker !== undefined) micstate[channel].ticker.destroy();
    statusAll()
  } catch (e) {
    console.warn('Error in parsing Event Release:', e);
  }
}
const eventRemove = (e) => {
  try {
    const {channel} = JSON.parse(e.data);
    Object.assign(micstate[channel], {taken: false, client: '', token: '', connected:false, controlling: false, recording:false, window:''});
    if (micstate[channel].ticker !== undefined) micstate[channel].ticker.destroy();
    statusAll();
  } catch (e) {
    console.warn('Error in parsing Event Remove:', e);
    sendError('Rmve');
  }
}
const eventStatus = (e) => {
  try {
    const initialMicsLength = mics.length;
    const status = JSON.parse(e.data);
    let possibleMic = '';
    let firstMic = '';
    for (const mic in status) {
      if (firstMic.length === 0) {
        firstMic = mic;
      }
      if (status[mic].connected && possibleMic.length === 0) possibleMic = mic;
      if (micstate[mic] === undefined) {
        micstate[mic] = {};
        Object.assign(micstate[mic],{
          //initial defaults
          connected: false, 
          taken: false, 
          token: '', 
          client: '',
          name: name,
          window: '',
          recording: false, 
          filename: '' 
        }, status[mic]);

      } else {
        if (status[mic].name !== undefined && status[mic].name.length === 0) delete status[mic].name; //don't overwrite a name with blank once we have captured it.
        const controlling = status[mic].connected && status[mic].taken && status[mic].client === subscribeid;
        Object.assign(micstate[mic], status[mic]);
        if (!controlling && micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy(); 

      }
      const micU = mic.charAt(0).toUpperCase() + mic.substring(1);
      if(!mics.find(aMic => micU === aMic)) {
        mics.push(micU);
      }
    }
    for (cid in clients) {
      if (clients[cid].mic.length === 0) {
        clients[cid].mic = possibleMic.length > 0 ? posibleMic : firstMic;
      }
    }
    if (initialMicsLength !== mics.length) {
      sendAll('mics', mics);
    }
    statusAll();
  } catch (e) {
    console.warn('Error in parsing Event Status:', e);
  }
}

const eventTake = (e) => {
  try {
    const {channel,client} = JSON.parse(e.data);

    Object.assign(micstate[channel], {client:client, taken: true});
    statusAll();
  } catch (err) {
    console.warn('Error in parsing Event Remove:', err);
  }

}

const loudReset = (currentMic, id) => {
  const cid = id;
  const mic = currentMic
  return callApi(id,'reset',mic, micstate[mic].token).then(({state, timer}) => {
    if (state && mic === clients[cid].mic) {
      Clients.get(cid).postMessage(['seconds', timer]);
    }
  });  
};

const releaseControl = (currentMic, id) => {
  const cid = id;
  const mic = currentMic;
  if (micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy();
  return callApi(cid, 'release', mic, micstate[mic].token).then(({state}) => {
    if (state) {
      Object.assign(micstate[mic], {taken: false, client: '', window: ''});
      statusAll();
    } else {
      sendError('Give', mic);
    }
  });
};

const sendAll = (func,value) => {
  for(const cid in clients) {
    Clients.get(cid).postMessage([func, value])
  }
}

const sendError = (error, cid, mic) => {
  console.log('Send Error: ', error);
  const theMic = mic || clients[cid].mic;
  if(clients[cid].mic === theMic) {
    Clients.get(cid).postMessage(['error', error])
  }
};

const sendStatus = (cid) => {
  console.log('Send Status');
  const currentMic = clients[cid].mic
  let altMic = '';
  for (const mic in micstate) {
    if (mic !== currentMic && micstate[mic].connected) {
      altMic = mic;
      break;
    }
  }

  Clients.get(cid).postMessage(['status',{
    mic: currentMic,
    mode: clients[cid].mode,
    alt: micstate[clients[cid].mic].connected ? '' : (altMic.length > 0 ? micstate[altMic].name : ''),
    name: micstate[currentMic].name,
    connected: micstate[currentMic].connected,
    taken: micstate[currentMic].taken,
    controlling: micstate[currentMic].taken && micstate[currentMic].client === subscribeid && micstate[currentMic].window === cid,
    recording: micstate[currentMic].recording && micstate[currentMic].window === cid,
    filename: micstate[currentMic].filename
  }]);
};

const startRecording = (id) => {
  const cid = id;
  const mic = currentMic;
  return callApi(cid,'start', mic,micstate[mic].token).then(({state,name}) => {
    if (state) {
      Object.assign(micstate[mic], {recording: true, filename: name});
      sendStatus(cid);
    } else {
      sendError('Record', cid,mic);
    }

  });
};

const statusAll = () => {
  for(const cid in clients) {
    sendStatus(cid);
  }
};

const stopRecording = (currentMic,id) => {
  const mic = currentMic;
  const cid = id
  return callApi(cid,'stop', mic, micstate[mic].token).then(({state,kept}) => {
    micstate[mic].recording = false;
    if (!kept) micstate[mic].filename = '';
    if (state) {
      sendStatus(cid);
    } else {
      sendError('Stop', cid, mic);
    }
  });

};

const takeControl = (currentMic,id) => {
  const cid = id;
  const mic = currentMic;
  return callApi(cid,'take', mic, subscribeid).then( async ({state,token}) => {
    if (state) {
      Object.assign(micstate[mic], {
        token: token, 
        taken: true, 
        client: subscribeid,
        window: cid,
        ticker:  new Ticker(4*60*1000) //create a renew ticker for 4 minutes
      });
      statusAll();
      try {
        while(true) {
          await micstate[mic].ticker.nextTick;
          const {state, token} = await callApi(cid,'renew', mic, micstate[mic].token);
          if (state) {
            micstate[mic].token = token;
          } else {
            micstate[mic].token = '';
            if (micstate[mic].taken && micstate[mic].client === subscribeid) {
              Object.assign(micstate[mic], {taken: false, client: '',window: ''});
            }
            statusAll();
            micstate[mic].ticker.destroy(); //no last as we will invoke immediate catch and want to have completed other stuff first
          }
        }

      } catch(err) {
        //someone closed the ticker
        delete micstate[mic].ticker;
      }
    } else {
      sendError('Await R', cid, mic);
    }
  });
};
