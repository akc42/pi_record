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
import {css} from '../../lit/lit-element.js';

export default  css`
  [metal] {
    position:absolute;

    background-image: -webkit-radial-gradient(  50%   0%,  8% 50%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
      -webkit-radial-gradient(  50% 100%, 12% 50%, hsla(0,0%,100%,.6) 0%, hsla(0,0%,100%,0) 100%),
      -webkit-radial-gradient(   0%  50%, 50%  7%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
      -webkit-radial-gradient( 100%  50%, 50%  5%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
      
      -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,  0%,0) 0%, hsla(0,0%,  0%,0)   3%, hsla(0,0%,  0%,.1) 3.5%),
      -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0)   6%, hsla(0,0%,100%,.1) 7.5%),
      -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0) 1.2%, hsla(0,0%,100%,.2) 2.2%),
      
      -webkit-radial-gradient( 50% 50%, 200% 50%, hsla(0,0%,90%,1) 5%, hsla(0,0%,85%,1) 30%, hsla(0,0%,60%,1) 100%);

  }

  [metal]::before, [metal]::after {
    content: "";
    top: 0;
    left: 0;
    position: absolute;
    width: inherit;
    height: inherit;
    border-radius: inherit;

    /* fake conical gradients */
    background-image: -webkit-radial-gradient(  50%   0%, 10% 50%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%),
      -webkit-radial-gradient(  50% 100%, 10% 50%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%),
      -webkit-radial-gradient(   0%  50%, 50% 10%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%),
      -webkit-radial-gradient( 100%  50%, 50% 06%, hsla(0,0%,0%,.1) 0%, hsla(0,0%,0%,0) 100%);
  }
  [metal]:before { transform: rotate( 65deg); }
  [metal]:after { transform: rotate(-65deg); }


`;