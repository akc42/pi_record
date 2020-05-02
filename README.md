# Pi_Record

**Pi_record** is a program designed to run on a raspberry pi to record from USB Microphones or USB Microphone Interfaces plugged into the USB port of the PI.  The author is developing it to run on a Rasberry Pi 4 with both a **Blue Yetti** usb microphone and a **Focusrite Scarlett 2i2 3rd Gen** usb interface.

Recordings will be stored as .flac files and are designed to be easily accessible from the post production computer using sftp/

To control recordings this program is fundementally a web server, serving up a web page which contains a record toggle button and a window to show a streaming video of the volume currently being seen from the microphones.

The author is planning to video and record piano playing.  An ipad will be used as the video camera, so the web site will also be viewed from the ipad with the record button pressed prior to starting the video recording.  The video and audio will be synced in post production.

The inspiration came from the following ffmpeg command

```
 ffmpeg -hide_banner -f alsa -ac 2 -ar 48k -i hw:CARD=USB -filter_complex "asplit=2[main][vol],[vol]showvolume=rate=25:f=0.95:o=v:m=p:dm=3:h=80:w=480:ds=log:s=2[vid]" -map [main] -c:a:0 flac recordings/session_$(date +%a_%d_%b_%Y___%H_%M_%S).flac -map [vid] -preset veryfast -g 25 -an -sc_threshold 0 -c:v:1 libx264 -b:v:1 2000k -maxrate:v:1 2200k -bufsize:v:1 3000k -f hls -hls_time 4 -hls_flags delete_segments+temp_file -strftime 1 -hls_segment_filename volume/volume-%Y%m%d-%s.ts volume/volume.m3u8 2>/dev/null

```
Having implemented a variant of that it is clear there is considerable delay with the volume video stream.  I believe it could be as much as 10 seconds behind.  Instead I am thinking I can use the ebur128 filter of ffmpeg to generate the data as text - which can then be passed to interested parties via the stream facilities we are already using for other changes.  Here is the basic test to record off of the yeti microphone and seeing a series of lines in which the left and right volume (in terms of db) is output

```
ffmpeg -hide_banner -nostats -f alsa -acodec pcm_s16le -ac:0 2 -ar 480000 -i hw:CARD=Microphone -filter_complex asplit=2[main][vols],[vols]ebur128=peak=true[vol] -map [main] -acodec flac recordings/out.flac -map [vol] -f null - 2>&1 > /dev/null| sed -n 's/.*FTPK:\([^d]*\).*/\1/p'
```

Although the final usage will not be quite like that in fact `recorder.js` will give the full picture, but when recording the resultant equiavalent
command line script is the following (with `out.flac` replaced with a filename with an iso timestring it it).  This is the command for the 
Yeti, but a very similar command is used with a Scarlett 2i2.  

The various api calls
support to concept of a user **take** control of an interface, which in essence locks it from another client doing the same.  This control lasts for 5 minutes unless **renew**ed by the client.  The client can voluntarily **release** control.  A *jwt* is used to provide some very rudementary security to this api.  When taking control, assuming noone else has already done so, an *jwt* is created and returned.  That must be provided on all subsequent commands (including **start** and **stop** recording as well as the *release* and *renew* commands mentioned above).

We also use *sse* to provide a subscription service to clients.  Events are provided to keep the client aware of the state of the server. **volume** events send the volume values from the command listed about whilst  **status** events enumerate the current state. **add** and **remove** events are fired when a microphone/interface is *plugged in* or *removed* and **take** and **release** events are fired when a user (including the client itself) *takes* or *release* control through the api.  Again we use a very crude token for the user to provide his subscription just using `Date.now()`, since this is likely to be a private service with mostly one client and occassionally a couple, so the max we assume is an iPad, maybe a phone and or a PC as well all operated bu the same person.

