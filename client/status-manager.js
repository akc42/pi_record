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

const subscribeid = Date.now().toString();  //create a unique (good enough) id
const micstate = {};
let currentMic = '';
let altMic = '';
const mics = [];




onmessage = function(e) {
  console.group('Status Worker Message');
  const func = e.data[0];
  const value = e.data[1];
  console.log('Function: ', func, ' with Value ', value);
  switch(func) {
    case 'mode':
      if (currentMic.length > 0) micstate[currentMic].mode = value;
      break;
    case 'take':
      if (!micstate[currentMic].taken) {
        takeControl();
      } else {
        sendError('Take');
      }
      break;
    case 'give':
      if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && !micstate[currentMic].recording) {
        releaseControl();
      } else {
        sendError('Give');
      }
      break;
    case 'switch':
      //check that the value received is a known mic
      if (micstate.hasOwnProperty(value)) {
        if (currentMic !== value) {
          currentMic = value;
          if (altMic.length === 0 && !micstate[currentMic].connected) {
            for (const mic in micstate) {
              if (mic !== currentMic && micstate[mic].connected) {
                altMic = mic;
                break;
              }
            }
          }      
          sendStatus();
        }
      } else {
        sendError('Mic');
      }
      break;
    case 'reset':
      if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && !micstate[currentMic].recording) {
        loudReset();
      } else {
        sendError('Reset');
      }
      break;
    case 'record':
      if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && !micstate[currentMic].recording) {
        startRecording();
      } else {
        sendError('Record');
      }
      break;
    case 'stop':
      if (micstate[currentMic].taken && micstate[currentMic].client === subscribeid && micstate[currentMic].recording) {
        stopRecording();
      } else {
        sendError('Stop');
      }
      break; 
    default:
      console.warn('Web Worker received unknown function ', func);
  }
  console.groupEnd();

}
const callApi = async (func,channel,token) => {
  try {
    const response = await fetch(`/api/${channel}${token? '/' + token : ''}/${func}`);
    return await response.json(); 
  } catch(err) {
    console.warn('Error response to Api Request ', func , ' channel ', channel, ' token ', token, ':' , err);
    self.postMessage(['error','Comms']);

  }
  return {state: false};
};
 


const eventAdd = (e) => {
  try {
    const initialMicsLength = mics.length;
    const {channel, name} = JSON.parse(e.data);
    if (currentMic.length === 0) {
      currentMic = channel;
    }
    if (micstate[channel] === undefined) {
      micstate[channel] = {
        connected: true, 
        taken: false, 
        token: '', 
        client: '',
        name: name,
        mode: 'Unknown',
        recording: false, 
        filename: ''
      }
      const micU = channel.charAt(0).toUpperCase() + channel.substring(1);
      if(!mics.find(aMic => micU === aMic)) {
        mics.push(micU);
      }
    } else Object.assign(micstate[channel],{connected: true, name: name});
    if (initialMicsLength !== mics.length) {
      self.postMessage(['mics', mics]);
    }
    if (altMic.length === 0 && currentMic !== channel && !micstate[currentMic].connected) altMic = channel;
    sendStatus();
  } catch (e) {
    console.warn('Error in parsing Event Add:', e);
    sendError('Add');
  }
}


const eventClose = () => {
  //the server is closing down, so reset everything to wait for it to come up again
  for (const mic in micstate) {
    Object.assign(micstate[mic], {taken: false , recording: false, contolling: false, connected: false});
    if (micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy();
    delete micstate[mic].ticker;
  }
  self.postMessage(['close', '']);
 }
const eventRelease = (e) => {
  try {
    const {channel} = JSON.parse(e.data);     
    Object.assign(micstate[channel], {taken :false, client: '', token:'', controlling: false, recording: false});
    if (micstate[channel].ticker !== undefined) micstate[channel].ticker.destroy();
    sendStatus
  } catch (e) {
    console.warn('Error in parsing Event Release:', e);
    sendError('Rlse')
  }
}
const eventRemove = (e) => {
  try {
    const {channel} = JSON.parse(e.data);
    Object.assign(micstate[channel], {taken: false, client: '', token: '', connected:false, controlling: false, recording:false});
    if (micstate[channel].ticker !== undefined) micstate[channel].ticker.destroy();
    if (altMic === channel) {
      altMic = '';
      for (mic in micstate) {
        if(mic !== currentMic && micstate[mic].connected) {
          altMic = mic;
          break;
        }
      }
    }
    sendStatus();
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
      if (status[mic].connected) {
        if (possibleMic.length === 0) possibleMic = mic;
        if (altMic.length === 0 && currentMic.length > 0 && currentMic !== mic) altMic = mic;
       } else if (altMic === mic) altMic = '';  //no longer connected so reset altMic
      if (micstate[mic] === undefined) {
        micstate[mic] = {};
        Object.assign(micstate[mic],{
          //initial defaults
          connected: false, 
          taken: false, 
          token: '', 
          client: '',
          name: name,
          mode: 'Unknown',
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
    if (currentMic.length === 0) {
      if (possibleMic.length > 0) {
        currentMic = possibleMic;
      } else {
        currentMic = firstMic;
      }
    }
    if (altMic.length === 0 && currentMic.length > 0 && !micstate[currentMic].connected) {
      for (const mic in micstate) {
        if (mic !== currentMic && micstate[mic].connected) {
          altMic = mic;
          break;
        }
      }
    }
    if (initialMicsLength !== mics.length) {
      self.postMessage(['mics', mics]);
    }
    sendStatus();
  } catch (e) {
    console.warn('Error in parsing Event Status:', e);
    sendError('Stat')
  }
}

const eventTake = (e) => {
  try {
    const {channel,client} = JSON.parse(e.data);
    Object.assign(micstate[channel], {client:client, taken: true});
    sendStatus();
  } catch (err) {
    console.warn('Error in parsing Event Remove:', err);
    sendError('ETake');
  }

}


const loudReset = () => {
  const mic = currentMic
  if (micstate[mic].taken && micstate[mic].client === subscribeid && !micstate[mic].recording) {
    callApi('reset',mic, micstate[mic].token).then(({state, timer}) => {
      if (state && mic === currentMic) {
        self.postMessage(['seconds', timer]);
      }
    });
  }
}



const releaseControl = () => {
  const mic = currentMic;
  if (micstate[mic].ticker !== undefined) micstate[mic].ticker.destroy();
  callApi('release', mic, micstate[mic].token).then(({state}) => {
    if (state) {
      Object.assign(micstate[mic], {taken: false, client: ''});
      sendStatus();
    } else {
      sendError('Give', mic);
    }
  });
};
const sendError = (error, mic) => {
  console.log('Send Error: ', error);
  const theMic = mic || currentMic;
  if(currentMic === theMic) {
    self.postMessage(['error', error]);
  }
};
const sendStatus = () => {
  console.log('Send Status');
  self.postMessage(['status',{
    mic: currentMic,
    mode: micstate[currentMic].mode,
    alt: micstate[currentMic].connected ? '' : (altMic.length > 0 ? micstate[altMic].name : ''),
    name: micstate[currentMic].name,
    connected: micstate[currentMic].connected,
    taken: micstate[currentMic].taken,
    controlling: micstate[currentMic].taken && micstate[currentMic].client === subscribeid ,
    recording: micstate[currentMic]. recording,
    filename: micstate[currentMic].filename
  }]);
};

const startRecording = () => {
  const mic = currentMic;
  callApi('start', mic,micstate[mic].token).then(({state,name}) => {
    if (state) {
      Object.assign(micstate[mic], {recording: true, filename: name});
      sendStatus();
    } else {
      sendError('Record', mic);
    }

  });
}

const stopRecording = () => {
  const mic = currentMic;
  callApi('stop', mic, micstate[mic].token).then(({state,kept}) => {
    micstate[mic].recording = false;
    if (!kept) micstate[mic].filename = '';
    if (state) {
      sendStatus();
    } else {
      sendError('Stop', mic);
    }
  });

};

const takeControl = () => {
  const mic = currentMic;
  callApi('take', mic, subscribeid).then( async ({state,token}) => {
    if (state) {
      Object.assign(micstate[mic], {
        token: token, 
        taken: true, 
        client: subscribeid, 
        ticker:  new Ticker(4*60*1000) //create a renew ticker for 4 minutes
      });
      sendStatus();
      try {
        while(true) {
          await micstate[mic].ticker.nextTick;
          const {state, token} = await callApi('renew', mic, micstate[mic].token);
          if (state) {
            micstate[mic].token = token;
          } else {
            micstate[mic].token = '';
            if (micstate[mic].taken && micstate[mic].client === subscribeid) {
              Object.assign(micstate[mic], {taken: false, client: ''});
            }
            sendStatus();
            micstate[mic].ticker.destroy(); //no last as we will invoke immediate catch and want to have completed other stuff first
          }
        }

      } catch(err) {
        //someone closed the ticker
        delete micstate[mic].ticker;
      }
    } else {
      sendError('Await R', mic);
    }
  });
};


const eventSrc = new EventSource(`/api/${subscribeid}/status`);
eventSrc.addEventListener('add', eventAdd);
eventSrc.addEventListener('close', eventClose);
eventSrc.addEventListener('release', eventRelease);
eventSrc.addEventListener('remove', eventRemove);
eventSrc.addEventListener('status', eventStatus);
eventSrc.addEventListener('take', eventTake);   



  
