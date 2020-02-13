# Pi_Record

**Pi_record** is a program designed to run on a raspberry pi to record from USB Microphones or USB Microphone Interfaces plugged into the USB port of the PI.  The author is developing it to run on a Rasberry Pi 4 with both a **Blue Yetti** usb microphone and a **Focusrite Scarlett 2i2 3rd Gen** usb interface.

Recordings will be stored as .flac files and are designed to be easily accessible from the post production computer using sftp/

To control recordings this program is fundementally a web server, serving up a web page which contains a record toggle button and a window to show a streaming video of the volume currently being seen from the microphones.

The author is planning to video and record piano playing.  An ipad will be used as the video camera, so the web site will also be viewed from the ipad with the record button pressed prior to starting the video recording.  The video and audio will be synced in post production.

The inspiration came from the following ffmpeg command

```
 ffmpeg -hide_banner -f alsa -ac 2 -ar 48k -i hw:CARD=USB -filter_complex "asplit=2[main][vol],[vol]showvolume=rate=25:f=0.95:o=v:m=p:dm=3:h=80:w=480:ds=log:s=2[vid]" -map [main] -c:a:0 flac recordings/session_$(date +%a_%d_%b_%Y___%H_%M_%S).flac -map [vid] -preset veryfast -g 25 -an -sc_threshold 0 -c:v:1 libx264 -b:v:1 2000k -maxrate:v:1 2200k -bufsize:v:1 3000k -f hls -hls_time 4 -hls_flags delete_segments+temp_file -strftime 1 -hls_segment_filename volume/volume-%Y%m%d-%s.ts volume/volume.m3u8 2>/dev/null

```

Although the final usage will not be quite like that