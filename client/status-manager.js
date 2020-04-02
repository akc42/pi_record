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
//Web worker script to manage status messages.

importScripts('./ticker.js');

const subscribeid = Date.now();  //create a unique (good enougjt)
const micstate = {};
let currentMic = '';
const mics = [];
let EventSrc;


onmessage = function(e) {
  console.group('Status Worker Message');
  const func = e.data[0];
  const mic = e.data[1];
  console.log('Function: ', func, ' with Value ', mic);
  switch(func) {
    case 'start':
      eventSrc = new EventSource(`/api/${subscribeid}/status`);
      eventSrc.addEventListener('add', eventAdd);
      eventSrc.addEventListener('close', eventClose);
      eventSrc.addEventListener('release', eventRelease);
      eventSrc.addEventListener('remove', eventRemove);
      eventSrc.addEventListener('status', eventStatus);
      eventSrc.addEventListener('take', eventTake);   
      break;
      case 'newMic' :

    default:
      console.warn('Web Worker received unknown function ', func);
  }
  console.groupEnd();

}
 


const eventAdd = (e) => {
  try {
    const initialMicsLength = mics.length;
    const {channel, name} = JSON.parse(e.data);
    if (currentMic.length === 0) {
      currentMic = channel;
      self.postMessage(['changeMic', currentMic]);
    }
    if (micstate[channel] === undefined) {
      micstate[channel] = {
        connected: true, 
        taken: false, 
        token: '', 
        client: '',
        controlling: false, 
        name: name,
        mode: 'Unknown',
        recording: false, 
        state : 'Unknown', 
        target : 'Unknown',
        filename: ''
      }
      const micU = channel.charAt(0).toUpperCase() + channel.substring(1);
      if(!mics.find(aMic => micU === aMic)) {
        mics.push(micU);
      }
    } else Object.assign(micstate[channel],{connected: true, name: name});
    if (initialMicsLength !== mics.length) {
      self.postMessage(['newMics', mics]);
    }
    if (currentMic === channel) {
      self.postMessage(['connect', name]);
    } 

  } catch (e) {
    console.warn('Error in parsing Event Add:', e);
    self.postMessage(['state', 'Error:A']);
  }
}


const eventClose = () => {
  //the server is closing down, so reset everything to wait for it to come up again
  self.postMessage(['close', 0]);
  for (const mic in this.micstate) {
    Object.assign(this.micstate[mic], {target: 'Close', State: 'Close', recording: false, contolling: false, connected: false});
    if (micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy();
    delete micstate[mic].ticker;
  }
 }
const eventRelease = (e) => {
  try {
    const {channel} = JSON.parse(e.data);     
    Object.assign(micstate[channel], {taken :false, client: '', token:'', controlling: false, recording: false});
    if (micstate[channel].ticker !== undefined) micstate[channel].ticker.destroy();
    self.postMessage(['release', channel]);
  } catch (e) {
    console.warn('Error in parsing Event Release:', e);
    self.postMessage(['state', 'Error:G']);
  }
}
const eventRemove = (e) => {
  try {
    const {channel} = JSON.parse(e.data);
    Object.assign(micstate[channel], {taken: false, client: '', token: '', connected:false, controlling: false, recording:false});
    if (micstate[channel].ticker !== undefined) micstate[channel].ticker.destroy();
    self.postMessage(['remove', channel]);
    
  } catch (e) {
    console.warn('Error in parsing Event Remove:', e);
    self.postMessage(['state','Error:D']);
  }
}
const eventStatus = (e) => {
  try {
    const initialMicsLength = mics.length;
    const status = JSON.parse(e.data);
    for (const mic in status) {
      if (currentMic.length === 0) {
        currentMic = mic;
        self.postMessage(['changeMic', currentMic]);
      }
      if (micstate[mic] === undefined) {
        micstate[mic] = {};
        Object.assign(micstate[mic],{
          //initial defaults
          mode: 'Monitor',
          controlling: false,
          token: '', 
          recording: false, 
          state : 'No Mic', 
          target : 'Monitor',
          filename: ''
        }, status[mic]);

      } else {
        if (status[mic].name.length === 0) delete status[mic].name; //don't overwrite a name with blank once we have captured it.
        const controlling = status[mic].taken && status[mic].client === subscribeid.toString();
        Object.assign(micstate[mic], status[mic], {controlling: controlling});
        if (!controlling && micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy(); 

      }
      const micU = mic.charAt(0).toUpperCase() + mic.substring(1);
      if(!mics.find(aMic => micU === aMic)) {
        mics.push(micU);
      }
      if (currentMic.length === 0) {
        currentMic = mic;
        micChange(currentMic);
      } else if(currentMic === mic) {
        self.postMessage(['status', {
          connected: micstate[mic].connected,
          name: micstate[mic].name,
          controlling: micstate[mic].controlling,
       }]);
      }
    }
    if (initialMicsLength !== mics.length) {
      self.postMessage(['newMics', mics]);
    }
  } catch (e) {
    console.warn('Error in parsing Event Status:', e);
    self.postMessage(['state', 'Error:S'])
  }
}

const eventTake = (e) => {
  try {
    const {channel,client} = JSON.parse(e.data);
    const controlling = (client === subscribeid.toString());
    Object.assign(micstate[channel], {client:client, taken: true, controlling: controlling});
    if (channel === currentMic) {
      self.postMessage(['control', controlling]);
    } 
  } catch (err) {
    console.warn('Error in parsing Event Remove:', err);
    self.postMessage(['state', 'error:T']);
  }

}


const loudReset = () => {
  const mic = currentMic
  if (micstat[mic].controlling && !micstat[mic].recording) {

    callApi('reset',mic, micstate[mic].token).then(({state, timer}) => {
      if (state && mic === currentMic) {
        self.postMessage(['seconds', timer]);
      }
    });
  }

}

const micChange = (newMic) => {
  const old = currentMic;
  currentMic = newMic;
  console.group('Mic Change');
  console.log('From ', old ,' To ', currentMic);
  self.postMessage(['micChange',{
    connected: micstate[currentMic].connected,
    name: micstate[currentMic].name,
    controlling: micstate[currentMic].controlling,
    recording: micstate[currentMic].recording,
    mode: 

  }])
   connected = micstate[currentMic].connected;
  controlling = micstate[currentMic].controlling;
  recording = micstate[currentMic].recording;
  mode = micstate[currentMic].mode;
  filename = micstate[currentMic].filename;
  console.log('To Mode ',mode, ' Connected ', connected, 
  ' Controlling ', controlling, ' Recording ', recording, ' Filename ', filename );
  console.log('State from ', state, ' to ',micstate[currentMic].state);
  console.log('Target from ', target,' to ', micstate[currentMic].target );
  console.groupEnd()
  state = micstate[currentMic].state;
  target = micstate[currentMic].target;
  micname = micstate[currentMic].name;

}

const releaseControl = () => {
  const mic = currentMic;
  if (micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy();
  callApi('release', mic, micstate[mic].token).then(({state}) => {
    if (state) {
      if (mic === currentMic) {
        self.postMessage(['release', mic]);
      }
      Object.assign(this.micstate[mic], {taken: false, client: '', controlled: false})
    } else {
      self.postMessage(['state','Error G']);
    }
  });
};
const stopRecording = () => {
  const mic = currentMic;
  callApi('stop', mic, micstate[mic].token).then(({state,kept}) => {
    if (state) {
      micstate[mic].recording = false;
      if (!kept) micstate[mic].filename = '';
      if (mic === currentMic) {
        self.postMessage(['stop', kept]);
     
    } else {
      this.micstate[mic].recording = false;
      if (!(state && kept)) this.micstate[mic].filename = '';
    }
  }
  });

};

const takeControl = () => {
  const mic = currentMic;
  callApi('take', mic, subscribeid).then( async ({state,token}) => {
    if (state) {
      Object.assign(micstate[mic], {
        token: token, 
        controlling: true, 
        taken: true, 
        client: subscribeid, 
        ticker:  new Ticker(4*60*1000) //create a renew ticker for 4 minutes
      });
      if (currentMic === mic) {
        self.postMessage(['control', true])
      } 
     
      try {
        while(true) {
          await micstate[mic].ticker.nextTick;
          const {state, token} = await this._callApi('renew', mic, micstate[mic].token);
          if (state) {
            micstate[mic].token = token;
          } else {
            Object.assign(this.micstate[mic], {controlling: false, token:''});
            if (currentMic === mic) {
              self.postMessage(['control', false]);
        
            } 
            micstate[mic].ticker.destroy();
          }
        }

      } catch(err) {
        //someone closed the ticker
        delete micstate[mic].ticker;
      }
    } else {
      if (mic === currentMic) {
        self.postMessage(['state','Await R']);
      } 
    }
  });
};

const callApi = async (func,channel,token) => {
  try {
    const response = await fetch(`/api/${channel}${token? '/' + token : ''}/${func}`);
    return await response.json(); 
  } catch(err) {
    console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
    self.postMessage(['state','Error:C']);

  }
  return {state: false};
};


  
