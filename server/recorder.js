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
const recargs = [
  '-hide_banner',
  '-f',
  'alsa',
  '-ac',
  '2',
  '-ar',
  '48k',
  '-i',
  'hw:CARD=USB',
  '-filter_complex',
  'asplit=2[main][vol],[vol]showvolume=rate=25:f=0.95:o=v:m=p:dm=3:h=80:w=480:ds=log:s=2[vid]',
  '-map',
  '[main]',
  '-c:a:0',
  'flac',
  '',
  '-map',
  '[vid]',
  '-preset',
  'ultrafast',
  '-g',
  '25',
  '-an',
  '-sc_threshold',
  '0',
  '-c:v:1',
  'libx264',
  '-b:v:1',
  '1000k',
  '-maxrate:v:1',
  '1100k',
  '-bufsize:v:1',
  '2000k',
  '-f',
  'hls',
  '-hls_time',
  '4',
  '-hls_flags',
  'delete_segments+temp_file',
  '-strftime',
  '1',
  '-hls_segment_filename',
  'volume/volume-%Y%m%d-%s.ts',
  'volume/volume.m3u8'
];

const monargs = [
  '-hide_banner',
  '-f',
  'alsa',
  '-ac',
  '2',
  '-ar',
  '48k',
  '-i',
  'hw:CARD=USB',
  '-filter_complex',
  'showvolume=rate=25:f=0.95:o=v:m=p:dm=3:h=80:w=480:ds=log:s=2',
  '-preset',
  'ultrafast',
  '-g',
  '25',
  '-an',
  '-sc_threshold',
  '0',
  '-c:v',
  'libx264',
  '-b:v',
  '1000k',
  '-maxrate:v',
  '1100k',
  '-bufsize:v',
  '2000k',
  '-f',
  'hls',
  '-hls_time',
  '4',
  '-hls_flags',
  'delete_segments+temp_file',
  '-strftime',
  '1',
  '-hls_segment_filename',
  'volume/volume-%Y%m%d-%s.ts',
  'volume/volume.m3u8'
];