/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    This file is part of Recorder.

    Recorder is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    2020 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Recorder.  If not, see <http://www.gnu.org/licenses/>.

    This css content of file may have different licencencing conditions as it was copied 
    from //From https://codepen.io/simurai/pen/DwJdq and is copyright that author

*/
import {css} from '../lit/lit-element.js';

export default  css`

.metal {

  background-color: hsl(0,0%,90%);
  box-shadow: inset hsla(0,0%,15%,  1) 0  0px 0px 4px, /* border */
  inset hsla(0,0%,15%, .8) 0 -1px 5px 4px, /* soft SD */
  inset hsla(0,0%,0%, .25) 0 -1px 0px 7px, /* bottom SD */
  inset hsla(0,0%,100%,.7) 0  2px 1px 7px, /* top HL */

  hsla(0,0%, 0%,.15) 0 -5px 6px 4px; /* outer SD */


  transition: color .2s;
}

.metal.radial {
.radial.metal {
  width: 160px;
  height: 160px;
  line-height: 160px;
  border-radius: 80px;
  background-image: -webkit-radial-gradient(  50%   0%,  8% 50%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
  -webkit-radial-gradient(  50% 100%, 12% 50%, hsla(0,0%,100%,.6) 0%, hsla(0,0%,100%,0) 100%),
  -webkit-radial-gradient(   0%  50%, 50%  7%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),
  -webkit-radial-gradient( 100%  50%, 50%  5%, hsla(0,0%,100%,.5) 0%, hsla(0,0%,100%,0) 100%),

  -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,  0%,0) 0%, hsla(0,0%,  0%,0)   3%, hsla(0,0%,  0%,.1) 3.5%),
  -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0)   6%, hsla(0,0%,100%,.1) 7.5%),
  -webkit-repeating-radial-gradient( 50% 50%, 100% 100%, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0) 1.2%, hsla(0,0%,100%,.2) 2.2%),

  -webkit-radial-gradient( 50% 50%, 200% 50%, hsla(0,0%,90%,1) 5%, hsla(0,0%,85%,1) 30%, hsla(0,0%,60%,1) 100%);
}


.metal.radial:before, .metal.radial:after {
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
]
.metal.radial:before { transform: rotate( 65deg); }
.metal.radial:after { transform: rotate(-65deg); }


.metal.linear{
  background-image: -webkit-repeating-linear-gradient(left, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0)   6%, hsla(0,0%,100%, .1) 7.5%),
    -webkit-repeating-linear-gradient(left, hsla(0,0%,  0%,0) 0%, hsla(0,0%,  0%,0)   4%, hsla(0,0%,  0%,.03) 4.5%),
    -webkit-repeating-linear-gradient(left, hsla(0,0%,100%,0) 0%, hsla(0,0%,100%,0) 1.2%, hsla(0,0%,100%,.15) 2.2%),
    
    linear-gradient(180deg, hsl(0,0%,78%)  0%, 
    hsl(0,0%,90%) 47%, 
    hsl(0,0%,78%) 53%,
    hsl(0,0%,70%)100%);


}
.metal:active {
color: hsl(210, 100%, 40%);
text-shadow: hsla(210,100%,20%,.3) 0 -1px 0, hsl(210,100%,85%) 0 2px 1px, hsla(200,100%,80%,1) 0 0 5px, hsla(210,100%,50%,.6) 0 0 20px;
box-shadow: 
inset hsla(210,100%,30%,  1) 0  0px 0px 4px, /* border */
inset hsla(210,100%,15%, .4) 0 -1px 5px 4px, /* soft SD */
inset hsla(210,100%,20%,.25) 0 -1px 0px 7px, /* bottom SD */
inset hsla(210,100%,100%,.7) 0  2px 1px 7px, /* top HL */

hsla(210,100%,75%, .8) 0  0px 3px 2px, /* outer SD */
hsla(210,50%,40%, .25) 0 -5px 6px 4px, /* outer SD */
hsla(210,80%,95%,   1) 0  5px 6px 4px; /* outer HL */
}

`;